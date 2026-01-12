"""简单测试数据库表结构"""
import pymysql

try:
    # 连接数据库
    conn = pymysql.connect(
        host='localhost',
        port=3307,
        user='bikeuser',
        password='bikepass123',
        database='bikesharing'
    )

    cursor = conn.cursor()

    # 查看 users 表结构
    print("✅ 数据库连接成功！\n")
    print("📋 users 表结构：")
    print("-" * 100)
    cursor.execute("DESCRIBE users")
    rows = cursor.fetchall()
    for row in rows:
        field = row[0]
        type_info = row[1]
        null = row[2]
        key = row[3]
        default = row[4]
        null_flag = "✓ 允许 NULL" if null == "YES" else "✗ 不允许 NULL"
        print(f"  {field:15} {type_info:25} {null_flag:20} Key: {key or ''}")
    print("-" * 100)

    # 检查 rfid_card 字段
    cursor.execute("SHOW COLUMNS FROM users WHERE Field = 'rfid_card'")
    row = cursor.fetchone()
    if row and row[2] == "YES":
        print("\n✅ 数据库迁移成功！")
        print("   rfid_card 字段现在允许为 NULL")
        print("   这意味着用户可以在注册时不绑定卡号，后续再绑定")
    else:
        print("\n❌ 数据库迁移可能失败")

    # 查看测试数据
    print("\n📊 当前用户数据：")
    print("-" * 100)
    cursor.execute("SELECT id, rfid_card, username, balance FROM users")
    rows = cursor.fetchall()
    for row in rows:
        print(f"  ID: {row[0]}, 卡号: {row[1]}, 用户名: {row[2]}, 余额: {row[3]}")
    print("-" * 100)

    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()
