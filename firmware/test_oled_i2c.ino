/**
 * OLED SSD1306 测试程序 - I2C 版本
 * 用于测试 I2C 接口的 OLED 屏幕（4针）
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1       // 没有复位引脚
#define SCREEN_ADDRESS 0x3C // I2C 地址（可能是 0x3C 或 0x3D）

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup()
{
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println(F("================================="));
  Serial.println(F("OLED I2C 测试程序"));
  Serial.println(F("================================="));

  // 初始化 I2C（ESP8266 默认：SDA=GPIO4(D2), SCL=GPIO5(D1)）
  Wire.begin();

  Serial.println(F("正在初始化 OLED (I2C)..."));

  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS))
  {
    Serial.println(F("SSD1306 初始化失败！"));
    Serial.println(F("请检查接线："));
    Serial.println(F("  SCL -> D1 (GPIO5)"));
    Serial.println(F("  SDA -> D2 (GPIO4)"));
    Serial.println(F("  VCC -> 3.3V"));
    Serial.println(F("  GND -> GND"));
    Serial.println(F("如果还是不行，尝试修改地址为 0x3D"));
    for (;;)
      ;
  }

  Serial.println(F("OLED 初始化成功！"));

  // 显示测试
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 10);
  display.println(F("Hello"));
  display.setCursor(10, 30);
  display.println(F("World!"));
  display.display();

  Serial.println(F("测试完成！"));
}

void loop()
{
  static int counter = 0;

  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("Count:"));
  display.setTextSize(3);
  display.setCursor(20, 30);
  display.println(counter);
  display.display();

  counter++;
  delay(1000);

  Serial.print(F("计数: "));
  Serial.println(counter);
}
