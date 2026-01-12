#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>

// ==================== 引脚定义 ====================
#define RST_PIN    D0  // RC522 RST 引脚 (GPIO16)
#define SS_PIN     D8  // RC522 SS（CS）引脚 (GPIO15)
#define LED_PIN    D2  // LED 警告灯引脚 (GPIO4)
#define BUZZER_PIN D6  // 蜂鸣器引脚 (GPIO12)

// OLED 引脚定义 (SPI 接口)
#define OLED_CLK   D5  // D0 (CLK) - SPI CLK (GPIO14)
#define OLED_MOSI  D7  // D1 (MOSI) - SPI MOSI (GPIO13)
#define OLED_RST   D4  // RES - 复位 (GPIO2)
#define OLED_DC    D1  // DC - 数据/命令 (GPIO5)
#define OLED_CS    D3  // CS - 片选 (GPIO0)

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// ==================== 对象定义 ====================
MFRC522 mfrc522(SS_PIN, RST_PIN);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &SPI, OLED_DC, OLED_RST, OLED_CS);

// ==================== WiFi 和 MQTT 配置 ====================
const char* ssid = "P60";
const char* password = "66668888";
const char* mqtt_server = "test.mosquitto.org";  // 改为更稳定的 broker
const int mqtt_port = 1883;
const char* mqtt_user = "";     // 无需用户名
const char* mqtt_password = ""; // 无需密码
const char* mqtt_topic_allowed = "access_control/allowed";
const char* mqtt_topic_denied = "access_control/denied";
const char* mqtt_topic_count = "access_control/count";

WiFiClient espClient;
PubSubClient client(espClient);

// ==================== 系统配置 ====================
// 本组白卡的系统特征码（前三字节）
const byte VALID_CARD_SIGNATURE[3] = {0xAB, 0xCD, 0xEF};

// MFRC522 默认密钥
const byte MFRC522_KEY[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// 第15扇区第2块的地址
const byte TARGET_SECTOR = 15;
const byte TARGET_BLOCK = 2;
const byte TARGET_BLOCK_ADDRESS = 62; // 15*4 + 2

// ==================== 全局变量 ====================
unsigned long card_count = 0;
unsigned long last_card_time = 0;
const unsigned long CARD_DEBOUNCE_TIME = 1000; // 1秒防抖

// ==================== 函数声明 ====================
void setupWiFi();
void setupMQTT();
void reconnectMQTT();
void displayWelcome(String uid);
void displayDenied(String uid);
void displayCardCount();
void updateDisplay();
void blinkLED(int times);
void buzzerBeep(int times, int duration);
bool verifyCard(byte* uid, byte uidSize);
String byteArrayToHex(byte* buffer, byte bufferSize);
void publishToMQTT(const char* topic, String message);
bool readCardSignature(byte* uid, byte uidSize);

// ==================== 主程序 ====================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\nRFID Access Control System Starting...");
  
  // 初始化引脚
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // 初始化 SPI
  SPI.begin();
  
  // 初始化 MFRC522
  mfrc522.PCD_Init();
  Serial.println("MFRC522 initialized");
  
  // 初始化 OLED 显示屏
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    while (1);
  }
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("RFID Access System");
  display.println("Initializing...");
  display.display();
  
  // WiFi 和 MQTT 初始化（可选）
  setupWiFi();
  setupMQTT();
  
  delay(2000);
  displayCardCount();
  
  Serial.println("Setup Complete!");
}

void loop() {
  // 重新连接 MQTT（如果启用）
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();
  
  // 检查是否有卡片
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }
  
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }
  
  // 防抖处理
  unsigned long current_time = millis();
  if (current_time - last_card_time < CARD_DEBOUNCE_TIME) {
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }
  last_card_time = current_time;
  
  // 获取 UID
  byte* uid = mfrc522.uid.uidByte;
  byte uidSize = mfrc522.uid.size;
  String uid_hex = byteArrayToHex(uid, uidSize);
  
  Serial.print("Card UID: ");
  Serial.println(uid_hex);
  
  // 验证卡片
  if (verifyCard(uid, uidSize)) {
    // 卡片有效 - 显示欢迎信息
    Serial.println("Card Verified - Access Granted!");
    displayWelcome(uid_hex);
    card_count++;
    buzzerBeep(1, 100);  // 成功鸣叫1次
    
    // 发布到 MQTT
    publishToMQTT(mqtt_topic_allowed, uid_hex);
  } else {
    // 卡片无效 - 显示拒绝信息
    Serial.println("Card Verification Failed - Access Denied!");
    displayDenied(uid_hex);
    blinkLED(3);  // LED 闪烁3次
    buzzerBeep(3, 100);  // 失败鸣叫3次
    
    // 发布到 MQTT
    publishToMQTT(mqtt_topic_denied, uid_hex);
  }
  
  delay(500);
  displayCardCount();
  
  // 停止卡片通信
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

// ==================== RFID 读卡函数 ====================
/**
 * 验证卡片 - 读取第15扇区第2块，检查特征码
 */
bool verifyCard(byte* uid, byte uidSize) {
  // 验证 UID 大小
  if (uidSize < 4) {
    return false;
  }
  
  // 验证第15扇区第2块的特征码
  return readCardSignature(uid, uidSize);
}

/**
 * 读取卡片第15扇区第2块的数据
 */
bool readCardSignature(byte* uid, byte uidSize) {
  // 确保 UID 正确
  if (mfrc522.uid.uidByte[0] != uid[0]) {
    return false;
  }
  
  // 使用密钥认证
  MFRC522::MIFARE_Key key;
  for (byte i = 0; i < 6; i++) {
    key.keyByte[i] = MFRC522_KEY[i];
  }
  
  // 选择扇区（第15扇区，块地址为62）
  MFRC522::StatusCode status = mfrc522.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, TARGET_BLOCK_ADDRESS, &key, &mfrc522.uid);
  
  if (status != MFRC522::STATUS_OK) {
    Serial.print("Authentication failed: ");
    Serial.println(mfrc522.GetStatusCodeName(status));
    return false;
  }
  
  // 读取数据
  byte buffer[18];
  byte size = sizeof(buffer);
  status = mfrc522.MIFARE_Read(TARGET_BLOCK_ADDRESS, buffer, &size);
  
  if (status != MFRC522::STATUS_OK) {
    Serial.print("Reading failed: ");
    Serial.println(mfrc522.GetStatusCodeName(status));
    mfrc522.PCD_StopCrypto1();
    return false;
  }
  
  Serial.println("Block Data (Hex):");
  for (byte i = 0; i < 16; i++) {
    Serial.print(buffer[i] < 0x10 ? " 0" : " ");
    Serial.print(buffer[i], HEX);
  }
  Serial.println();
  
  // 验证前三字节是否匹配特征码
  bool valid = (buffer[0] == VALID_CARD_SIGNATURE[0] &&
                buffer[1] == VALID_CARD_SIGNATURE[1] &&
                buffer[2] == VALID_CARD_SIGNATURE[2]);
  
  mfrc522.PCD_StopCrypto1();
  return valid;
}

// ==================== LED 和蜂鸣器函数 ====================
void blinkLED(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
}

void buzzerBeep(int times, int duration) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duration);
    digitalWrite(BUZZER_PIN, LOW);
    delay(duration);
  }
}

// ==================== OLED 显示函数 ====================
void displayWelcome(String uid) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Welcome!");
  display.println("Access");
  display.println("Granted");
  
  display.setTextSize(1);
  display.println("");
  display.print("UID: ");
  display.println(uid);
  
  display.display();
  delay(2000);
}

void displayDenied(String uid) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Access");
  display.println("Denied!");
  
  display.setTextSize(1);
  display.println("");
  display.print("UID: ");
  display.println(uid);
  
  display.display();
  delay(2000);
}

void displayCardCount() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  
  display.println("RFID Access System");
  display.println("================");
  display.print("Card Count: ");
  display.println(card_count);
  display.println("");
  display.println("Waiting for card...");
  
  display.display();
}

void updateDisplay() {
  displayCardCount();
}

// ==================== WiFi 和 MQTT 函数 ====================
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  Serial.println("");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connection failed");
  }
}

void setupMQTT() {
  client.setServer(mqtt_server, mqtt_port);
  reconnectMQTT();
}

void reconnectMQTT() {
  int attempts = 0;
  while (!client.connected() && attempts < 5) {
    Serial.print("Attempting MQTT connection...");
    
    if (client.connect("RFID_Access_Control", mqtt_user, mqtt_password)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
    attempts++;
  }
}

void publishToMQTT(const char* topic, String message) {
  if (client.connected()) {
    client.publish(topic, message.c_str());
    Serial.print("Published to ");
    Serial.print(topic);
    Serial.print(": ");
    Serial.println(message);
  }
}

// ==================== 工具函数 ====================
String byteArrayToHex(byte* buffer, byte bufferSize) {
  String result = "";
  for (byte i = 0; i < bufferSize; i++) {
    if (buffer[i] < 0x10) {
      result += "0";
    }
    result += String(buffer[i], HEX);
    if (i < bufferSize - 1) {
      result += ":";
    }
  }
  return result;
}