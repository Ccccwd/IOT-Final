import paho.mqtt.client as mqtt
from typing import Callable, Dict, Any, List
import json
from datetime import datetime
from config import settings
import logging

logger = logging.getLogger(__name__)


class MQTTHandler:
    """MQTT 客户端处理器 - 支持自动重连"""

    def __init__(self):
        # 创建客户端 - 使用自动生成的 client_id 避免冲突
        import time
        client_id = f"server_backend_{int(time.time())}"

        self.client = mqtt.Client(
            client_id=client_id,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )

        # 启用自动重连
        self.client.reconnect_delay_set(min_delay=1, max_delay=60)

        self.connected = False
        self.message_callbacks: Dict[str, List[Callable]] = {}
        self.subscribed_topics: List[str] = []  # 记录已订阅的主题

        # 配置客户端（仅在提供了用户名密码时才设置）
        if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
            self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        else:
            # 本地 broker 不需要认证，确保清空
            self.client.username_pw_set(None, None)

        # 设置回调函数
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        """连接成功回调"""
        if reason_code == 0:
            self.connected = True
            logger.info(f"MQTT 连接成功: {settings.MQTT_BROKER}:{settings.MQTT_PORT}")

            # 重新订阅之前订阅的所有主题
            if self.subscribed_topics:
                self._resubscribe_topics()
            else:
                logger.info("MQTT 连接已建立，等待订阅主题...")
        else:
            logger.error(f"MQTT 连接失败，错误代码: {reason_code}")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        """断开连接回调 - paho-mqtt 会自动重连"""
        self.connected = False

        if reason_code != 0:
            logger.warning(f"MQTT 意外断开连接，错误代码: {reason_code}")
            logger.info("paho-mqtt 自动重连机制将在后台尝试重连...")
        else:
            logger.info("MQTT 正常断开连接")

    def _on_message(self, client, userdata, msg):
        """接收消息回调"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            data = json.loads(payload)

            logger.debug(f"收到 MQTT 消息: {topic} -> {data}")

            # 触发所有匹配的回调函数
            for pattern, callbacks in self.message_callbacks.items():
                if self._topic_match(topic, pattern):
                    # 调用所有注册的回调
                    for callback in callbacks:
                        try:
                            callback(topic, data)
                        except Exception as e:
                            logger.error(f"回调函数执行失败 (pattern={pattern}): {e}")

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

    def _resubscribe_topics(self):
        """重新订阅所有之前订阅的主题"""
        try:
            for topic_pattern in self.subscribed_topics:
                result = self.client.subscribe(topic_pattern, qos=1)
                if result[0] == mqtt.MQTT_ERR_SUCCESS:
                    logger.info(f"重新订阅主题: {topic_pattern}")
                else:
                    logger.error(f"重新订阅主题失败: {topic_pattern}")
        except Exception as e:
            logger.error(f"重新订阅过程中出错: {e}")

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
        logger.info("MQTT 客户端已断开连接")

    def subscribe(self, topic_pattern: str, callback: Callable):
        """订阅主题并注册回调函数（支持同一主题多个回调）"""
        if topic_pattern not in self.message_callbacks:
            self.message_callbacks[topic_pattern] = []

        self.message_callbacks[topic_pattern].append(callback)
        logger.info(f"注册主题订阅: {topic_pattern} (该主题现有 {len(self.message_callbacks[topic_pattern])} 个回调)")

        # 如果已连接，立即订阅；否则记录待订阅的主题
        if self.connected:
            result = self.client.subscribe(topic_pattern, qos=1)
            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"成功订阅 MQTT 主题: {topic_pattern}")
                if topic_pattern not in self.subscribed_topics:
                    self.subscribed_topics.append(topic_pattern)
            else:
                logger.error(f"订阅 MQTT 主题失败: {topic_pattern}")
        else:
            # 记录需要订阅的主题，连接后会自动订阅
            if topic_pattern not in self.subscribed_topics:
                self.subscribed_topics.append(topic_pattern)
                logger.info(f"记录待订阅主题（连接后自动订阅）: {topic_pattern}")

    def publish(self, topic: str, message: Dict[str, Any], qos: int = 1):
        """发布消息"""
        try:
            payload = json.dumps(message, default=str)
            self.client.publish(topic, payload, qos=qos)
            logger.debug(f"发布 MQTT 消息: {topic} -> {payload}")
        except Exception as e:
            logger.error(f"发布 MQTT 消息失败: {e}")

    def publish_command(self, bike_id: int, action: str, order_id: int = None, bike_code: str = None):
        """向车辆发送控制指令"""
        message = {
            "action": action,
            "order_id": order_id,
            "timestamp": datetime.now().isoformat()
        }
        # 使用 bike_code 构造主题（与硬件端订阅的主题匹配）
        # 硬件端订阅格式: server/001/command, server/002/command 等
        if bike_code:
            topic = f"server/{bike_code}/command"
        else:
            # 兼容旧代码，如果没有 bike_code 则使用 bike_id
            topic = f"server/{bike_id}/command"

        # 强制输出日志
        logger.info(f"📤 [MQTT] 发送控制指令: topic={topic}, action={action}, bike_code={bike_code}")
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

    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self.connected

    def get_connection_status(self) -> Dict[str, Any]:
        """获取连接状态信息"""
        return {
            "connected": self.connected,
            "broker": f"{settings.MQTT_BROKER}:{settings.MQTT_PORT}",
            "subscribed_topics": self.subscribed_topics.copy()
        }

    def manual_reconnect(self) -> bool:
        """手动触发重连"""
        try:
            if self.connected:
                logger.warning("MQTT 已连接，无需重连")
                return True

            logger.info("手动触发 MQTT 重连...")
            result = self.client.reconnect()
            return result == mqtt.MQTT_ERR_SUCCESS
        except Exception as e:
            logger.error(f"手动重连失败: {e}")
            return False


# 全局 MQTT 客户端实例
mqtt_client = MQTTHandler()


def start_mqtt():
    """启动 MQTT 客户端"""
    return mqtt_client.connect()


def stop_mqtt():
    """停止 MQTT 客户端"""
    mqtt_client.disconnect()
