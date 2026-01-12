"""
初始化车辆 001 - 用于硬件测试
运行此脚本会在数据库中创建编号为 001 的车辆（如果不存在）
"""
from database import SessionLocal
from models import Bike, BikeStatus

def init_bike_001():
    db = SessionLocal()
    try:
        # 检查车辆是否已存在
        bike = db.query(Bike).filter(Bike.bike_code == "001").first()
        
        if bike:
            print(f"✓ 车辆 001 已存在 (ID: {bike.id}, 状态: {bike.status})")
        else:
            # 创建新车辆
            bike = Bike(
                bike_code="001",
                status=BikeStatus.IDLE.value,
                current_lat=30.3078,  # 杭州钱塘区
                current_lng=120.4851,
                battery=100
            )
            db.add(bike)
            db.commit()
            db.refresh(bike)
            print(f"✓ 已创建车辆 001 (ID: {bike.id})")
            
    except Exception as e:
        print(f"❌ 错误: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 50)
    print("初始化车辆 001")
    print("=" * 50)
    init_bike_001()
    print("=" * 50)
    print("完成！")
