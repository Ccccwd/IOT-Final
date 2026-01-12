/**
 * GPS 简化测试程序 - 用于排查接线问题
 * 只测试GPS数据接收，不使用OLED
 */

#include <SoftwareSerial.h>

// GPS 引脚配置
#define GPS_RX_PIN 12 // D6 - GPIO12 (ESP的RX，连接GPS的TX)
#define GPS_TX_PIN -1 // 不使用

SoftwareSerial GPSSerial(GPS_RX_PIN, GPS_TX_PIN);

void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n\n=================================");
    Serial.println("GPS 简化测试");
    Serial.println("=================================");
    Serial.println("GPS RX: D6 (GPIO12)");
    Serial.println("GPS 波特率: 9600");
    Serial.println();
    Serial.println("【接线检查】");
    Serial.println("  GPS TX  → NodeMCU D6");
    Serial.println("  GPS VCC → 3.3V 或 5V");
    Serial.println("  GPS GND → GND");
    Serial.println("  GPS RX  → 不接");
    Serial.println("=================================");
    Serial.println();

    // 初始化 GPS 串口
    GPSSerial.begin(9600, SWSERIAL_8N1, GPS_RX_PIN, -1, false);

    Serial.println("等待 GPS 数据...");
    Serial.println("如果30秒内无输出，请检查：");
    Serial.println("1. GPS TX 是否连接到 D6");
    Serial.println("2. 尝试交换 GPS 的 TX/RX 引脚（某些模块标注错误）");
    Serial.println("3. 确认 GPS 供电正常（LED 闪烁）");
    Serial.println();
    Serial.println("---------- GPS 原始数据 ----------");
}

void loop()
{
    static unsigned long lastPrintTime = 0;
    static unsigned long charCount = 0;

    // 读取并显示所有 GPS 数据
    while (GPSSerial.available() > 0)
    {
        char c = GPSSerial.read();
        Serial.write(c); // 直接输出原始数据
        charCount++;
    }

    // 每5秒打印统计信息
    if (millis() - lastPrintTime > 5000)
    {
        lastPrintTime = millis();

        Serial.println();
        Serial.print(">>> 统计: 已接收 ");
        Serial.print(charCount);
        Serial.println(" 个字符");

        if (charCount == 0)
        {
            Serial.println("⚠ 警告: 完全没有数据！");
            Serial.println("  → 检查 GPS TX 是否连接到 D6");
            Serial.println("  → 尝试交换 GPS 的 TX 和 RX 引脚");
        }
        else if (charCount < 50)
        {
            Serial.println("⚠ 数据很少，可能接线不良");
        }
        else
        {
            Serial.println("✓ GPS 正在发送数据");
        }
        Serial.println("----------------------------------");
        Serial.println();
    }
}
