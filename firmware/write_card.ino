/**
 * RFID 白卡初始化脚本
 * 作用：向 Mifare S50 白卡的第15扇区第2块写入系统特征码
 * 特征码：0xAB 0xCD 0xEF + 其他字节（各组不同）
 * 
 * 使用说明：
 * 1. 仅在初始化时运行此脚本
 * 2. 将此代码复制到新的 Arduino 项目中
 * 3. 上传到板卡，通过串口监视器观看输出
 * 4. 刷卡完成后恢复原始的 test5.ino
 */

#include <SPI.h>
#include <MFRC522.h>

#define RST_PIN    D0
#define SS_PIN     D8

MFRC522 mfrc522(SS_PIN, RST_PIN);

// 系统特征码（每组不同，前三字节必须是 ABH CDH EFH）
// 这是第 1 组的特征码，可以根据需要修改后续字节
const byte CARD_SIGNATURE[16] = {
  0xAB, 0xCD, 0xEF, 0x01,  // 特征码：ABH CDH EFH + 01H (组号)
  0x00, 0x00, 0x00, 0x00,  // 其他字节（可自由设置）
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00
};

// Mifare 默认密钥（6 字节）
const byte MFRC522_KEY[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// 第15扇区第2块的地址
const byte TARGET_BLOCK_ADDRESS = 62; // 15*4 + 2

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\nRFID Card Write Utility - System Initialization");
  Serial.println("================================================");
  Serial.println("WARNING: This will write to your card's memory!");
  Serial.println("Only use for initializing authorized access cards.");
  Serial.println("");
  
  SPI.begin();
  mfrc522.PCD_Init();
  
  Serial.println("Ready to write. Please present a card...");
}

void loop() {
  // 检查卡片
  if (!mfrc522.PICC_IsNewCardPresent()) {
    delay(500);
    return;
  }
  
  if (!mfrc522.PICC_ReadCardSerial()) {
    delay(500);
    return;
  }
  
  // 显示卡片信息
  Serial.println("\n--- Card Detected ---");
  Serial.print("UID: ");
  printHex(mfrc522.uid.uidByte, mfrc522.uid.size);
  Serial.println("");
  
  // 向卡片写入数据
  if (writeCardData()) {
    Serial.println("Write successful!");
    Serial.println("Card initialization complete.");
  } else {
    Serial.println("Write failed!");
  }
  
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  
  delay(2000);
  Serial.println("\nReady to write another card. Please present a card...");
}

bool writeCardData() {
  // 验证
  MFRC522::MIFARE_Key key;
  for (byte i = 0; i < 6; i++) {
    key.keyByte[i] = MFRC522_KEY[i];
  }
  
  // 认证块
  MFRC522::StatusCode status = mfrc522.PCD_Authenticate(
    MFRC522::PICC_CMD_MF_AUTH_KEY_A,
    TARGET_BLOCK_ADDRESS,
    &key,
    &mfrc522.uid
  );
  
  if (status != MFRC522::STATUS_OK) {
    Serial.print("Authentication failed: ");
    Serial.println(mfrc522.GetStatusCodeName(status));
    return false;
  }
  
  // 写入数据
  status = mfrc522.MIFARE_Write(TARGET_BLOCK_ADDRESS, (byte *)CARD_SIGNATURE, 16);
  
  if (status != MFRC522::STATUS_OK) {
    Serial.print("Writing failed: ");
    Serial.println(mfrc522.GetStatusCodeName(status));
    mfrc522.PCD_StopCrypto1();
    return false;
  }
  
  Serial.println("Data written to block 62 (Sector 15, Block 2):");
  Serial.print("Content: ");
  printHex((byte *)CARD_SIGNATURE, 16);
  Serial.println("");
  
  mfrc522.PCD_StopCrypto1();
  return true;
}

void printHex(byte *buffer, byte bufferSize) {
  for (byte i = 0; i < bufferSize; i++) {
    Serial.print(buffer[i] < 0x10 ? " 0" : " ");
    Serial.print(buffer[i], HEX);
  }
}
