"""测试数据库连接和表结构"""
import sys
sys.path.insert(0, 'E:/IOT-Final/backend')

from database import engine
from sqlalchemy import text

try:
    # 连接数据库
    with engine.connect() as conn:
        # 查看 users 表结构
        result = conn.execute(text("DESCRIBE users"))
        print("✅ 数据库连接成功！\n")
        print("📋 users 表结构：")
        print("-" * 80)
        for row in result:
            field = row[0]
            type_info = row[1]
            null = row[2]
            key = row[3]
            default = row[4]
            null_flag = "✓ 允许 NULL" if null == "YES" else "✗ 不允许 NULL"
            print(f"  {field:15} {type_info:20} {null_flag:15} Key: {key}")
        print("-" * 80)

        # 检查 rfid_card 字段是否允许 NULL
        result = conn.execute(text("SHOW COLUMNS FROM users WHERE Field = 'rfid_card'"))
        row = result.fetchone()
        if row and row[2] == "YES":
            print("\n✅ 迁移成功！rfid_card 字段现在允许为 NULL")
        else:
            print("\n❌ 迁移可能失败，rfid_card 仍然不允许 NULL")

        # 查看测试数据
        result = conn.execute(text("SELECT id, rfid_card, username, balance FROM users"))
        print("\n📊 当前用户数据：")
        print("-" * 80)
        for row in result:
            print(f"  ID: {row[0]}, 卡号: {row[1]}, 用户名: {row[2]}, 余额: {row[3]}")
        print("-" * 80)

except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()
