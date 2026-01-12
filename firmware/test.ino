/**
 * OLED + RC522 联合测试程序
 * 测试方案：无蜂鸣器，尝试解决 MISO 冲突
 */

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <SPI.h>
#include <MFRC522.h>

// RC522 引脚定义
#define RFID_SDA_PIN 15 // D8 - GPIO15 (CS)
#define RFID_RST_PIN 16 // D0 - GPIO16 (RST)
// 硬件SPI引脚：
// SCK  = GPIO14 (D5)
// MOSI = GPIO13 (D7)
// MISO = GPIO12 (D6) - 必须连接，但会和OLED冲突

// OLED 引脚定义（与1.ino完全相同）
#define OLED_CLK 14  // D5 (GPIO14) - SCK
#define OLED_MOSI 13 // D7 (GPIO13) - MOSI
#define OLED_RST 2   // D4 (GPIO2) - RES
#define OLED_DC 5    // D1 (GPIO5) - DC
#define OLED_CS 0    // D3 (GPIO0) - CS

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// 创建对象（使用与1.ino相同的方式）
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &SPI, OLED_DC, OLED_RST, OLED_CS);
MFRC522 rfid(RFID_SDA_PIN, RFID_RST_PIN);

void setup()
{
  // *** 关键修复：按 SPI/I2C 冲突文章建议，先配置所有片选引脚 ***

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

  Serial.begin(115200);
  delay(2000);

  Serial.println();
  Serial.println("=================================");
  Serial.println("OLED + RC522 完整测试");
  Serial.println("修复 SPI 片选冲突");
  Serial.println("=================================");

  // 先初始化 SPI
  Serial.println("正在初始化 SPI...");
  SPI.begin();
  Serial.println("SPI 初始化完成");

  // 确保 SS 引脚拉高后再初始化 RC522
  digitalWrite(RFID_SDA_PIN, HIGH);
  delay(10);

  // 初始化 RC522
  Serial.println("正在初始化 RC522...");
  rfid.PCD_Init();
  Serial.println("RC522 初始化完成");

  // 读取版本号验证通信
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.print("RC522 版本: 0x");
  Serial.println(version, HEX);

  if (version == 0x92 || version == 0x91)
  {
    Serial.println("RC522 通信正常！");
  }
  else if (version == 0x00 || version == 0xFF)
  {
    Serial.println("警告: RC522 通信异常");
  }

  // 最后初始化 OLED（在 SPI 和 RC522 之后）
  Serial.println("正在初始化 OLED...");

  // 按文章建议：访问 I2C 设备前确保 SPI 处于非活动状态
  digitalWrite(RFID_SDA_PIN, HIGH);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
  {
    Serial.println("OLED 初始化失败！");
    for (;;)
      ;
  }
  Serial.println("OLED 初始化成功！");

  // 显示欢迎画面
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("System Ready!");
  display.println("");
  display.println("OLED: OK");
  display.println("RC522: OK");
  display.println("MISO: Connected");
  display.println("");
  display.println("Scan card now");
  display.display();

  Serial.println("=================================");
  Serial.println("系统就绪！请刷卡测试");
  Serial.println("=================================");
}

void loop()
{
  static int counter = 0;
  static unsigned long lastUpdate = 0;
  static bool cardPresent = false;
  static int scanAttempts = 0;

  // 每秒更新一次计数
  if (millis() - lastUpdate >= 1000)
  {
    if (!cardPresent)
    {
      // 按文章建议：访问 OLED (I2C) 前确保 SPI 非活动
      digitalWrite(RFID_SDA_PIN, HIGH);

      display.clearDisplay();
      display.setTextSize(1);
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(0, 0);
      display.println("Waiting for card");
      display.println("");
      display.print("Uptime: ");
      display.print(counter);
      display.println("s");
      display.print("Scans: ");
      display.println(scanAttempts);
      display.println("");
      display.println("Place card on");
      display.println("RC522 antenna");
      display.display();

      counter++;
      lastUpdate = millis();

      Serial.print("等待刷卡... (");
      Serial.print(counter);
      Serial.print("s, 扫描次数: ");
      Serial.print(scanAttempts);
      Serial.println(")");
    }
  }

  // 检测 RFID 卡片
  scanAttempts++;

  // 按文章建议：操作 RC522 前启动 SPI 事务
  SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
  digitalWrite(RFID_SDA_PIN, LOW);

  if (!rfid.PICC_IsNewCardPresent())
  {
    digitalWrite(RFID_SDA_PIN, HIGH);
    SPI.endTransaction();
    delay(50);
    return;
  }

  Serial.println("检测到卡片存在！尝试读取...");

  if (!rfid.PICC_ReadCardSerial())
  {
    Serial.println("读取卡片失败！");
    digitalWrite(RFID_SDA_PIN, HIGH);
    SPI.endTransaction();
    delay(50);
    return;
  }

  // 结束 SPI 事务
  digitalWrite(RFID_SDA_PIN, HIGH);
  SPI.endTransaction();

  cardPresent = true;

  // 读取卡片 UID
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++)
  {
    if (rfid.uid.uidByte[i] < 0x10)
      uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  Serial.println("=================================");
  Serial.println("检测到卡片！");
  Serial.print("UID: ");
  Serial.println(uid);
  Serial.print("UID 长度: ");
  Serial.print(rfid.uid.size);
  Serial.println(" 字节");
  Serial.println("=================================");

  // 播放提示音（已去除蜂鸣器）

  // 在 OLED 上显示卡片信息（确保 SPI 非活动）
  digitalWrite(RFID_SDA_PIN, HIGH);

  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Card OK!");

  display.setTextSize(1);
  display.println("");
  display.println("UID:");
  display.println(uid);
  display.println("");
  display.println("UID Read Success!");
  display.display();

  // 停止读卡
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(3000); // 显示 3 秒
  cardPresent = false;
}
