/**
 * 智能共享单车系统 - ESP8266 固件
 *
 * 功能：
 * - RFID 卡片读取（开锁/还车）
 * - GPS 实时定位
 * - MQTT 通信（心跳包、指令、GPS 上报）
 * - OLED 显示屏（3 个界面）
 * - 蜂鸣器和 LED 反馈
 *
 * 硬件：ESP8266 NodeMCU + RC522 + NEO-6M + SSD1306 + 蜂鸣器
 *
 * 作者：Claude
 * 日期：2025-01-11
 * 版本：v1.0
 */

// =========================== 库引入 ===========================
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <TinyGPS++.h>
#include <U8g2lib.h>

// =========================== 配置参数 ===========================

// WiFi 配置
const char* WIFI_SSID = "your_wifi_ssid";        // 请修改为你的 WiFi SSID
const char* WIFI_PASSWORD = "your_wifi_password"; // 请修改为你的 WiFi 密码

// MQTT 配置
const char* MQTT_BROKER = "broker.emqx.io";      // MQTT Broker 地址
const int MQTT_PORT = 1883;                      // MQTT 端口
const char* MQTT_CLIENT_ID = "bike_001";         // 客户端 ID（对应车辆编号）
const char* MQTT_USERNAME = "";                  // MQTT 用户名（公共 broker 留空）
const char* MQTT_PASSWORD = "";                  // MQTT 密码（公共 broker 留空）

// 主题配置
const char* TOPIC_HEARTBEAT = "bike/001/heartbeat";     // 心跳包
const char* TOPIC_AUTH = "bike/001/auth";               // 认证请求
const char* TOPIC_GPS = "bike/001/gps";                 // GPS 上报
const char* TOPIC_COMMAND = "server/001/command";       // 服务器指令

// 后端 API 配置
const char* API_SERVER = "192.168.1.100";        // 后端服务器 IP（请修改）
const int API_PORT = 8000;                       // API 端口

// 引脚定义
#define RFID_SDA_PIN 0    // D3 - GPIO0
#define RFID_RST_PIN -1   // 不使用，接 3.3V
#define GPS_RX_PIN 3     // RX - GPIO3
#define GPS_TX_PIN 1     // TX - GPIO1
#define BUZZER_PIN 4     // D2 - GPIO4

// OLED 引脚（SPI）
#define OLED_SCK_PIN 5   // D1 - GPIO5
#define OLED_SDA_PIN 14  // D5 - GPIO14
#define OLED_RES_PIN 16  // D0 - GPIO16
#define OLED_DC_PIN 2    // D4 - GPIO2
#define OLED_CS_PIN 15   // D8 - GPIO15

// 时间配置（毫秒）
const unsigned long HEARTBEAT_INTERVAL = 10000;    // 心跳间隔 10 秒
const unsigned long GPS_REPORT_INTERVAL = 5000;    // GPS 上报间隔 5 秒
const unsigned long WIFI_RETRY_INTERVAL = 20000;   // WiFi 重连间隔 20 秒
const unsigned long MQTT_RETRY_INTERVAL = 5000;    // MQTT 重连间隔 5 秒
const unsigned long DISPLAY_UPDATE_INTERVAL = 1000; // OLED 刷新间隔 1 秒

// 费用配置
const float PRICE_PER_MINUTE = 0.1;               // 每分钟 0.1 元
const float MIN_BALANCE = 1.0;                     // 最低余额 1 元

// =========================== 全局变量 ===========================

// WiFi 和 MQTT 客户端
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// GPS 和 RFID
TinyGPSPlus gps;
HardwareSerial GPSSerial(1); // Serial1
MFRC522 rfid(RFID_SDA_PIN, RFID_RST_PIN);

// OLED 显示器（4 线 SPI）
U8G2_SSD1306_128X64_NONAME_F_4W_SW_SPI u8g2(
  U8G2_R0,
  /* clock=*/ OLED_SCK_PIN,
  /* data=*/ OLED_SDA_PIN,
  /* cs=*/ OLED_CS_PIN,
  /* dc=*/ OLED_DC_PIN,
  /* reset=*/ OLED_RES_PIN
);

// 状态变量
enum BikeState {
  STATE_IDLE,       // 待机状态
  STATE_RIDING,     // 骑行状态
  STATE_PROCESSING  // 处理中（开锁/还车）
};

BikeState currentState = STATE_IDLE;

// 订单数据
String currentCardUID = "";      // 当前刷卡的 UID
String currentUserID = "";       // 当前用户 ID
float currentBalance = 0.0;      // 当前余额
unsigned long rideStartTime = 0; // 骑行开始时间
int currentOrderID = 0;          // 当前订单 ID

// GPS 数据
float currentLat = 0.0;
float currentLng = 0.0;
bool gpsValid = false;

// 计时器
unsigned long lastHeartbeatTime = 0;
unsigned long lastGPSReportTime = 0;
unsigned long lastWifiRetryTime = 0;
unsigned long lastMqttRetryTime = 0;
unsigned long lastDisplayUpdate = 0;

// 显示数据
String displayMessage = "";
String displaySubMessage = "";

// =========================== 函数声明 ===========================
void setupWiFi();
void setupMQTT();
void setupRFID();
void setupGPS();
void setupOLED();
void setupBuzzer();

void loopWiFi();
void loopMQTT();
void loopRFID();
void loopGPS();
void loopOLED();
void loopBuzzer();

void mqttCallback(char* topic, byte* payload, unsigned int length);
void sendHeartbeat();
void sendGPSReport();
void sendAuthRequest(String action, String cardUID);
bool processServerResponse(WiFiClient& client);

void updateOLEDIdle();
void updateOLEDRiding();
void updateOLEDProcessing();
void drawCenteredText(const char* text, int y);
void drawProgressBar(int progress);

void playBeep(int times, int duration);
void controlBuzzer(bool state);

String getRFIDUID();
String formatFloat(float value, int decimals);

// =========================== 初始化函数 ===========================

/**
 * 初始化函数（上电后只执行一次）
 */
void setup() {
  // 初始化串口
  Serial.begin(9600);
  Serial.println();
  Serial.println(F("================================="));
  Serial.println(F("智能共享单车系统"));
  Serial.println(F("版本: v1.0"));
  Serial.println(F("日期: 2025-01-11"));
  Serial.println(F("================================="));

  // 初始化各模块
  setupBuzzer();
  setupOLED();
  setupRFID();
  setupGPS();
  setupWiFi();
  setupMQTT();
  displayMessage = "系统启动中...";
  displaySubMessage = "请稍候";

  delay(2000);
  Serial.println(F(" 系统初始化完成"));
  displayMessage = "待机中";
  displaySubMessage = "请刷卡解锁";
}

/**
 * WiFi 初始化
 */
void setupWiFi() {
  Serial.println(F("📡 连接 WiFi..."));

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // 等待连接（最多 30 秒）
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print(F(" WiFi 已连接: "));
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println(F(" WiFi 连接失败，将尝试重连"));
  }
}

/**
 * MQTT 初始化
 */
void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  Serial.println(F("📡 MQTT 已配置"));
}

/**
 * RFID 读卡器初始化
 */
void setupRFID() {
  SPI.begin();
  rfid.PCD_Init();
  rfid.PCD_SetAntennaGain(rfid.RxGain_max);

  Serial.print(F(" RFID 版本: 0x"));
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.println(version, HEX);

  if (version == 0x00 || version == 0xFF) {
    Serial.println(F("  警告: RFID 读卡器未检测到"));
  } else {
    Serial.println(F(" RFID 读卡器已就绪"));
  }
}

/**
 * GPS 模块初始化
 */
void setupGPS() {
  GPSSerial.begin(9600);  // NEO-6M 默认波特率
  Serial.println(F(" GPS 模块已启动"));
  Serial.println(F(" 等待 GPS 定位（需要 1-5 分钟）..."));
}

/**
 * OLED 显示屏初始化
 */
void setupOLED() {
  u8g2.begin();
  u8g2.enableUTF8Print();
  u8g2.setContrast(128); // 对比度 0-255
  Serial.println(F(" OLED 显示屏已就绪"));

  // 显示启动画面
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB14_tr);
  drawCenteredText("智能共享单车", 20);
  u8g2.setFont(u8g2_font_ncenB10_tr);
  drawCenteredText("系统启动中...", 45);
  u8g2.sendBuffer();
}

/**
 * 蜂鸣器初始化
 */
void setupBuzzer() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println(F(" 蜂鸣器已就绪"));
}

// =========================== 主循环函数 ===========================

/**
 * 主循环函数（一直重复执行）
 */
void loop() {
  // 处理 WiFi 连接
  loopWiFi();

  // 处理 MQTT 连接和消息
  loopMQTT();

  // 处理 GPS 数据
  loopGPS();

  // 处理 RFID 读卡
  loopRFID();

  // 更新 OLED 显示
  loopOLED();

  // 处理定时任务
  unsigned long currentMillis = millis();

  // 心跳包发送
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    if (mqttClient.connected()) {
      sendHeartbeat();
      lastHeartbeatTime = currentMillis;
    }
  }

  // GPS 数据上报
  if (currentMillis - lastGPSReportTime >= GPS_REPORT_INTERVAL) {
    if (mqttClient.connected() && currentState == STATE_RIDING) {
      sendGPSReport();
      lastGPSReportTime = currentMillis;
    }
  }

  // 短延时（防止 watchdog 重启）
  delay(10);
}

// =========================== WiFi 处理 ===========================

/**
 * WiFi 循环处理（自动重连）
 */
void loopWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long currentMillis = millis();

    // 定时尝试重连
    if (currentMillis - lastWifiRetryTime >= WIFI_RETRY_INTERVAL) {
      Serial.println(F(" 尝试重新连接 WiFi..."));
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      lastWifiRetryTime = currentMillis;
    }
  }
}

// =========================== MQTT 处理 ===========================

/**
 * MQTT 循环处理（自动重连和消息接收）
 */
void loopMQTT() {
  // 如果未连接，尝试连接
  if (!mqttClient.connected()) {
    unsigned long currentMillis = millis();

    if (currentMillis - lastMqttRetryTime >= MQTT_RETRY_INTERVAL) {
      Serial.println(F(" 尝试连接 MQTT Broker..."));

      // 生成随机 Client ID
      String clientId = "bike_001_";
      clientId += String(random(0xffff), HEX);

      if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
        Serial.println(F(" MQTT 已连接"));

        // 订阅指令主题
        mqttClient.subscribe(TOPIC_COMMAND);
        Serial.print(F(" 已订阅主题: "));
        Serial.println(TOPIC_COMMAND);
      } else {
        Serial.print(F(" MQTT 连接失败, rc="));
        Serial.println(mqttClient.state());
      }

      lastMqttRetryTime = currentMillis;
    }
  } else {
    // 已连接，处理循环
    mqttClient.loop();
  }
}

/**
 * MQTT 消息回调函数
 */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print(F(" 收到 MQTT 消息 ["));
  Serial.print(topic);
  Serial.print(F("]: "));

  // 将 payload 转换为字符串
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  Serial.println(message);

  // 解析 JSON
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print(F(" JSON 解析失败: "));
    Serial.println(error.c_str());
    return;
  }

  // 提取指令
  const char* action = doc["action"];  // unlock, lock, force_lock

  if (strcmp(action, "unlock") == 0) {
    // 开锁指令
    int order_id = doc["order_id"];
    float balance = doc["balance"];

    Serial.print(F(" 收到开锁指令，订单 ID: "));
    Serial.println(order_id);

    // 更新状态
    currentState = STATE_RIDING;
    currentOrderID = order_id;
    currentBalance = balance;
    rideStartTime = millis();

    // 播放提示音
    playBeep(3, 150);

    // 显示骑行界面
    displayMessage = "骑行中";
    displaySubMessage = "再次刷卡还车";

  } else if (strcmp(action, "lock") == 0) {
    // 关锁指令
    float cost = doc["cost"];
    float new_balance = doc["new_balance"];
    int duration = doc["duration_minutes"];

    Serial.print(F(" 收到关锁指令，费用: "));
    Serial.print(cost);
    Serial.println(F(" 元"));

    // 显示结算信息
    char buffer[64];
    sprintf(buffer, "费用:%.2f元 余额:%.2f", cost, new_balance);
    displayMessage = "还车成功";
    displaySubMessage = buffer;

    // 播放提示音
    playBeep(2, 200);

    delay(3000); // 显示结算信息 3 秒

    // 返回待机状态
    currentState = STATE_IDLE;
    currentCardUID = "";
    currentUserID = "";
    currentOrderID = 0;
    displayMessage = "待机中";
    displaySubMessage = "请刷卡解锁";
  }
}

// =========================== GPS 处理 ===========================

/**
 * GPS 循环处理（解析 NMEA 数据）
 */
void loopGPS() {
  while (GPSSerial.available() > 0) {
    gps.encode(GPSSerial.read());
  }

  // 更新当前坐标
  if (gps.location.isUpdated()) {
    currentLat = gps.location.lat();
    currentLng = gps.location.lng();
    gpsValid = true;
  }

  // 检查 GPS 数据是否正常接收
  static unsigned long lastGPSCheck = 0;
  if (millis() - lastGPSCheck > 60000) {  // 每分钟检查一次
    if (gps.charsProcessed() < 10) {
      Serial.println(F("  警告: GPS 未接收到数据"));
      gpsValid = false;
    }
    lastGPSCheck = millis();
  }
}

// =========================== RFID 处理 ===========================

/**
 * RFID 循环处理（读取卡片）
 */
void loopRFID() {
  // 如果正在处理中，不读取新卡
  if (currentState == STATE_PROCESSING) {
    return;
  }

  // 检查是否有新卡
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }

  // 读取卡片序列号
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  // 获取卡片 UID
  String cardUID = getRFIDUID();
  Serial.print(F(" 检测到卡片: "));
  Serial.println(cardUID);

  // 播放提示音
  playBeep(1, 100);

  // 根据当前状态处理
  if (currentState == STATE_IDLE) {
    // 待机状态：开锁请求
    handleUnlockRequest(cardUID);
  } else if (currentState == STATE_RIDING) {
    // 骑行状态：还车请求
    if (cardUID == currentCardUID) {
      handleLockRequest(cardUID);
    } else {
      Serial.println(F("  警告: 卡片不匹配"));
      displayMessage = "卡片不匹配";
      displaySubMessage = "请使用原卡片";
      playBeep(3, 50); // 错误提示音
      delay(2000);
      displayMessage = "骑行中";
      displaySubMessage = "再次刷卡还车";
    }
  }

  // 停止读卡
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

/**
 * 处理开锁请求
 */
void handleUnlockRequest(String cardUID) {
  Serial.println(F(" 处理开锁请求..."));

  // 更新状态
  currentState = STATE_PROCESSING;
  currentCardUID = cardUID;

  // 显示处理中
  displayMessage = "验证中...";
  displaySubMessage = "请稍候";

  // 发送认证请求到后端 API
  sendAuthRequest("unlock", cardUID);
}

/**
 * 处理还车请求
 */
void handleLockRequest(String cardUID) {
  Serial.println(F(" 处理还车请求..."));

  // 更新状态
  currentState = STATE_PROCESSING;

  // 显示处理中
  displayMessage = "结算中...";
  displaySubMessage = "请稍候";

  
  currentState = STATE_IDLE;
}

// =========================== HTTP 请求 ===========================

/**
 * 发送认证请求到后端 API
 */
void sendAuthRequest(String action, String cardUID) {
  Serial.println(F(" 发送 HTTP 请求..."));

  // 连接后端服务器
  WiFiClient client;
  if (!client.connect(API_SERVER, API_PORT)) {
    Serial.println(F(" 无法连接到后端服务器"));
    displayMessage = "连接失败";
    displaySubMessage = "请检查网络";
    currentState = STATE_IDLE;
    return;
  }

  // 构造 JSON 请求体
  StaticJsonDocument<256> doc;
  doc["rfid_card"] = cardUID;
  doc["lat"] = currentLat;
  doc["lng"] = currentLng;

  String postData;
  serializeJson(doc, postData);

  // 发送 HTTP POST 请求
  client.print(String("POST /api/orders/unlock HTTP/1.1\r\n") +
               String("Host: ") + API_SERVER + "\r\n" +
               String("Content-Type: application/json\r\n") +
               String("Content-Length: ") + postData.length() + "\r\n\r\n" +
               postData);

  Serial.println(F(" 请求已发送"));

  // 处理响应
  bool success = processServerResponse(client);
  client.stop();

  if (!success) {
    Serial.println(F(" 认证失败"));
    displayMessage = "认证失败";
    displaySubMessage = "请重试";
    playBeep(3, 50);
    delay(2000);
    currentState = STATE_IDLE;
    displayMessage = "待机中";
    displaySubMessage = "请刷卡解锁";
  }
}

/**
 * 处理服务器响应
 */
bool processServerResponse(WiFiClient& client) {
  // 等待响应（超时 5 秒）
  unsigned long timeout = millis();
  while (client.available() == 0) {
    if (millis() - timeout > 5000) {
      Serial.println(F(" 请求超时"));
      return false;
    }
  }

  // 跳过 HTTP 头
  bool blankLine = false;
  while (client.available()) {
    String line = client.readStringUntil('\r');
    if (line == "\n") {
      if (blankLine) break;
      blankLine = true;
    }
  }

  // 读取响应体
  String responseBody = client.readString();
  Serial.println(F(" 收到响应:"));
  Serial.println(responseBody);

  // 解析 JSON
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, responseBody);

  if (error) {
    Serial.print(F(" JSON 解析失败: "));
    Serial.println(error.c_str());
    return false;
  }

  // 检查响应状态
  bool success = doc["success"];
  if (!success) {
    const char* message = doc["message"];
    Serial.print(F(" 服务器返回错误: "));
    Serial.println(message);
    displayMessage = message;
    return false;
  }

  // 提取数据
  currentUserID = doc["user_id"].as<String>();
  currentBalance = doc["balance"];
  currentOrderID = doc["order_id"];

  Serial.print(F(" 认证成功，订单 ID: "));
  Serial.println(currentOrderID);

  // 更新状态
  currentState = STATE_RIDING;
  rideStartTime = millis();

  // 播放成功提示音
  playBeep(3, 150);

  // 显示骑行界面
  displayMessage = "骑行中";
  displaySubMessage = "再次刷卡还车";

  return true;
}

// =========================== MQTT 消息发送 ===========================

/**
 * 发送心跳包
 */
void sendHeartbeat() {
  StaticJsonDocument<256> doc;
  doc["timestamp"] = millis();
  doc["lat"] = currentLat;
  doc["lng"] = currentLng;
  doc["battery"] = 100; // TODO: 读取实际电池电量
  doc["status"] = (currentState == STATE_RIDING) ? "riding" : "idle";

  String message;
  serializeJson(doc, message);

  if (mqttClient.publish(TOPIC_HEARTBEAT, message.c_str())) {
    Serial.println(F(" 心跳包已发送"));
  } else {
    Serial.println(F(" 心跳包发送失败"));
  }
}

/**
 * 发送 GPS 上报
 */
void sendGPSReport() {
  StaticJsonDocument<256> doc;
  doc["lat"] = currentLat;
  doc["lng"] = currentLng;
  doc["mode"] = "real";  // real 或 simulation
  doc["timestamp"] = millis();

  String message;
  serializeJson(doc, message);

  if (mqttClient.publish(TOPIC_GPS, message.c_str())) {
    Serial.print(F(" GPS 已上报: "));
    Serial.print(currentLat, 6);
    Serial.print(F(", "));
    Serial.println(currentLng, 6);
  } else {
    Serial.println(F(" GPS 上报失败"));
  }
}

// =========================== OLED 显示 ===========================

/**
 * OLED 循环处理（根据状态更新显示）
 */
void loopOLED() {
  unsigned long currentMillis = millis();

  // 定时刷新显示
  if (currentMillis - lastDisplayUpdate >= DISPLAY_UPDATE_INTERVAL) {
    u8g2.clearBuffer();

    if (currentState == STATE_IDLE) {
      updateOLEDIdle();
    } else if (currentState == STATE_RIDING) {
      updateOLEDRiding();
    } else if (currentState == STATE_PROCESSING) {
      updateOLEDProcessing();
    }

    u8g2.sendBuffer();
    lastDisplayUpdate = currentMillis;
  }
}

/**
 * 更新待机界面
 */
void updateOLEDIdle() {
  // 标题
  u8g2.setFont(u8g2_font_ncenB14_tr);
  drawCenteredText("智能共享单车", 15);

  // WiFi 状态
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.setCursor(0, 35);
  u8g2.print("WiFi: ");
  u8g2.print(WiFi.status() == WL_CONNECTED ? "已连接" : "断开");

  // GPS 状态
  u8g2.setCursor(0, 48);
  u8g2.print("GPS: ");
  if (gpsValid) {
    u8g2.print(currentLat, 4);
    u8g2.print(",");
    u8g2.print(currentLng, 4);
  } else {
    u8g2.print("搜索中...");
  }

  // 提示信息
  u8g2.setFont(u8g2_font_ncenB10_tr);
  drawCenteredText(displayMessage.c_str(), 60);
}

/**
 * 更新骑行界面
 */
void updateOLEDRiding() {
  // 标题
  u8g2.setFont(u8g2_font_ncenB14_tr);
  drawCenteredText("骑行中", 15);

  // 骑行时长
  unsigned long rideDuration = (millis() - rideStartTime) / 1000 / 60; // 分钟
  u8g2.setFont(u8g2_font_ncenB12_tr);
  u8g2.setCursor(10, 35);
  u8g2.print("时长: ");
  u8g2.print(rideDuration);
  u8g2.print(" 分钟");

  // 预计费用
  float cost = rideDuration * PRICE_PER_MINUTE;
  u8g2.setCursor(10, 50);
  u8g2.print("费用: ");
  u8g2.print(cost, 1);
  u8g2.print(" 元");

  // 余额
  u8g2.setCursor(10, 65);
  u8g2.print("余额: ");
  u8g2.print(currentBalance, 1);
  u8g2.print(" 元");
}

/**
 * 更新处理中界面
 */
void updateOLEDProcessing() {
  u8g2.setFont(u8g2_font_ncenB14_tr);
  drawCenteredText(displayMessage.c_str(), 30);

  u8g2.setFont(u8g2_font_ncenB10_tr);
  drawCenteredText(displaySubMessage.c_str(), 50);

  // 加载动画
  static int progress = 0;
  progress = (progress + 10) % 100;
  drawProgressBar(progress);
}

/**
 * 绘制居中文本
 */
void drawCenteredText(const char* text, int y) {
  int16_t width = u8g2.getUTF8Width(text);
  int16_t x = (128 - width) / 2;
  u8g2.setCursor(x, y);
  u8g2.print(text);
}

/**
 * 绘制进度条
 */
void drawProgressBar(int progress) {
  int barWidth = 100;
  int barHeight = 10;
  int x = (128 - barWidth) / 2;
  int y = 60;

  // 边框
  u8g2.drawFrame(x, y, barWidth, barHeight);

  // 填充
  int fillWidth = (barWidth * progress) / 100;
  u8g2.drawBox(x, y, fillWidth, barHeight);
}

// =========================== 蜂鸣器控制 ===========================

/**
 * 蜂鸣器循环处理（暂无实际功能）
 */
void loopBuzzer() {
  // 蜂鸣器控制是直接调用，无需循环处理
}

/**
 * 播放提示音
 * @param times 播放次数
 * @param duration 每次持续时间（毫秒）
 */
void playBeep(int times, int duration) {
  for (int i = 0; i < times; i++) {
    controlBuzzer(true);
    delay(duration);
    controlBuzzer(false);
    if (i < times - 1) {
      delay(100);
    }
  }
}

/**
 * 控制蜂鸣器开关
 * @param state true=开, false=关
 */
void controlBuzzer(bool state) {
  digitalWrite(BUZZER_PIN, state ? HIGH : LOW);
}

// =========================== 辅助函数 ===========================

/**
 * 获取 RFID 卡片 UID
 */
String getRFIDUID() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

/**
 * 格式化浮点数
 */
String formatFloat(float value, int decimals) {
  String result = "";
  char buffer[16];
  dtostrf(value, 0, decimals, buffer);
  result = buffer;
  return result;
}
// 发送还车请求到后端 API
  // 注意：这里应该调用后端的 /api/orders/lock 接口
  // 为简化，这里直接通过 MQTT 发送（实际项目中应该通过 HTTP API）

  StaticJsonDocument<256> doc;
  doc["action"] = "lock";
  doc["order_id"] = currentOrderID;
  doc["rfid_card"] = cardUID;
  doc["end_lat"] = currentLat;
  doc["end_lng"] = currentLng;

  String message;
  serializeJson(doc, message);

  // 实际项目中这里应该发送 HTTP POST 请求
  // mqttClient.publish("bike/001/lock", message.c_str());

  Serial.println(F("  注意: 还车功能需要后端 API 支持"));