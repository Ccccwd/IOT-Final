"""
MQTT 消息监控脚本
用于监控从硬件端（ESP8266）发送到后端的所有消息

运行方式：
    python test_mqtt_monitor.py

用途：
    - 测试是否能收到硬件的心跳包
    - 测试是否能收到GPS定位数据
    - 测试是否能收到RFID认证请求
    - 调试MQTT通信问题
"""

import paho.mqtt.client as mqtt
import json
from datetime import datetime
import time

# MQTT 配置（与后端配置保持一致）
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
MQTT_CLIENT_ID = "test_monitor"

# 订阅的主题
TOPICS = [
    "bike/+/heartbeat",  # 心跳包
    "bike/+/auth",       # 认证请求
    "bike/+/gps",        # GPS数据
    "server/+/response", # 服务器响应（用于调试）
]

# 统计信息
message_stats = {
    "heartbeat": 0,
    "auth": 0,
    "gps": 0,
    "response": 0,
    "total": 0
}


def on_connect(client, userdata, flags, reason_code, properties):
    """连接成功回调"""
    if reason_code == 0:
        print(f"✅ 成功连接到 MQTT Broker: {MQTT_BROKER}")
        print(f"📡 正在订阅主题...")
        for topic in TOPICS:
            client.subscribe(topic)
            print(f"   ✓ {topic}")
        print("\n" + "="*60)
        print("🎧 开始监听消息...")
        print("="*60 + "\n")
    else:
        print(f"❌ 连接失败，错误代码: {reason_code}")


def on_message(client, userdata, msg):
    """接收消息回调"""
    global message_stats

    topic = msg.topic
    payload = msg.payload.decode('utf-8')

    # 解析消息类型
    if "/heartbeat" in topic:
        msg_type = "心跳包"
        message_stats["heartbeat"] += 1
        icon = "💓"
    elif "/auth" in topic:
        msg_type = "认证请求"
        message_stats["auth"] += 1
        icon = "🔑"
    elif "/gps" in topic:
        msg_type = "GPS定位"
        message_stats["gps"] += 1
        icon = "📍"
    elif "/response" in topic:
        msg_type = "服务器响应"
        message_stats["response"] += 1
        icon = "💬"
    else:
        msg_type = "未知消息"
        icon = "❓"

    message_stats["total"] += 1

    # 格式化输出
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{icon} [{timestamp}] 收到消息 #{message_stats['total']}")
    print(f"   类型: {msg_type}")
    print(f"   主题: {topic}")

    # 尝试解析 JSON
    try:
        data = json.loads(payload)
        print(f"   内容:")
        for key, value in data.items():
            if key == "timestamp":
                continue  # 跳过时间戳字段
            print(f"      {key}: {value}")

        # 特殊处理：显示GPS坐标
        if msg_type == "GPS定位" and "latitude" in data and "longitude" in data:
            lat = data["latitude"]
            lng = data["longitude"]
            print(f"   地图: https://map.baidu.com/@{lat},{lng},13z")

        # 特殊处理：显示余额
        if "balance" in data:
            print(f"   💰 余额: {data['balance']} 元")

    except json.JSONDecodeError:
        print(f"   内容: {payload}")

    # 显示统计信息
    print(f"\n📊 消息统计:")
    print(f"   总计: {message_stats['total']} 条")
    print(f"   💓 心跳: {message_stats['heartbeat']} 次")
    print(f"   🔑 认证: {message_stats['auth']} 次")
    print(f"   📍 GPS: {message_stats['gps']} 次")
    print(f"   💬 响应: {message_stats['response']} 次")
    print("="*60)


def on_disconnect(client, userdata, flags, reason_code, properties):
    """断开连接回调"""
    if reason_code != 0:
        print(f"\n⚠️  意外断开连接，错误代码: {reason_code}")
        print("💡 正在尝试重新连接...")


def main():
    """主函数"""
    print("="*60)
    print("🚲 智能共享单车 - MQTT 消息监控工具")
    print("="*60)
    print(f"\n配置信息:")
    print(f"   Broker: {MQTT_BROKER}")
    print(f"   Port: {MQTT_PORT}")
    print(f"   Client ID: {MQTT_CLIENT_ID}")
    print(f"\n监听的主题:")
    for topic in TOPICS:
        print(f"   - {topic}")
    print("\n提示: 按 Ctrl+C 退出\n")

    # 创建 MQTT 客户端
    client = mqtt.Client(
        client_id=MQTT_CLIENT_ID,
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2
    )

    # 设置回调
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    try:
        # 连接到 Broker
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)

        # 保持连接
        client.loop_forever()

    except KeyboardInterrupt:
        print("\n\n👋 程序已退出")
        print(f"\n最终统计:")
        print(f"   总计收到: {message_stats['total']} 条消息")
        print(f"   💓 心跳: {message_stats['heartbeat']} 次")
        print(f"   🔑 认证: {message_stats['auth']} 次")
        print(f"   📍 GPS: {message_stats['gps']} 次")
        print(f"   💬 响应: {message_stats['response']} 次")
    except Exception as e:
        print(f"\n❌ 错误: {e}")


if __name__ == "__main__":
    main()
