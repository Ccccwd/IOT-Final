"""
测试MQTT消息处理 - 模拟发送心跳消息并检查数据库更新
"""
import json
from database import engine
from sqlalchemy.orm import sessionmaker
from models import Bike
from mqtt_message_handler import handle_heartbeat_message, handle_gps_message

SessionLocal = sessionmaker(bind=engine)

print("\n" + "="*60)
print("TEST: MQTT Message Processing")
print("="*60)

# 创建数据库会话
db = SessionLocal()

# 检查是否有测试车辆
bike = db.query(Bike).filter(Bike.id == 1).first()

if not bike:
    print("\nWARNING: No bike with id=1 in database")
    print("Creating test bike...")

    bike = Bike(
        bike_code="bike_001",
        status="idle",
        current_lat=None,
        current_lng=None,
        battery=100
    )
    db.add(bike)
    db.commit()
    db.refresh(bike)

    print(f"OK: Bike created: ID={bike.id}, bike_code={bike.bike_code}\n")

print(f"BEFORE update:")
print(f"  ID: {bike.id}")
print(f"  bike_code: {bike.bike_code}")
print(f"  Location: ({bike.current_lat}, {bike.current_lng})")
print(f"  Battery: {bike.battery}%")
print(f"  Status: {bike.status}")
print(f"  Last heartbeat: {bike.last_heartbeat}")

# 模拟MQTT心跳消息 - 使用不同的坐标以便验证更新
topic = "bike/001/heartbeat"
data = {
    "timestamp": 1234567890,
    "lat": 31.2304,  # 上海坐标（与数据库中的杭州坐标不同）
    "lng": 121.4737,
    "battery": 85,   # 不同的电量值
    "status": "idle"
}

print(f"\nSending simulated MQTT message...")
print(f"  Topic: {topic}")
print(f"  Data: {json.dumps(data, indent=2)}")

# 处理消息
try:
    handle_heartbeat_message(topic, data, db)
    print("\nOK: Message processed successfully!")
except Exception as e:
    print(f"\nERROR: Message processing failed: {e}")
    db.close()
    exit(1)

# 刷新数据以查看更新
db.refresh(bike)

print(f"\nAFTER update:")
print(f"  ID: {bike.id}")
print(f"  bike_code: {bike.bike_code}")
print(f"  Location: ({bike.current_lat}, {bike.current_lng})")
print(f"  Battery: {bike.battery}%")
print(f"  Status: {bike.status}")
print(f"  Last heartbeat: {bike.last_heartbeat}")

# 验证更新
print("\n" + "="*60)
print("VERIFICATION RESULTS:")
print("="*60)

# 使用浮点数比较（考虑DECIMAL类型）
if bike.current_lat is not None and bike.current_lng is not None:
    lat_diff = abs(float(bike.current_lat) - 31.2304)
    lng_diff = abs(float(bike.current_lng) - 121.4737)
    if lat_diff < 0.000001 and lng_diff < 0.000001:
        print("PASS: Coordinates updated successfully")
    else:
        print(f"FAIL: Coordinate update failed: ({bike.current_lat}, {bike.current_lng})")
        print(f"   Expected: (31.2304, 121.4737)")
        print(f"   Difference: lat={lat_diff}, lng={lng_diff}")
else:
    print(f"FAIL: Coordinate update failed: coordinates are None")

if bike.battery == 85:
    print("PASS: Battery updated successfully")
else:
    print(f"FAIL: Battery update failed: {bike.battery} (expected: 85)")

if bike.last_heartbeat:
    print("PASS: Heartbeat time updated successfully")
else:
    print("FAIL: Heartbeat time update failed")

print("\n" + "="*60)
print("\nNOTES:")
print("   If all tests pass, MQTT message processing is working correctly")
print("   Possible issues if not:")
print("   1. Backend MQTT subscription not started")
print("   2. Errors in backend logs")
print("   3. Backend server needs restart")
print("="*60 + "\n")

db.close()
