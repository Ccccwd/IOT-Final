"""
调试坐标更新问题 - 检查数据类型和值
"""
import json
from database import engine
from sqlalchemy.orm import sessionmaker
from models import Bike
from mqtt_message_handler import handle_heartbeat_message

SessionLocal = sessionmaker(bind=engine)

print("\n" + "="*60)
print("DEBUG: Coordinate Update Issue")
print("="*60)

# 创建数据库会话
db = SessionLocal()

# 检查是否有测试车辆
bike = db.query(Bike).filter(Bike.id == 1).first()

if not bike:
    print("\nWARNING: No bike with id=1 in database, please run check_bike_data.py first")
    db.close()
    exit(1)

print(f"\nBEFORE update:")
print(f"  ID: {bike.id}")
print(f"  bike_code: {bike.bike_code}")
print(f"  位置: ({bike.current_lat}, {bike.current_lng})")
print(f"  位置类型: ({type(bike.current_lat)}, {type(bike.current_lng)})")
print(f"  电量: {bike.battery}%")
print(f"  状态: {bike.status}")

# 记录测试前的值
before_lat = bike.current_lat
before_lng = bike.current_lng
before_lat_type = type(bike.current_lat)
before_lng_type = type(bike.current_lng)

# 模拟MQTT心跳消息 - 使用不同的坐标
topic = "bike/001/heartbeat"
test_lat = 31.2304  # 使用新的坐标（上海）
test_lng = 121.4737
data = {
    "timestamp": 1234567890,
    "lat": test_lat,
    "lng": test_lng,
    "battery": 88,
    "status": "idle"
}

print(f"\nSENDING MQTT message:")
print(f"  Topic: {topic}")
print(f"  Coordinates: ({test_lat}, {test_lng})")
print(f"  Coordinate types: ({type(test_lat)}, {type(test_lng)})")

# Process message
try:
    handle_heartbeat_message(topic, data, db)
    print("\nSUCCESS: Message processed!")
except Exception as e:
    print(f"\nERROR: Message processing failed: {e}")
    import traceback
    traceback.print_exc()
    db.close()
    exit(1)

# 刷新数据以查看更新
db.refresh(bike)

print(f"\nAFTER update:")
print(f"  ID: {bike.id}")
print(f"  bike_code: {bike.bike_code}")
print(f"  位置: ({bike.current_lat}, {bike.current_lng})")
print(f"  位置类型: ({type(bike.current_lat)}, {type(bike.current_lng)})")
print(f"  电量: {bike.battery}%")
print(f"  状态: {bike.status}")

# 记录测试后的值
after_lat = bike.current_lat
after_lng = bike.current_lng
after_lat_type = type(bike.current_lat)
after_lng_type = type(bike.current_lng)

# Detailed verification
print("\n" + "="*60)
print("VERIFICATION:")
print("="*60)

print(f"\n[1] Latitude:")
print(f"   Before: {before_lat} (type: {before_lat_type})")
print(f"   After:  {after_lat} (type: {after_lat_type})")
print(f"   Expected: {test_lat} (type: {type(test_lat)})")
if after_lat is not None:
    diff = abs(float(after_lat) - test_lat)
    print(f"   Difference: {diff}")
    if diff < 0.000001:
        print(f"   PASS: Latitude updated successfully")
    else:
        print(f"   FAIL: Latitude update failed")
else:
    print(f"   FAIL: Latitude is None")

print(f"\n[2] Longitude:")
print(f"   Before: {before_lng} (type: {before_lng_type})")
print(f"   After:  {after_lng} (type: {after_lng_type})")
print(f"   Expected: {test_lng} (type: {type(test_lng)})")
if after_lng is not None:
    diff = abs(float(after_lng) - test_lng)
    print(f"   Difference: {diff}")
    if diff < 0.000001:
        print(f"   PASS: Longitude updated successfully")
    else:
        print(f"   FAIL: Longitude update failed")
else:
    print(f"   FAIL: Longitude is None")

print(f"\n[3] Battery:")
print(f"   After: {bike.battery}%")
print(f"   Expected: 88%")
if bike.battery == 88:
    print(f"   PASS: Battery updated successfully")
else:
    print(f"   FAIL: Battery update failed")

print("\n" + "="*60)
print("\nNOTES:")
print("   - DECIMAL type in Python shows as decimal.Decimal")
print("   - Comparison requires float conversion or Decimal comparison")
print("   - If coordinate update fails, it may be a database field type issue")
print("="*60 + "\n")

db.close()
