/**
 * GPS 波特率自动检测程序
 * 尝试常见的 GPS 波特率：9600, 4800, 115200, 38400
 */

#include <SoftwareSerial.h>

#define GPS_RX_PIN 12 // D6 - GPIO12
#define GPS_TX_PIN -1

SoftwareSerial GPSSerial(GPS_RX_PIN, GPS_TX_PIN);

const long BAUD_RATES[] = {9600, 4800, 115200, 38400, 57600};
const int NUM_BAUDS = 5;
int currentBaudIndex = 0;

void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n\n=================================");
    Serial.println("GPS 波特率自动检测");
    Serial.println("=================================");
    Serial.println("将依次尝试以下波特率：");
    for (int i = 0; i < NUM_BAUDS; i++)
    {
        Serial.print("  - ");
        Serial.println(BAUD_RATES[i]);
    }
    Serial.println("每个波特率测试 10 秒");
    Serial.println("=================================");
    Serial.println();

    startBaudRate(0);
}

void startBaudRate(int index)
{
    currentBaudIndex = index;
    GPSSerial.end();
    delay(100);

    Serial.println("----------------------------------");
    Serial.print(">>> 尝试波特率: ");
    Serial.println(BAUD_RATES[currentBaudIndex]);
    Serial.println("----------------------------------");

    GPSSerial.begin(BAUD_RATES[currentBaudIndex], SWSERIAL_8N1, GPS_RX_PIN, -1, false);
}

void loop()
{
    static unsigned long lastSwitchTime = 0;
    static unsigned long charCount = 0;
    static unsigned long lastCharTime = 0;

    // 读取数据
    while (GPSSerial.available() > 0)
    {
        char c = GPSSerial.read();
        Serial.write(c);
        charCount++;
        lastCharTime = millis();
    }

    // 10秒后切换到下一个波特率
    if (millis() - lastSwitchTime > 10000)
    {
        Serial.println();
        Serial.print("结果: 接收到 ");
        Serial.print(charCount);
        Serial.println(" 个字符");

        if (charCount > 100)
        {
            Serial.println();
            Serial.println("========================================");
            Serial.println("✓✓✓ 找到正确的波特率！✓✓✓");
            Serial.print("    GPS 波特率: ");
            Serial.println(BAUD_RATES[currentBaudIndex]);
            Serial.println("========================================");
            Serial.println();
            Serial.println("请记下这个波特率，并修改主程序：");
            Serial.print("  #define GPS_BAUD ");
            Serial.println(BAUD_RATES[currentBaudIndex]);
            Serial.println();
            Serial.println("继续显示 GPS 数据...");
            Serial.println();

            // 找到了，不再切换
            while (1)
            {
                while (GPSSerial.available() > 0)
                {
                    Serial.write(GPSSerial.read());
                }
            }
        }

        charCount = 0;
        lastSwitchTime = millis();

        // 切换到下一个波特率
        currentBaudIndex = (currentBaudIndex + 1) % NUM_BAUDS;
        startBaudRate(currentBaudIndex);
    }

    // 实时统计
    static unsigned long lastStatTime = 0;
    if (millis() - lastStatTime > 2000 && charCount > 0)
    {
        lastStatTime = millis();
        Serial.print(" [");
        Serial.print(charCount);
        Serial.print(" chars] ");
    }
}
