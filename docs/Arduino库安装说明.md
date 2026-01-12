# Arduino 库安装说明

## 📚 项目必需的库列表

本 ESP8266 固件需要安装以下 6 个核心库：

| 库名称 | 版本要求 | 用途 | 作者 |
|--------|---------|------|------|
| **PubSubClient** | 2.8.0+ | MQTT 通信 | Nick O'Leary |
| **ArduinoJson** | 6.21.0+ | JSON 数据处理 | Benoit Blanchon |
| **MFRC522** | 1.4.10+ | RFID 读卡器驱动 | miguelbalboa |
| **TinyGPSPlus** | 1.0.3+ | GPS NMEA 数据解析 | Mikal Hart |
| **Adafruit GFX Library** | 1.11.0+ | 图形绘制库（核心库） | Adafruit |
| **Adafruit SSD1306** | 2.5.7+ | OLED 显示屏驱动 | Adafruit |

---

## 🔧 方法一：通过库管理器安装（推荐）

这是最简单的方法，适合大多数用户。

### 步骤 1：打开 Arduino IDE

确保已安装 Arduino IDE（版本 1.8.x 或 2.x）

### 步骤 2：打开库管理器

点击菜单：`项目` → `加载库` → `管理库...`

或者直接按快捷键：`Ctrl + Shift + I` (Windows) / `Cmd + Shift + I` (Mac)

### 步骤 3：搜索并安装库

在库管理器的搜索框中，依次搜索以下库名并安装：

---

### 1️⃣ 安装 PubSubClient

**搜索**：`PubSubClient`

**操作**：
1. 在搜索框输入 "PubSubClient"
2. 找到 `PubSubClient` by Nick O'Leary
3. 点击 `安装` 按钮
4. 选择 `最新版本`（推荐 2.8.0 或更高）
5. 等待安装完成

**验证安装**：
点击 `项目` → `加载库`，应该在列表中看到 `PubSubClient`

---

### 2️⃣ 安装 ArduinoJson

**搜索**：`ArduinoJson`

**操作**：
1. 在搜索框输入 "ArduinoJson"
2. 找到 `ArduinoJson` by Benoit Blanchon
3. 点击 `安装` 按钮
4. 选择 `版本 6.21.0`（注意：不要安装版本 7.x，API 不兼容）
5. 等待安装完成

**⚠️ 重要提示**：
- ArduinoJson 6.x 和 7.x 的 API 完全不同
- 本项目使用的是 6.x API
- 如果安装了 7.x 版本，需要降级到 6.21.0

**降级方法**：
1. 点击库管理器的 `已安装` 标签
2. 找到 `ArduinoJson`
3. 选择 `版本` 下拉菜单 → 选择 `6.21.0`
4. 点击 `重新安装`

---

### 3️⃣ 安装 MFRC522

**搜索**：`MFRC522`

**操作**：
1. 在搜索框输入 "MFRC522"
2. 找到 `MFRC522` by miguelbalboa
3. 点击 `安装` 按钮
4. 选择 `最新版本`（推荐 1.4.10 或更高）
5. 等待安装完成

**替代方案**：
如果官方版本搜索不到，可以使用：
- 搜索 `RFID`
- 找到 `MFRC522` by GithubCommunity

---

### 4️⃣ 安装 TinyGPSPlus

**搜索**：`TinyGPSPlus`

**操作**：
1. 在搜索框输入 "TinyGPSPlus"（注意大小写，无空格）
2. 找到 `TinyGPSPlus` by Mikal Hart
3. 点击 `安装` 按钮
4. 选择 `最新版本`（推荐 1.0.3 或更高）
5. 等待安装完成

**注意**：
- 不要安装旧的 `TinyGPS` 库（没有 Plus 后缀）
- `TinyGPSPlus` 是新版，功能更强大

---

### 5️⃣ 安装 Adafruit GFX Library

**搜索**：`Adafruit GFX`

**操作**：
1. 在搜索框输入 "Adafruit GFX"
2. 找到 `Adafruit GFX Library` by Adafruit
3. 点击 `安装` 按钮
4. 选择 `最新版本`（推荐 1.11.0 或更高）
5. 等待安装完成

**说明**：
- 这是 Adafruit 图形库的核心库
- 提供了基本的绘图功能（点、线、圆、矩形等）
- 必须先安装此库，再安装 SSD1306 库

---

### 6️⃣ 安装 Adafruit SSD1306

**搜索**：`Adafruit SSD1306`

**操作**：
1. 在搜索框输入 "Adafruit SSD1306"
2. 找到 `Adafruit SSD1306` by Adafruit
3. 点击 `安装` 按钮
4. 选择 `最新版本`（推荐 2.5.7 或更高）
5. 等待安装完成

**⚠️ 重要提示**：
- 必须先安装 `Adafruit GFX Library` 才能使用此库
- 此库专门用于 SSD1306 OLED 显示屏驱动
- 支持 SPI 和 I2C 两种接口

---

## 📦 方法二：手动安装（备用方案）

如果库管理器无法使用，可以手动安装。

### 步骤 1：下载库文件

访问以下 GitHub 仓库，下载 ZIP 文件：

| 库名 | GitHub 地址 |
|------|-------------|
| PubSubClient | https://github.com/knolleary/pubsubclient |
| ArduinoJson | https://github.com/bblanchon/ArduinoJson |
| MFRC522 | https://github.com/miguelbalboa/rfid |
| TinyGPSPlus | https://github.com/mikalhart/TinyGPSPlus |
| Adafruit GFX | https://github.com/adafruit/Adafruit-GFX-Library |
| Adafruit SSD1306 | https://github.com/adafruit/Adafruit_SSD1306 |

**下载步骤**：
1. 打开上面的链接
2. 点击绿色的 `Code` 按钮
3. 选择 `Download ZIP`

---

### 步骤 2：安装 ZIP 库

1. 打开 Arduino IDE
2. 点击 `项目` → `加载库` → `添加 .ZIP 库...`
3. 选择下载的 ZIP 文件
4. 等待安装完成

**注意**：
- 不要解压 ZIP 文件
- 保持原始文件名
- 如果出现错误，检查 ZIP 文件是否完整

---

### 步骤 3：验证安装

1. 点击 `文件` → `示例`
2. 在列表中查找已安装的库
3. 例如：`示例` → `PubSubClient` → `mqtt_basic`

如果能看到示例，说明安装成功。

---

## 🔍 方法三：通过 Git 克隆（高级用户）

如果你熟悉 Git，可以使用命令行安装：

### Windows (PowerShell)

```powershell
# 切换到 Arduino libraries 目录
cd "$HOME\Documents\Arduino\libraries"

# 克隆库
git clone https://github.com/knolleary/pubsubclient.git PubSubClient
git clone https://github.com/bblanchon/ArduinoJson.git ArduinoJson
git clone https://github.com/miguelbalboa/rfid.git MFRC522
git clone https://github.com/mikalhart/TinyGPSPlus.git TinyGPSPlus
git clone https://github.com/adafruit/Adafruit-GFX-Library.git Adafruit_GFX
git clone https://github.com/adafruit/Adafruit_SSD1306.git Adafruit_SSD1306
```

### Linux / Mac

```bash
# 切换到 Arduino libraries 目录
cd ~/Documents/Arduino/libraries

# 克隆库
git clone https://github.com/knolleary/pubsubclient.git PubSubClient
git clone https://github.com/bblanchon/ArduinoJson.git ArduinoJson
git clone https://github.com/miguelbalboa/rfid.git MFRC522
git clone https://github.com/mikalhart/TinyGPSPlus.git TinyGPSPlus
git clone https://github.com/adafruit/Adafruit-GFX-Library.git Adafruit_GFX
git clone https://github.com/adafruit/Adafruit_SSD1306.git Adafruit_SSD1306
```

---

## ✅ 验证所有库是否正确安装

### 测试代码

创建一个新的 Arduino 草图，粘贴以下代码：

```cpp
/**
 * 库安装验证测试
 */

#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <TinyGPS++.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

void setup() {
  Serial.begin(9600);
  Serial.println("\n\n=================================");
  Serial.println("库安装验证测试");
  Serial.println("=================================\n");

  Serial.println("✅ PubSubClient 已安装");
  Serial.print("   版本: ");
  Serial.println(PUBSUBCLIENT_VERSION);

  Serial.println("\n✅ ArduinoJson 已安装");
  Serial.print("   版本: ");
  Serial.println(ARDUINOJSON_VERSION);

  Serial.println("\n✅ MFRC522 已安装");
  #define RFID_SS_PIN 0
  #define RFID_RST_PIN -1
  MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
  Serial.println("   MFRC522 对象创建成功");

  Serial.println("\n✅ TinyGPSPlus 已安装");
  TinyGPSPlus gps;
  Serial.println("   TinyGPSPlus 对象创建成功");

  Serial.println("\n✅ Adafruit GFX 已安装");
  Serial.println("   Adafruit GFX 库已加载");

  Serial.println("\n✅ Adafruit SSD1306 已安装");
  #define SCREEN_WIDTH 128
  #define SCREEN_HEIGHT 64
  #define OLED_MOSI 14
  #define OLED_CLK 5
  #define OLED_DC 2
  #define OLED_RESET 16
  #define OLED_CS 15
  Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT,
    OLED_CLK, OLED_MOSI, OLED_DC, OLED_RESET, OLED_CS);
  Serial.println("   Adafruit SSD1306 对象创建成功");

  Serial.println("\n=================================");
  Serial.println("所有库安装成功！");
  Serial.println("=================================");
}

void loop() {
  // 什么都不做
}
```

### 上传并运行

1. 选择正确的开发板：`NodeMCU 1.0 (ESP-12E Module)`
2. 选择正确的端口
3. 点击 `上传` 按钮
4. 打开串口监视器（波特率 9600）

### 预期输出

```
=================================
库安装验证测试
=================================

✅ PubSubClient 已安装
   版本: 2.8

✅ ArduinoJson 已安装
   版本: 6022100

✅ MFRC522 已安装
   MFRC522 对象创建成功

✅ TinyGPSPlus 已安装
   TinyGPSPlus 对象创建成功

✅ Adafruit GFX 已安装
   Adafruit GFX 库已加载

✅ Adafruit SSD1306 已安装
   Adafruit SSD1306 对象创建成功

=================================
所有库安装成功！
=================================
```

---

## ❌ 常见问题排查

### 问题 1：编译错误 "No such file or directory"

**症状**：
```
fatal error: PubSubClient.h: No such file or directory
```

**原因**：库未正确安装

**解决方案**：
1. 确认已通过库管理器安装
2. 检查库名称是否正确（区分大小写）
3. 重启 Arduino IDE
4. 如果还是失败，尝试手动安装

---

### 问题 2：ArduinoJson 版本不兼容

**症状**：
```
error: 'class ArduinoJson::JsonDocument' has no member 'gc'
```

**原因**：安装了 ArduinoJson 7.x 版本

**解决方案**：
1. 打开库管理器
2. 点击 `已安装` 标签
3. 找到 `ArduinoJson`
4. 选择版本 `6.21.0`
5. 点击 `重新安装`

---

### 问题 3：Adafruit SSD1306 显示屏不显示

**症状**：
- 编译成功但屏幕全黑或全白
- 显示内容有乱码

**原因**：
- OLED_RESET引脚配置错误
- 未正确调用 display.display()

**解决方案**：

确保在代码中正确初始化和刷新显示：

```cpp
// 初始化
display.begin(SSD1306_SWITCHCAPVCC);

// 清除缓冲区
display.clearDisplay();

// 绘制内容
display.setTextSize(1);
display.setTextColor(SSD1306_WHITE);
display.setCursor(0, 0);
display.println("Hello World");

// 刷新显示（非常重要！）
display.display();
```

**注意**：每次绘制内容后，必须调用 `display.display()` 才能看到内容。

---

### 问题 4：无法从库管理器搜索到库

**原因**：
- 网络连接问题
- Arduino IDE 版本过旧
- 库索引未更新

**解决方案**：

1. **更新库索引**：
   ```
   点击库管理器右上角的更新图标（⭕）
   ```

2. **手动更新索引文件**：
   - Windows: `%APPDATA%\Arduino15\library_index.json`
   - Mac: `~/Library/Arduino15/library_index.json`
   - Linux: `~/.arduino15/library_index.json`
   - 删除该文件，重启 Arduino IDE

3. **使用离线安装**：
   - 下载 ZIP 文件
   - 手动安装

---

### 问题 5：ESP8266 开发板未安装

**症状**：
```
Board NodeMCU 1.0 (ESP-12E Module) isn't available
```

**解决方案**：

1. 打开 `文件` → `首选项`
2. 在 `附加开发板管理器网址` 中添加：
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
3. 点击 `确定`
4. 打开 `工具` → `开发板` → `开发板管理器`
5. 搜索 `esp8266`
6. 点击 `esp8266 by ESP8266 Community` → `安装`

---

## 📋 库版本对照表

| 库名称 | 最低版本 | 推荐版本 | 最新版本（2025-01） | 兼容性 |
|--------|---------|---------|-------------------|--------|
| PubSubClient | 2.8.0 | 2.8.0+ | 2.8.0 | ✅ 完全兼容 |
| ArduinoJson | 6.15.0 | 6.21.0 | 7.0.0 | ⚠️ 6.x 兼容，7.x 不兼容 |
| MFRC522 | 1.4.3 | 1.4.10+ | 1.4.10 | ✅ 完全兼容 |
| TinyGPSPlus | 1.0.2 | 1.0.3+ | 1.0.3 | ✅ 完全兼容 |
| Adafruit GFX | 1.10.0 | 1.11.0+ | 1.11.9 | ✅ 完全兼容 |
| Adafruit SSD1306 | 2.5.0 | 2.5.7+ | 2.5.10 | ✅ 完全兼容 |

---

## 🔧 库配置建议

### 优化 PubSubClient 内存使用

在 `PubSubClient.h` 中修改（可选）：

```cpp
// 默认: 256 字节
#define MQTT_MAX_PACKET_SIZE 512

// 默认: 1
#define MQTT_MAX_TRANSFER_SIZE 128
```

### 优化 ArduinoJson 性能

在代码中使用：

```cpp
// 使用 StaticJsonDocument 而非 DynamicJsonDocument
StaticJsonDocument<256> doc;  // 分配在栈上，更快
// DynamicJsonDocument doc(256);  // 分配在堆上，更灵活但更慢
```

---

## 🎯 下一步

所有库安装完成后：

1. ✅ 阅读 `docs/硬件接线指南.md`，完成硬件接线
2. ✅ 阅读 `docs/硬件调试指南.md`，进行单个模块测试
3. ✅ 上传 `firmware/bike_firmware.ino` 到 ESP8266
4. ✅ 根据调试指南进行完整系统测试

---

**最后更新**：2025-01-11
**版本**：v1.0

**需要帮助？** 请参考 `docs/硬件调试指南.md` 中的常见问题部分。
