"""
WebSocket 服务器 - 为前端提供 MQTT 数据桥接

前端通过 WebSocket 连接到后端，后端订阅 MQTT 消息并转发给前端。

优点：
1. 避免浏览器的跨域和 MQTT WebSocket 限制
2. 后端统一管理 MQTT 连接
3. 更安全，不暴露 MQTT broker 地址
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import json
import logging
import asyncio
import threading
from mqtt_handler import mqtt_client

logger = logging.getLogger(__name__)

class WebSocketManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._loop = None

    def set_event_loop(self, loop):
        """设置主事件循环引用"""
        self._loop = loop

    async def connect(self, websocket: WebSocket):
        """接受新的 WebSocket 连接"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"新的 WebSocket 连接，当前连接数: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """断开 WebSocket 连接"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket 连接断开，当前连接数: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """向所有连接的客户端广播消息"""
        if not self.active_connections:
            return

        # 转换为 JSON
        data = json.dumps(message, ensure_ascii=False)

        # 向所有连接发送消息
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception as e:
                logger.error(f"发送消息失败: {e}")
                disconnected.append(connection)

        # 清理断开的连接
        for conn in disconnected:
            self.disconnect(conn)

    def broadcast_sync(self, message: dict):
        """同步版本的广播（用于从 MQTT 线程调用）"""
        if self._loop is None:
            logger.warning("事件循环未设置，无法广播消息")
            logger.debug("消息内容: %s", message)
            return

        try:
            # 使用 run_coroutine_threadsafe 从其他线程安全地调度协程
            future = asyncio.run_coroutine_threadsafe(
                self.broadcast(message),
                self._loop
            )
            logger.debug("消息已提交到事件循环: %s", message.get('topic', 'unknown'))
        except Exception as e:
            logger.error(f"提交消息到事件循环失败: {e}")

    async def send_personal(self, message: dict, websocket: WebSocket):
        """向特定客户端发送消息"""
        try:
            await websocket.send_text(json.dumps(message, ensure_ascii=False))
        except Exception as e:
            logger.error(f"发送个人消息失败: {e}")


# 创建全局 WebSocket 管理器
websocket_manager = WebSocketManager()


def setup_mqtt_forwarding():
    """设置 MQTT 消息转发到 WebSocket"""

    def on_mqtt_message(topic: str, data: dict):
        """MQTT 消息回调（在 MQTT 客户端线程中调用）"""
        # 构造 WebSocket 消息
        ws_message = {
            "type": "mqtt",
            "topic": topic,
            "data": data
        }

        # 使用同步版本的广播方法
        try:
            websocket_manager.broadcast_sync(ws_message)
            logger.debug(f"成功转发 MQTT 消息: {topic}")
        except Exception as e:
            logger.error(f"转发 MQTT 消息到 WebSocket 失败: {e}")

    # 订阅所有车辆相关的 MQTT 主题
    mqtt_client.subscribe("bike/+/heartbeat", on_mqtt_message)
    mqtt_client.subscribe("bike/+/gps", on_mqtt_message)
    mqtt_client.subscribe("bike/+/auth", on_mqtt_message)

    logger.info("MQTT 消息转发到 WebSocket 已启用")


# 启动时设置转发
# 注意：这将在 main.py 的 startup_event 中调用
