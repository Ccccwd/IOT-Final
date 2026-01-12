"""
检查数据库中的车辆数据
"""
from database import engine
from sqlalchemy.orm import sessionmaker
from models import Bike

SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print("\n" + "="*60)
print("📊 检查数据库中的车辆数据")
print("="*60)

# 查询所有车辆
bikes = db.query(Bike).all()

print(f"\n总车辆数: {len(bikes)}\n")

if len(bikes) == 0:
    print("⚠️  数据库中没有车辆数据！")
    print("\n正在创建测试车辆...")

    # 创建测试车辆
    test_bike = Bike(
        bike_code="bike_001",
        status="idle",
        current_lat=30.3078,
        current_lng=120.4851,
        battery=100
    )
    db.add(test_bike)
    db.commit()
    db.refresh(test_bike)

    print(f"✓ 已创建测试车辆:")
    print(f"  ID: {test_bike.id}")
    print(f"  bike_code: {test_bike.bike_code}")
    print(f"  位置: ({test_bike.current_lat}, {test_bike.current_lng})")
    print(f"  电量: {test_bike.battery}%")
    print(f"  状态: {test_bike.status}")
else:
    print("车辆列表:")
    print("-" * 60)
    for bike in bikes:
        print(f"\n车辆 #{bike.id}")
        print(f"  bike_code: {bike.bike_code}")
        print(f"  状态: {bike.status}")
        print(f"  位置: ({bike.current_lat}, {bike.current_lng})")
        print(f"  电量: {bike.battery}%")
        print(f"  最后心跳: {bike.last_heartbeat}")

        # 检查是否为 bike_001
        if bike.id == 1:
            print("  ✓ 这是 bike_001 对应的车辆")

print("\n" + "="*60)
print("\n💡 说明:")
print("   - 硬件端发送主题: bike/001/heartbeat")
print("   - 提取的 bike_id 应该是: 1")
print("   - 数据库中必须有 id=1 的车辆记录")
print("   - 如果没有，系统无法更新该车辆的数据")
print("\n" + "="*60 + "\n")

db.close()
