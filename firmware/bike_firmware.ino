/**
 * 智能共享单车系统 - ESP8266 固件
 *
 * 功能：
 * - RFID 卡片读取（开锁/还车）
 * - GPS 实时定位（支持GPS+北斗+GLONASS多星定位）
 * - MQTT 通信（心跳包、指令、GPS 上报）
 * - OLED 显示屏（3 个界面）
 * - 蜂鸣器和 LED 反馈
 *
 * 硬件：ESP8266 NodeMCU + RC522 + ATGM336H + SSD1306 + 蜂鸣器
 */

// =========================== 库引入 ===========================
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <TinyGPS++.h>
#include <SoftwareSerial.h> // GPS 使用软件串口
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =========================== 配置参数 ===========================

// WiFi 配置
const char *WIFI_SSID = "P60";          // 请修改为你的 WiFi SSID
const char *WIFI_PASSWORD = "66668888"; // 请修改为你的 WiFi 密码

// MQTT 配置
const char *MQTT_BROKER = "broker.emqx.io"; // MQTT Broker 地址
const int MQTT_PORT = 1883;                 // MQTT 端口
const char *MQTT_CLIENT_ID = "bike_001";    // 客户端 ID（对应车辆编号）
const char *MQTT_USERNAME = "";             // MQTT 用户名（公共 broker 留空）
const char *MQTT_PASSWORD = "";             // MQTT 密码（公共 broker 留空）

// 主题配置
const char *TOPIC_HEARTBEAT = "bike/001/heartbeat"; // 心跳包
const char *TOPIC_AUTH = "bike/001/auth";           // 认证请求
const char *TOPIC_GPS = "bike/001/gps";             // GPS 上报
const char *TOPIC_COMMAND = "server/001/command";   // 服务器指令

// 后端 API 配置
const char *API_SERVER = "192.168.43.66"; // 后端服务器 IP（请修改）
const int API_PORT = 8000;                // API 端口

// 引脚定义
// RC522 RFID 引脚(硬件SPI)
#define RFID_SDA_PIN 15 // D8 - GPIO15 (CS)
#define RFID_RST_PIN -1 // RST 不使用（某些 RC522 模块可以不连接 RST）
// 硬件SPI固定引脚：
// SCK  = GPIO14 (D5)
// MOSI = GPIO13 (D7)
// MISO = GPIO12 (D6) - 被蜂鸣器占用，RC522只能读UID

// GPS 引脚配置（使用硬件串口）
// ATGM336H GPS模块支持GPS+北斗+GLONASS多星定位
// 默认波特率：9600
// 供电：3.3V-5.0V
// 接线方式：GPS TX → NodeMCU RX (GPIO3)
// ⚠️ 上传程序时必须断开 GPS TX，上传后再连接！
#define GPS_BAUD 9600 // GPS 波特率

// 蜂鸣器/LED引脚
#define BUZZER_PIN 4   // D2 - GPIO4
#define LED_PIN 16     // D0 - GPIO16（骑行状态指示灯）
// 注意：GPIO12 (MISO) 用于 RC522

// OLED 引脚（软件SPI，与RC522共用硬件SPI引脚）
#define OLED_CLK 14  // D5 - GPIO14 (SCK，与RC522共用)
#define OLED_MOSI 13 // D7 - GPIO13 (MOSI，与RC522共用)
#define OLED_RST 2   // D4 - GPIO2 (RES)
#define OLED_DC 5    // D1 - GPIO5 (DC)
#define OLED_CS 0    // D3 - GPIO0 (CS)

// OLED屏幕尺寸
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// SPI总线引脚说明：
// GPIO5 (D1)  → SCK  (RFID + OLED共用)
// GPIO14 (D5) → MOSI (RFID + OLED共用)
// GPIO12 (D6) → MISO (仅RFID使用)

// 时间配置（毫秒）
const unsigned long HEARTBEAT_INTERVAL = 10000;     // 心跳间隔 10 秒
const unsigned long GPS_REPORT_INTERVAL = 5000;     // GPS 上报间隔 5 秒
const unsigned long WIFI_RETRY_INTERVAL = 20000;    // WiFi 重连间隔 20 秒
const unsigned long MQTT_RETRY_INTERVAL = 5000;     // MQTT 重连间隔 5 秒
const unsigned long DISPLAY_UPDATE_INTERVAL = 1000; // OLED 刷新间隔 1 秒

// 费用配置
const float PRICE_PER_MINUTE = 0.6; // 每分钟 0.6 元 (0.01元/秒，方便查看实时计费效果)
const float MIN_BALANCE = 1.0;      // 最低余额 1 元

// =========================== 全局变量 ===========================

// WiFi 和 MQTT 客户端
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// GPS 和 RFID
TinyGPSPlus gps; // GPS 对象（使用硬件串口）
MFRC522 rfid(RFID_SDA_PIN, RFID_RST_PIN);

// OLED 显示器（软件SPI接口，与RC522共用硬件SPI引脚）
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &SPI, OLED_DC, OLED_RST, OLED_CS);

// 状态变量
enum BikeState
{
  STATE_IDLE,      // 待机状态
  STATE_RIDING,    // 骑行状态
  STATE_PROCESSING // 处理中（开锁/还车）
};

BikeState currentState = STATE_IDLE;

// 订单数据
String currentCardUID = "";      // 当前刷卡的 UID
String currentUserID = "";       // 当前用户 ID
float currentBalance = 0.0;      // 当前余额
unsigned long rideStartTime = 0; // 骑行开始时间
int currentOrderID = 0;          // 当前订单 ID

// GPS 数据（混合模式：真实起始坐标 + 模拟移动）
// 目标百度坐标: 30.313506, 120.395996 (杭州钱塘区)
// 反向计算得到的WGS84坐标
float currentLat = 30.307645;  // 当前纬度
float currentLng = 120.389866;  // 当前经度
float startLat = 30.307645;    // 起始位置纬度（从 GPS 读取）
float startLng = 120.389866;    // 起始位置经度（从 GPS 读取）
bool gpsValid = true;   // GPS 定位是否有效（设为true以便测试）

// GPS 统计数据
unsigned long gpsCharsProcessed = 0;  // 已处理的 GPS 字符数
int gpsSatellites = 0;               // GPS 卫星数量
double gpsAltitude = 0.0;            // 海拔高度（米）
double gpsSpeed = 0.0;               // 速度（km/h）

// 模拟移动参数（骑行时使用）
const float MOVE_STEP = 0.0001;       // 每次移动的步长（约11米）
unsigned long lastMoveTime = 0;
const unsigned long MOVE_INTERVAL = 3000; // 每3秒移动一次
bool useSimulation = false;          // 是否启用模拟移动模式

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

void mqttCallback(char *topic, byte *payload, unsigned int length);
void sendHeartbeat();
void sendGPSReport();
void sendAuthRequest(String action, String cardUID);
void sendLockRequest(String cardUID);
bool processServerResponse(WiFiClient &client);
bool processLockResponse(WiFiClient &client);

void updateOLEDIdle();
void updateOLEDRiding();
void updateOLEDProcessing();
void drawCenteredText(const char *text, int y, int size);
void drawProgressBar(int progress);

void playBeep(int times, int duration);
void controlBuzzer(bool state);

String getRFIDUID();
String formatFloat(float value, int decimals);

// =========================== 初始化函数 ===========================

/**
 * 初始化函数（上电后只执行一次）
 */
void setup()
{
  // *** 关键修复：按 SPI/I2C 冲突文章建议，先配置所有片选引脚 ***

  // 0. 蜂鸣器引脚 - 最先设置为低电平，防止上电时鸣响
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // LED 引脚 - 初始化为熄灭状态
  // 注意：GPIO16 (D0) 是反相逻辑（LOW=亮, HIGH=灭）
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // HIGH = 熄灭

  // 1. OLED CS (GPIO0) - 必须先拉高，否则进入烧录模式
  pinMode(OLED_CS, OUTPUT);
  digitalWrite(OLED_CS, HIGH);

  // 2. RC522 SS (GPIO15) - 拉高禁用，避免总线竞争
  pinMode(RFID_SDA_PIN, OUTPUT);
  digitalWrite(RFID_SDA_PIN, HIGH);

  // 3. OLED RES (GPIO2) - 启动时必须为 HIGH
  pinMode(OLED_RST, OUTPUT);
  digitalWrite(OLED_RST, HIGH);

  // 4. GPIO12 (MISO) - 配置为输入
  pinMode(12, INPUT);

  // 初始化串口（用于 GPS，9600 波特率）
  Serial.begin(GPS_BAUD);

  // 初始化各模块（顺序重要）
  setupBuzzer(); // 蜂鸣器初始化
  setupOLED();   // OLED显示屏
  setupRFID();   // RC522读卡器
  setupGPS();    // GPS模块
  setupWiFi();
  setupMQTT();
  displayMessage = "系统启动中...";
  displaySubMessage = "请稍候";

  delay(2000);
  displayMessage = "待机中";
  displaySubMessage = "请刷卡解锁";
}

/**
 * WiFi 初始化
 */
void setupWiFi()
{
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // 等待连接（最多 30 秒）
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30)
  {
    delay(1000);
    attempts++;
  }
}

/**
 * MQTT 初始化
 */
void setupMQTT()
{
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

/**
 * RFID 读卡器初始化
 * 注意：MISO被蜂鸣器占用，只能读取卡片UID，无法读取扇区数据
 * 这对共享单车项目足够（UID发送给后端验证）
 */
void setupRFID()
{
  // 先初始化 SPI 总线
  SPI.begin();

  // 确保 SS 引脚拉高后再初始化 RC522
  digitalWrite(RFID_SDA_PIN, HIGH);
  delay(10);

  rfid.PCD_Init();

  // 读取版本号验证通信
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
}

/**
 * GPS 模块初始化（使用硬件串口）
 */
void setupGPS()
{
  // 硬件串口已在 setup() 中初始化为 GPS_BAUD (9600)
  delay(1000);
}

/**
 * OLED 显示屏初始化
 */
void setupOLED()
{
  // 按文章建议：访问 I2C 设备前确保 SPI 处于非活动状态
  digitalWrite(RFID_SDA_PIN, HIGH);

  // 初始化OLED，使用软件SPI接口（通过&SPI参数使用硬件SPI引脚）
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
  {
    return;
  }

  // 显示启动画面
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  drawCenteredText("Smart Bike", 20, 2);
  drawCenteredText("Starting...", 45, 1);
  display.display();
}

/**
 * 蜂鸣器初始化
 * 注意：GPIO12 (MISO) 设为输入上拉以稳定SPI总线（不接MISO线）
 * 副作用：RC522无法读取扇区数据，只能读取UID（对本项目足够）
 */
void setupBuzzer()
{
  // 蜂鸣器已在setup()开始时初始化为低电平
}

// =========================== 主循环函数 ===========================

/**
 * 主循环函数（一直重复执行）
 */
void loop()
{
  // 处理 WiFi 连接
  loopWiFi();

  // 处理 MQTT 连接和消息
  loopMQTT();

  // 处理 GPS 数据
  loopGPS(); // 启用真实 GPS 读取

  // 处理 RFID 读卡
  loopRFID();

  // 更新 OLED 显示
  loopOLED();

  // 处理定时任务
  unsigned long currentMillis = millis();

  // 心跳包发送
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL)
  {
    if (mqttClient.connected())
    {
      sendHeartbeat();
      lastHeartbeatTime = currentMillis;
    }
  }

  // GPS 模拟移动（仅在骑行状态下）
  if (currentState == STATE_RIDING && useSimulation && currentMillis - lastMoveTime >= MOVE_INTERVAL)
  {
    // 模拟向东北方向移动
    currentLat += MOVE_STEP;
    currentLng += MOVE_STEP;

    lastMoveTime = currentMillis;
  }

  // GPS 数据上报
  if (currentMillis - lastGPSReportTime >= GPS_REPORT_INTERVAL)
  {
    if (mqttClient.connected() && currentState == STATE_RIDING)
    {
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
void loopWiFi()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    unsigned long currentMillis = millis();

    // 定时尝试重连
    if (currentMillis - lastWifiRetryTime >= WIFI_RETRY_INTERVAL)
    {
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
void loopMQTT()
{
  // 如果未连接，尝试连接
  if (!mqttClient.connected())
  {
    unsigned long currentMillis = millis();

    if (currentMillis - lastMqttRetryTime >= MQTT_RETRY_INTERVAL)
    {
      // 生成随机 Client ID
      String clientId = "bike_001_";
      clientId += String(random(0xffff), HEX);

      if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD))
      {
        // 订阅指令主题
        mqttClient.subscribe(TOPIC_COMMAND);
      }

      lastMqttRetryTime = currentMillis;
    }
  }
  else
  {
    // 已连接，处理循环
    mqttClient.loop();
  }
}

/**
 * MQTT 消息回调函数
 */
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  // 将 payload 转换为字符串
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';

  // 解析 JSON
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error)
  {
    return;
  }

  // 提取指令
  const char *action = doc["action"]; // unlock, lock, force_unlock, force_lock

  if (strcmp(action, "unlock") == 0)
  {
    // 开锁指令
    int order_id = doc["order_id"];
    float balance = doc["balance"];

    // 更新状态
    currentState = STATE_RIDING;
    currentOrderID = order_id;
    currentBalance = balance;
    rideStartTime = millis();
    controlLED(true); // 点亮LED（骑行中）

    // 启用模拟移动模式（从当前 GPS 位置开始模拟）
    useSimulation = true;

    // 播放提示音
    playBeep(3, 200);

    // 显示骑行界面
    displayMessage = "骑行中";
    displaySubMessage = "再次刷卡还车";
  }
  else if (strcmp(action, "lock") == 0)
  {
    // 关锁指令
    float cost = doc["cost"];
    float new_balance = doc["new_balance"];
    int duration = doc["duration_minutes"];

    // 显示结算信息
    char buffer[64];
    sprintf(buffer, "费用:%.2f元 余额:%.2f", cost, new_balance);
    displayMessage = "还车成功";
    displaySubMessage = buffer;

    // 播放提示音
    playBeep(2, 300);

    delay(3000); // 显示结算信息 3 秒

    // 返回待机状态
    currentState = STATE_IDLE;
    currentCardUID = "";
    currentUserID = "";
    currentOrderID = 0;
    useSimulation = false; // 关闭模拟模式，恢复 GPS 读取
    displayMessage = "待机中";
    displaySubMessage = "请刷卡解锁";
    controlLED(false); // 熄灭LED（空闲）
  }
  else if (strcmp(action, "force_unlock") == 0)
  {
    // 管理员远程强制开锁
    // 更新状态为骑行中
    currentState = STATE_RIDING;
    rideStartTime = millis();
    controlLED(true); // 点亮LED（骑行中）

    // 启用模拟移动模式（从当前 GPS 位置开始模拟）
    useSimulation = true;

    // 播放提示音
    playBeep(5, 150);

    // 显示信息
    displayMessage = "远程开锁";
    displaySubMessage = "管理员操作";

    // 立即发送心跳包，通知前端状态已更新
    if (mqttClient.connected())
    {
      sendHeartbeat();
    }
  }
  else if (strcmp(action, "force_lock") == 0)
  {
    // 管理员远程强制关锁
    // 播放提示音
    playBeep(5, 150);

    // 显示信息
    displayMessage = "远程关锁";
    displaySubMessage = "管理员操作";

    delay(3000); // 显示3秒

    // 返回待机状态
    currentState = STATE_IDLE;
    currentCardUID = "";
    currentUserID = "";
    currentOrderID = 0;
    useSimulation = false; // 关闭模拟模式，恢复 GPS 读取
    displayMessage = "待机中";
    displaySubMessage = "请刷卡解锁";
    controlLED(false); // 熄灭LED（空闲）

    // 立即发送心跳包，通知前端状态已更新
    if (mqttClient.connected())
    {
      sendHeartbeat();
    }
  }
}

// =========================== GPS 处理 ===========================

/**
 * GPS 循环处理（读取并解析 GPS 数据）
 * 混合模式：首次读取真实 GPS 作为起始坐标，骑行时使用模拟移动
 */
void loopGPS()
{
  // 从硬件串口读取 GPS 数据
  while (Serial.available() > 0)
  {
    char c = Serial.read();
    gps.encode(c);
    gpsCharsProcessed++;
  }

  // 仅在待机状态或首次启动时更新 GPS 数据（获取真实起始坐标）
  if (!useSimulation && gps.location.isUpdated())
  {
    currentLat = gps.location.lat();
    currentLng = gps.location.lng();

    // 首次获取有效位置时，记录为起始位置
    if (startLat == 0.0 && startLng == 0.0)
    {
      startLat = currentLat;
      startLng = currentLng;
    }

    gpsValid = true;
  }

  // 更新卫星数量
  if (gps.satellites.isUpdated())
  {
    gpsSatellites = gps.satellites.value();
  }

  // 更新海拔
  if (gps.altitude.isUpdated())
  {
    gpsAltitude = gps.altitude.meters();
  }

  // 更新速度
  if (gps.speed.isUpdated())
  {
    gpsSpeed = gps.speed.kmph();
  }
}

// =========================== RFID 处理 ===========================

/**
 * RFID 循环处理（读取卡片）
 */
void loopRFID()
{
  // 如果正在处理中，不读取新卡
  if (currentState == STATE_PROCESSING)
  {
    return;
  }

  // 按文章建议：操作 RC522 前启动 SPI 事务
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(RFID_SDA_PIN, LOW);

  // 检查是否有新卡
  if (!rfid.PICC_IsNewCardPresent())
  {
    digitalWrite(RFID_SDA_PIN, HIGH);
    SPI.endTransaction();
    return;
  }

  // 读取卡片序列号
  if (!rfid.PICC_ReadCardSerial())
  {
    digitalWrite(RFID_SDA_PIN, HIGH);
    SPI.endTransaction();
    return;
  }

  // 结束 SPI 事务
  digitalWrite(RFID_SDA_PIN, HIGH);
  SPI.endTransaction();

  // 获取卡片 UID
  String cardUID = getRFIDUID();

  // 播放提示音
  playBeep(1, 150);

  // 根据当前状态处理
  if (currentState == STATE_IDLE)
  {
    // 待机状态：开锁请求
    handleUnlockRequest(cardUID);
  }
  else if (currentState == STATE_RIDING)
  {
    // 骑行状态：还车请求
    if (cardUID == currentCardUID)
    {
      handleLockRequest(cardUID);
    }
    else
    {
      displayMessage = "卡片不匹配";
      displaySubMessage = "请使用原卡片";
      playBeep(3, 100); // 错误提示音
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
void handleUnlockRequest(String cardUID)
{

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
void handleLockRequest(String cardUID)
{

  // 更新状态
  currentState = STATE_PROCESSING;

  // 显示处理中
  displayMessage = "结算中...";
  displaySubMessage = "请稍候";

  // 发送还车请求到后端 API
  sendLockRequest(cardUID);
}

// =========================== HTTP 请求 ===========================

/**
 * 发送认证请求到后端 API
 */
void sendAuthRequest(String action, String cardUID)
{

  // 连接后端服务器
  WiFiClient client;
  if (!client.connect(API_SERVER, API_PORT))
  {
    displayMessage = "连接失败";
    displaySubMessage = "后端未启动";
    currentState = STATE_IDLE;
    controlLED(false); // 熄灭LED（空闲）
    playBeep(3, 100); // 错误提示音
    delay(3000);     // 显示3秒错误信息
    displayMessage = "待机中";
    displaySubMessage = "请刷卡解锁";
    return;
  }


  // 构造 JSON 请求体（使用6位小数精度，约0.1米）
  StaticJsonDocument<256> doc;
  doc["rfid_card"] = cardUID;
  doc["lat"] = String(currentLat, 6);  // 6位小数 = ~0.1米精度
  doc["lng"] = String(currentLng, 6);
  doc["bike_code"] = "BIKE_001"; // 添加车辆编号

  String postData;
  serializeJson(doc, postData);

  // 发送 HTTP POST 请求（使用硬件端专用接口）
  client.print(String("POST /api/hardware/unlock HTTP/1.1\r\n") +
               String("Host: ") + API_SERVER + "\r\n" +
               String("Content-Type: application/json\r\n") +
               String("Content-Length: ") + postData.length() + "\r\n\r\n" +
               postData);


  // 处理响应
  bool success = processServerResponse(client);
  client.stop();

  if (!success)
  {
    displayMessage = "认证失败";
    displaySubMessage = "请重试";
    playBeep(3, 50);
    delay(2000);
    currentState = STATE_IDLE;
    controlLED(false); // 熄灭LED（空闲）
    displayMessage = "待机中";
    displaySubMessage = "请刷卡解锁";
  }
}

/**
 * 发送还车请求到后端 API
 */
void sendLockRequest(String cardUID)
{
  // 防止重复还车：检查订单ID是否有效
  if (currentOrderID == 0)
  {
    displayMessage = "无有效订单";
    displaySubMessage = "请先开锁";
    playBeep(1, 150);
    delay(2000);
    currentState = STATE_IDLE;
    controlLED(false); // 熄灭LED（空闲）
    displayMessage = "待机中";
    displaySubMessage = "请刷卡解锁";
    return;
  }

  // 连接后端服务器
  WiFiClient client;
  if (!client.connect(API_SERVER, API_PORT))
  {
    displayMessage = "连接失败";
    displaySubMessage = "后端未启动";
    currentState = STATE_RIDING; // 返回骑行状态
    controlLED(true); // 点亮LED（骑行中）
    playBeep(3, 100); // 错误提示音
    delay(3000);     // 显示3秒错误信息
    displayMessage = "骑行中";
    displaySubMessage = "再次刷卡还车";
    return;
  }

  // 构造 JSON 请求体（使用6位小数精度）
  StaticJsonDocument<256> doc;
  doc["order_id"] = currentOrderID;
  doc["rfid_card"] = cardUID;
  doc["end_lat"] = String(currentLat, 6);  // 6位小数 = ~0.1米精度
  doc["end_lng"] = String(currentLng, 6);

  String postData;
  serializeJson(doc, postData);

  // 发送 HTTP POST 请求（使用还车接口）
  client.print(String("POST /api/orders/lock HTTP/1.1\r\n") +
               String("Host: ") + API_SERVER + "\r\n" +
               String("Content-Type: application/json\r\n") +
               String("Content-Length: ") + postData.length() + "\r\n\r\n" +
               postData);

  // 处理响应
  bool success = processLockResponse(client);
  client.stop();

  if (!success)
  {
    displayMessage = "还车失败";
    displaySubMessage = "请重试";
    playBeep(3, 50);
    delay(2000);
    currentState = STATE_RIDING; // 返回骑行状态
    controlLED(true); // 点亮LED（骑行中）
    displayMessage = "骑行中";
    displaySubMessage = "再次刷卡还车";
  }
}

/**
 * 处理还车服务器响应
 */
bool processLockResponse(WiFiClient &client)
{
  // 等待响应（超时 5 秒）
  unsigned long timeout = millis();
  while (client.available() == 0)
  {
    if (millis() - timeout > 5000)
    {
      return false;
    }
  }

  // 读取并跳过 HTTP 状态行
  String statusLine = client.readStringUntil('\n');

  // 检查 HTTP 状态码
  bool httpOk = false;
  if (statusLine.indexOf("200") >= 0 || statusLine.indexOf("201") >= 0 || statusLine.indexOf("204") >= 0)
  {
    httpOk = true;
  }

  // 跳过 HTTP 头部，直到遇到空行
  int headerCount = 0;
  while (client.available())
  {
    String line = client.readStringUntil('\n');
    line.trim(); // 去除前后空白字符
    headerCount++;

    if (line.length() == 0)
    {
      // 空行表示头部结束
      break;
    }
  }

  // 读取响应体（增加等待时间）
  String responseBody = "";
  // 等待更长时间让数据完全到达
  delay(200);

  // 读取所有可用数据，增加超时保护
  unsigned long readStart = millis();
  while (client.available() && (millis() - readStart < 1000))
  {
    char c = client.read();
    responseBody += c;
    // 如果数据流暂停，再等待一小会儿
    if (!client.available() && responseBody.length() > 0)
    {
      delay(50);
    }
  }


  // 检查响应体是否为空
  if (responseBody.length() == 0)
  {
    // 如果 HTTP 状态码是 2xx，即使响应体为空也视为成功
    if (httpOk)
    {
      // 清除订单信息
      currentOrderID = 0;
      currentCardUID = "";
      currentUserID = "";
      useSimulation = false; // 关闭模拟模式，恢复 GPS 读取

      // 显示成功信息
      displayMessage = "还车成功";
      displaySubMessage = "感谢使用";
      playBeep(2, 300);

      delay(3000);

      // 返回待机状态
      currentState = STATE_IDLE;
      displayMessage = "待机中";
      displaySubMessage = "请刷卡解锁";
      controlLED(false); // 熄灭LED（空闲）

      return true;
    }
    else
    {
      return false;
    }
  }

  // 解析 JSON
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, responseBody);

  if (error)
  {
    return false;
  }

  // 检查响应状态
  bool success = doc["success"];
  if (!success)
  {
    const char *message = doc["message"];
    displayMessage = message;
    return false;
  }

  // 提取数据
  float cost = doc["cost"];
  float newBalance = doc["new_balance"];
  int duration = doc["duration_minutes"];


  // 显示结算信息
  char buffer[64];
  sprintf(buffer, "时长:%d分 费用:%.2f", duration, cost);
  displayMessage = "还车成功";
  displaySubMessage = buffer;

  // 立即清除订单信息，防止重复还车
  currentOrderID = 0;
  currentCardUID = "";
  currentUserID = "";
  useSimulation = false; // 关闭模拟模式，恢复 GPS 读取

  // 播放提示音
  playBeep(2, 300);

  delay(3000); // 显示结算信息 3 秒

  // 返回待机状态
  currentState = STATE_IDLE;
  currentCardUID = "";
  currentUserID = "";
  currentOrderID = 0;
  displayMessage = "待机中";
  displaySubMessage = "请刷卡解锁";
  controlLED(false); // 熄灭LED（空闲）

  return true;
}

/**
 * 处理服务器响应
 */
bool processServerResponse(WiFiClient &client)
{
  // 等待响应（超时 5 秒）
  unsigned long timeout = millis();
  while (client.available() == 0)
  {
    if (millis() - timeout > 5000)
    {
      return false;
    }
  }

  // 读取并跳过 HTTP 状态行
  String statusLine = client.readStringUntil('\n');

  // 检查 HTTP 状态码
  bool httpOk = false;
  if (statusLine.indexOf("200") >= 0 || statusLine.indexOf("201") >= 0 || statusLine.indexOf("204") >= 0)
  {
    httpOk = true;
  }

  // 跳过 HTTP 头部，直到遇到空行
  int headerCount = 0;
  while (client.available())
  {
    String line = client.readStringUntil('\n');
    line.trim(); // 去除前后空白字符
    headerCount++;

    // 调试：打印头部信息

    if (line.length() == 0)
    {
      // 空行表示头部结束
      break;
    }
  }

  // 检查是否还有数据可读

  // 读取响应体（使用更可靠的方法）
  String responseBody = "";
  // 等待一小段时间让数据完全到达
  delay(100);

  // 读取所有可用数据
  while (client.available())
  {
    char c = client.read();
    responseBody += c;
  }


  // 检查响应体是否为空
  if (responseBody.length() == 0)
  {
    // 如果 HTTP 状态码是 2xx，即使响应体为空也视为成功（虽然这种情况不太可能）
    if (httpOk)
    {
      // 开锁请求响应体为空，视为失败
      return false;
    }
    else
    {
      return false;
    }
  }

  // 解析 JSON
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, responseBody);

  if (error)
  {
    return false;
  }

  // 检查响应状态
  bool success = doc["success"];
  if (!success)
  {
    const char *message = doc["message"];
    displayMessage = message;
    return false;
  }

  // 提取数据
  currentUserID = doc["user_id"].as<String>();
  currentBalance = doc["balance"];
  currentOrderID = doc["order_id"];


  // 更新状态
  currentState = STATE_RIDING;
  rideStartTime = millis();
  controlLED(true); // 点亮LED（骑行中）

  // 启用模拟移动模式（从当前 GPS 位置开始模拟）
  useSimulation = true;

  // 播放成功提示音
  playBeep(3, 200);

  // 显示骑行界面
  displayMessage = "骑行中";
  displaySubMessage = "再次刷卡还车";

  return true;
}

// =========================== MQTT 消息发送 ===========================

/**
 * 发送心跳包
 */
void sendHeartbeat()
{
  StaticJsonDocument<256> doc;
  doc["timestamp"] = millis();
  doc["lat"] = String(currentLat, 6);  // 6位小数 = ~0.1米精度
  doc["lng"] = String(currentLng, 6);
  doc["battery"] = 100; // TODO: 读取实际电池电量
  doc["status"] = (currentState == STATE_RIDING) ? "riding" : "idle";

  String message;
  serializeJson(doc, message);

  if (mqttClient.publish(TOPIC_HEARTBEAT, message.c_str()))
  {
  }
  else
  {
  }
}

/**
 * 发送 GPS 上报
 */
void sendGPSReport()
{
  StaticJsonDocument<256> doc;
  doc["lat"] = String(currentLat, 6);  // 6位小数 = ~0.1米精度
  doc["lng"] = String(currentLng, 6);
  doc["mode"] = useSimulation ? "hybrid" : "real"; // hybrid=真实起始+模拟移动, real=完全真实
  doc["timestamp"] = millis();

  String message;
  serializeJson(doc, message);

  if (mqttClient.publish(TOPIC_GPS, message.c_str()))
  {
  }
  else
  {
  }
}

// =========================== OLED 显示 ===========================

/**
 * OLED 循环处理（根据状态更新显示）
 */
void loopOLED()
{
  unsigned long currentMillis = millis();

  // 定时刷新显示
  if (currentMillis - lastDisplayUpdate >= DISPLAY_UPDATE_INTERVAL)
  {
    display.clearDisplay();

    if (currentState == STATE_IDLE)
    {
      updateOLEDIdle();
    }
    else if (currentState == STATE_RIDING)
    {
      updateOLEDRiding();
    }
    else if (currentState == STATE_PROCESSING)
    {
      updateOLEDProcessing();
    }

    display.display();
    lastDisplayUpdate = currentMillis;
  }
}

/**
 * 更新待机界面
 */
void updateOLEDIdle()
{
  // 按文章建议：访问 OLED 前确保 SPI 非活动
  digitalWrite(RFID_SDA_PIN, HIGH);

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // 标题 - 居中显示
  display.setTextSize(2);
  display.setCursor(10, 0);
  display.println("SmartBike");

  // 分隔线
  display.drawLine(0, 18, 127, 18, SSD1306_WHITE);

  // WiFi 和 GPS 状态 - 行 22
  display.setTextSize(1);
  display.setCursor(0, 22);
  display.print("WiFi:");
  if (WiFi.status() == WL_CONNECTED)
  {
    display.println("OK");
  }
  else
  {
    display.println("--");
  }

  // GPS 状态 - 行 22 (同一行右侧)
  display.setCursor(70, 22);
  display.print("GPS:");
  if (gpsValid)
  {
    display.print("OK");
    display.print(gps.satellites.value()); // 显示卫星数量
    display.println("S");
  }
  else
  {
    display.println("--");
  }

  // 坐标信息 - 行 32
  display.setCursor(0, 32);
  display.print("Lat:");
  display.println(currentLat, 6);

  // 坐标信息 - 行 42
  display.setCursor(0, 42);
  display.print("Lng:");
  display.println(currentLng, 6);
}

/**
 * 更新骑行界面
 */
void updateOLEDRiding()
{
  // 访问 OLED 前确保 SPI 非活动
  digitalWrite(RFID_SDA_PIN, HIGH);

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // 标题 - 大号显示
  display.setTextSize(2);
  display.setCursor(20, 0);
  display.println("RIDING");

  // 分隔线
  display.drawLine(0, 18, 127, 18, SSD1306_WHITE);

  // 骑行时长 - 行 23
  unsigned long rideDuration = (millis() - rideStartTime) / 1000 / 60; // 分钟
  unsigned long rideSeconds = (millis() - rideStartTime) / 1000 % 60; // 秒
  display.setTextSize(1);
  display.setCursor(0, 23);
  display.print("Time: ");
  display.print(rideDuration);
  display.print("m ");
  display.print(rideSeconds);
  display.println("s");

  // 预计费用 - 行 34 (按总秒数计算，实时显示)
  unsigned long totalSeconds = (millis() - rideStartTime) / 1000;
  float cost = (totalSeconds / 60.0) * PRICE_PER_MINUTE;
  display.setCursor(0, 34);
  display.print("Cost: ");
  display.print(cost, 2);
  display.println(" RMB");

  // 速度（模拟）- 行 45
  display.setCursor(0, 45);
  display.print("Speed: ");
  display.print(12 + (rideDuration % 8)); // 模拟速度 12-20 km/h
  display.println(" km/h");

  // 坐标信息 - 行 56
  display.setCursor(0, 56);
  display.print(currentLat, 4);
  display.print(",");
  display.println(currentLng, 4);
}

/**
 * 更新处理中界面
 */
void updateOLEDProcessing()
{
  // 按文章建议：访问 OLED 前确保 SPI 非活动
  digitalWrite(RFID_SDA_PIN, HIGH);

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // 主消息 - 行 8 (居中，大字体)
  display.setTextSize(2);
  int16_t x, y1;
  uint16_t w, h;
  display.getTextBounds((char *)displayMessage.c_str(), 0, 0, &x, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 8);
  display.println(displayMessage.c_str());

  // 副消息 - 行 28 (居中，小字体)
  display.setTextSize(1);
  display.getTextBounds((char *)displaySubMessage.c_str(), 0, 0, &x, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, 28);
  display.println(displaySubMessage.c_str());

  // 加载动画进度条 - 行 45
  static int progress = 0;
  progress = (progress + 10) % 100;

  int barWidth = 100;
  int barHeight = 10;
  int barX = (SCREEN_WIDTH - barWidth) / 2;
  int barY = 45;

  // 边框
  display.drawRect(barX, barY, barWidth, barHeight, SSD1306_WHITE);

  // 填充
  int fillWidth = (barWidth - 2) * progress / 100;
  display.fillRect(barX + 1, barY + 1, fillWidth, barHeight - 2, SSD1306_WHITE);
}

/**
 * 绘制居中文本
 * @param text 文本内容
 * @param y Y坐标
 * @param size 文字大小 (1=小, 2=大)
 */
void drawCenteredText(const char *text, int y, int size)
{
  display.setTextSize(size);
  int16_t x, y1;
  uint16_t w, h;
  display.getTextBounds((char *)text, 0, y, &x, &y1, &w, &h);
  display.setCursor((SCREEN_WIDTH - w) / 2, y);
  display.println(text);
}

/**
 * 绘制进度条
 * @param progress 进度百分比 (0-100)
 */
void drawProgressBar(int progress)
{
  int barWidth = 100;
  int barHeight = 10;
  int x = (SCREEN_WIDTH - barWidth) / 2;
  int y = 60;

  // 边框
  display.drawRect(x, y, barWidth, barHeight, SSD1306_WHITE);

  // 填充
  int fillWidth = (barWidth * progress) / 100;
  display.fillRect(x, y, fillWidth, barHeight, SSD1306_WHITE);
}

// =========================== 蜂鸣器控制 ===========================

/**
 * 蜂鸣器循环处理（暂无实际功能）
 */
void loopBuzzer()
{
  // 蜂鸣器控制是直接调用，无需循环处理
}

/**
 * 播放提示音
 * @param times 播放次数
 * @param duration 每次持续时间（毫秒）
 */
void playBeep(int times, int duration)
{
  for (int i = 0; i < times; i++)
  {
    controlBuzzer(true);
    delay(duration);
    controlBuzzer(false);
    if (i < times - 1)
    {
      delay(100);
    }
  }
}

/**
 * 控制蜂鸣器开关
 * @param state true=开, false=关
 */
void controlBuzzer(bool state)
{
  digitalWrite(BUZZER_PIN, state ? HIGH : LOW);
}

/**
 * 控制LED开关（骑行指示灯）
 * @param state true=亮（骑行中）, false=灭（空闲）
 * 注意：GPIO16 (D0) 是反相逻辑（LOW=亮, HIGH=灭）
 */
void controlLED(bool state)
{
  digitalWrite(LED_PIN, state ? LOW : HIGH); // 反相逻辑
}

// =========================== 辅助函数 ===========================

/**
 * 获取 RFID 卡片 UID
 */
String getRFIDUID()
{
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++)
  {
    if (rfid.uid.uidByte[i] < 0x10)
    {
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
String formatFloat(float value, int decimals)
{
  String result = "";
  char buffer[16];
  dtostrf(value, 0, decimals, buffer);
  result = buffer;
  return result;
}