import paho.mqtt.client as mqtt
from typing import Callable, Dict, Any
import json
from datetime import datetime
from config import settings
import logging

logger = logging.getLogger(__name__)


class MQTTHandler:
    """MQTT 客户端处理器"""

    def __init__(self):
        self.client = mqtt.Client(client_id="server_backend", callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
        self.connected = False
        self.message_callbacks: Dict[str, Callable] = {}

        # 配置客户端
        if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
            self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

        # 设置回调函数
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        """连接成功回调"""
        if reason_code == 0:
            self.connected = True
            logger.info(f"MQTT 连接成功: {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
            # 订阅所有车辆的主题
            client.subscribe("bike/+/heartbeat")
            client.subscribe("bike/+/auth")
            client.subscribe("bike/+/gps")
            logger.info("已订阅所有车辆主题")
        else:
            logger.error(f"MQTT 连接失败，错误代码: {reason_code}")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        """断开连接回调"""
        self.connected = False
        if reason_code != 0:
            logger.warning(f"MQTT 意外断开连接，错误代码: {reason_code}")

    def _on_message(self, client, userdata, msg):
        """接收消息回调"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            data = json.loads(payload)

            logger.debug(f"收到 MQTT 消息: {topic} -> {data}")

            # 触发回调函数
            for pattern, callback in self.message_callbacks.items():
                if self._topic_match(topic, pattern):
                    callback(topic, data)

        except Exception as e:
            logger.error(f"处理 MQTT 消息错误: {e}")

    def _topic_match(self, topic: str, pattern: str) -> bool:
        """匹配主题通配符"""
        # 将通配符转换为正则表达式
        # + 匹配单个层级，# 匹配多个层级
        import re
        regex = pattern.replace("+", "[^/]+").replace("#", ".*")
        regex = "^" + regex + "$"
        return bool(re.match(regex, topic))

    def connect(self) -> bool:
        """连接到 MQTT Broker"""
        try:
            self.client.connect(
                settings.MQTT_BROKER,
                settings.MQTT_PORT,
                settings.MQTT_KEEPALIVE
            )
            self.client.loop_start()
            return True
        except Exception as e:
            logger.error(f"MQTT 连接失败: {e}")
            return False

    def disconnect(self):
        """断开连接"""
        self.client.loop_stop()
        self.client.disconnect()
        self.connected = False

    def subscribe(self, topic_pattern: str, callback: Callable):
        """订阅主题并注册回调函数"""
        self.message_callbacks[topic_pattern] = callback
        logger.info(f"注册主题订阅: {topic_pattern}")

    def publish(self, topic: str, message: Dict[str, Any], qos: int = 1):
        """发布消息"""
        try:
            payload = json.dumps(message, default=str)
            self.client.publish(topic, payload, qos=qos)
            logger.debug(f"发布 MQTT 消息: {topic} -> {payload}")
        except Exception as e:
            logger.error(f"发布 MQTT 消息失败: {e}")

    def publish_command(self, bike_id: int, action: str, order_id: int = None):
        """向车辆发送控制指令"""
        message = {
            "action": action,
            "order_id": order_id,
            "timestamp": datetime.now().isoformat()
        }
        topic = f"server/{bike_id}/command"
        self.publish(topic, message)

    def publish_response(self, bike_id: int, success: bool, message: str,
                        balance: float = None, order_id: int = None):
        """向车辆发送认证响应"""
        response = {
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        if balance is not None:
            response["balance"] = balance
        if order_id is not None:
            response["order_id"] = order_id

        topic = f"server/{bike_id}/response"
        self.publish(topic, response)


# 全局 MQTT 客户端实例
mqtt_client = MQTTHandler()


def start_mqtt():
    """启动 MQTT 客户端"""
    return mqtt_client.connect()


def stop_mqtt():
    """停止 MQTT 客户端"""
    mqtt_client.disconnect()
