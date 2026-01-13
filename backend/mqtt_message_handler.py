"""
MQTT消息处理器 - 处理硬件端发送的心跳和GPS消息
更新数据库中的车辆位置、电量和心跳时间
"""
from datetime import datetime
from typing import Dict, Any
import logging
from sqlalchemy.orm import Session
from models import Bike, BikeStatus

logger = logging.getLogger(__name__)


def extract_bike_id_from_topic(topic: str) -> int:
    """
    从MQTT主题中提取bike_id
    例如: bike/001/heartbeat -> 1
    """
    try:
        # 主题格式: bike/XXX/heartbeat 或 bike/XXX/gps
        parts = topic.split('/')
        if len(parts) >= 2 and parts[0] == 'bike':
            bike_code = parts[1]  # 例如: "001"
            # 尝试将bike_code转换为整数ID
            # 假设 bike_code 格式为 "001", "002" 等
            return int(bike_code)
        return None
    except (ValueError, IndexError):
        logger.warning(f"无法从主题 {topic} 提取 bike_id")
        return None


def handle_heartbeat_message(topic: str, data: Dict[str, Any], db: Session):
    """
    处理心跳包消息
    硬件端发送格式: {
        "timestamp": 12345,
        "lat": 30.3078,
        "lng": 120.4851,
        "battery": 100,
        "status": "idle" or "riding"
    }
    """
    try:
        bike_id = extract_bike_id_from_topic(topic)
        if not bike_id:
            return

        # 查找车辆
        bike = db.query(Bike).filter(Bike.id == bike_id).first()
        if not bike:
            logger.warning(f"收到心跳但车辆不存在: bike_id={bike_id}")
            return

        # 更新车辆信息（确保转换为浮点数）
        lat = float(data.get('lat', 0))
        lng = float(data.get('lng', 0))
        bike.current_lat = lat
        bike.current_lng = lng
        bike.battery = data.get('battery', 100)
        bike.last_heartbeat = datetime.now()

        # 更新状态（如果硬件端的状态与数据库不一致）
        hw_status = data.get('status')
        if hw_status in [BikeStatus.IDLE.value, BikeStatus.RIDING.value, BikeStatus.FAULT.value]:
            bike.status = hw_status

        db.commit()

        logger.info(
            f"✓ 心跳更新: bike_{bike_id} | "
            f"位置=({lat:.6f}, {lng:.6f}) | "
            f"电量={data.get('battery')}% | "
            f"状态={hw_status}"
        )

    except Exception as e:
        logger.error(f"处理心跳消息失败: {e}, data={data}")
        db.rollback()


def handle_gps_message(topic: str, data: Dict[str, Any], db: Session):
    """
    处理GPS上报消息
    硬件端发送格式: {
        "lat": 30.3078,
        "lng": 120.4851,
        "mode": "real" or "simulation",
        "timestamp": 12345
    }
    """
    try:
        bike_id = extract_bike_id_from_topic(topic)
        if not bike_id:
            return

        # 查找车辆
        bike = db.query(Bike).filter(Bike.id == bike_id).first()
        if not bike:
            logger.warning(f"收到GPS但车辆不存在: bike_id={bike_id}")
            return

        # 更新车辆位置（确保转换为浮点数）
        lat = float(data.get('lat', 0))
        lng = float(data.get('lng', 0))
        bike.current_lat = lat
        bike.current_lng = lng
        bike.last_heartbeat = datetime.now()

        db.commit()

        logger.info(
            f"✓ GPS更新: bike_{bike_id} | "
            f"位置=({lat:.6f}, {lng:.6f}) | "
            f"模式={data.get('mode')}"
        )

    except Exception as e:
        logger.error(f"处理GPS消息失败: {e}, data={data}")
        db.rollback()


def setup_mqtt_subscriptions(mqtt_client, get_db_func):
    """
    设置MQTT订阅和回调
    在应用启动时调用此函数
    """
    def create_db_callback(handler_func):
        """创建一个带数据库会话的回调函数"""
        def callback(topic: str, data: Dict[str, Any]):
            db = next(get_db_func())
            try:
                handler_func(topic, data, db)
            finally:
                db.close()
        return callback

    # 订阅心跳包主题
    mqtt_client.subscribe(
        "bike/+/heartbeat",
        create_db_callback(handle_heartbeat_message)
    )
    logger.info("✓ 已订阅主题: bike/+/heartbeat (心跳包)")

    # 订阅GPS上报主题
    mqtt_client.subscribe(
        "bike/+/gps",
        create_db_callback(handle_gps_message)
    )
    logger.info("✓ 已订阅主题: bike/+/gps (GPS上报)")
