/**
 * GPS 模块测试程序
 * 功能：读取 GPS 数据并在 OLED 显示屏上显示
 * 硬件：ESP8266 NodeMCU + ATGM336H GPS + SSD1306 OLED
 */

#include <SoftwareSerial.h>
#include <TinyGPS++.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==================== GPS 配置选项 ====================
// 使用硬件串口（GPIO3 RX）
// ⚠️ 注意：上传程序前必须断开 GPS TX 连接！
// 接线：GPS TX → NodeMCU RX (GPIO3)

#define USE_HARDWARE_SERIAL true
#define GPS_BAUD 9600

// OLED 引脚
#define OLED_CLK 14  // D5 - GPIO14 (SCK)
#define OLED_MOSI 13 // D7 - GPIO13 (MOSI)
#define OLED_RST 2   // D4 - GPIO2 (RES)
#define OLED_DC 5    // D1 - GPIO5 (DC)
#define OLED_CS 0    // D3 - GPIO0 (CS)

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// 创建对象
TinyGPSPlus gps;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &SPI, OLED_DC, OLED_RST, OLED_CS);

// OLED 调试信息缓冲区
String debugLines[8]; // OLED 最多显示 8 行
int debugLineCount = 0;

// GPS 数据
double latitude = 0.0;
double longitude = 0.0;
int satellites = 0;
double altitude = 0.0;
double speed_kmh = 0.0;
bool gpsValid = false;

// 统计数据
unsigned long charsProcessed = 0;
unsigned long sentencesWithFix = 0;

// OLED 调试输出函数
void oledPrintln(String msg)
{
    // 滚动显示，保留最新 8 行
    if (debugLineCount >= 8)
    {
        for (int i = 0; i < 7; i++)
        {
            debugLines[i] = debugLines[i + 1];
        }
        debugLines[7] = msg;
    }
    else
    {
        debugLines[debugLineCount++] = msg;
    }

    // 更新显示
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);

    for (int i = 0; i < debugLineCount && i < 8; i++)
    {
        display.println(debugLines[i]);
    }

    display.display();
}

void setup()
{
    // 配置片选引脚
    pinMode(OLED_CS, OUTPUT);
    digitalWrite(OLED_CS, HIGH);
    pinMode(OLED_RST, OUTPUT);
    digitalWrite(OLED_RST, HIGH);

    // 初始化 OLED
    SPI.begin();
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
    {
        while (1)
            ; // OLED 初始化失败则停止
    }

    // 显示启动信息
    oledPrintln("GPS Test");
    oledPrintln("================");
    oledPrintln("Using HW Serial");
    oledPrintln("GPS TX->MCU RX");
    oledPrintln("Baud: 9600");
    oledPrintln("================");
    delay(2000);

    // 初始化硬件串口（连接 GPS）
    Serial.begin(GPS_BAUD);
    delay(1000);

    oledPrintln("Waiting GPS...");
}

void loop()
{
    // 读取 GPS 数据（硬件串口）
    static unsigned long lastCharTime = 0;
    static bool firstDataReceived = false;

    while (Serial.available() > 0)
    {
        char c = Serial.read();

        // 首次接收到数据
        if (!firstDataReceived)
        {
            oledPrintln("GPS Data OK!");
            firstDataReceived = true;
        }

        gps.encode(c);
        charsProcessed++;
        lastCharTime = millis();
    }

    // 更新 GPS 数据
    if (gps.location.isUpdated())
    {
        latitude = gps.location.lat();
        longitude = gps.location.lng();
        gpsValid = true;
        sentencesWithFix++;
    }

    if (gps.satellites.isUpdated())
    {
        satellites = gps.satellites.value();
    }

    if (gps.altitude.isUpdated())
    {
        altitude = gps.altitude.meters();
    }

    if (gps.speed.isUpdated())
    {
        speed_kmh = gps.speed.kmph();
    }

    // 每 2 秒更新一次显示
    static unsigned long lastUpdate = 0;
    if (millis() - lastUpdate >= 2000)
    {
        lastUpdate = millis();
        updateDisplay();
    }
}

/**
 * 更新 OLED 显示
 */
void updateDisplay()
{
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);

    // 显示运行时间
    display.print("Time: ");
    display.print(millis() / 1000);
    display.println("s");

    // 显示接收状态
    display.print("Chars: ");
    display.println(charsProcessed);

    display.print("Sats: ");
    display.print(satellites);
    display.print(" Fix:");
    display.println(gpsValid ? "Y" : "N");

    display.println("----------------");

    if (gpsValid)
    {
        // 显示定位数据
        display.print("Lat:");
        display.println(latitude, 5);

        display.print("Lng:");
        display.println(longitude, 5);

        display.print("Alt:");
        display.print((int)altitude);
        display.println("m");
    }
    else
    {
        // 显示诊断信息
        if (charsProcessed == 0)
        {
            display.println("NO GPS DATA!");
            display.println("Check wire:");
            display.println("GPS TX->MCU RX");
        }
        else if (charsProcessed < 100)
        {
            display.println("Few data");
            display.println("Check wire");
        }
        else
        {
            display.println("Waiting fix");
            display.println("Go outdoor");
        }
    }

    display.display();
}
