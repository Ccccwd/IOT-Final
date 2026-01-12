"""
测试实时更新功能
验证 MQTT -> WebSocket -> 前端 的完整数据流
"""

import json
import time
import paho.mqtt.client as mqtt
from datetime import datetime

# MQTT 配置
BROKER = "broker.emqx.io"
PORT = 1883

def test_realtime_flow():
    """测试完整的实时数据流"""
    print("=" * 60)
    print("测试实时数据流: MQTT -> WebSocket -> 前端")
    print("=" * 60)
    print()

    # 创建 MQTT 客户端
    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)

    def on_connect(client, userdata, flags, reason_code, properties):
        print(f"✓ MQTT 连接成功 (代码: {reason_code})")

    def on_publish(client, userdata, mid, reason_code, properties):
        print(f"✓ 消息已发送 (ID: {mid})")

    client.on_connect = on_connect
    client.on_publish = on_publish

    # 连接到 broker
    print("正在连接到 MQTT broker...")
    client.connect(BROKER, PORT, 60)
    client.loop_start()

    time.sleep(1)

    # 发送测试心跳包
    test_message = {
        "timestamp": int(time.time()),
        "lat": 31.2304 + 0.001,  # 稍微改变位置
        "lng": 121.4737 + 0.001,
        "battery": 88,
        "status": "idle"
    }

    topic = "bike/001/heartbeat"
    payload = json.dumps(test_message)

    print()
    print(f"发送测试心跳包...")
    print(f"  主题: {topic}")
    print(f"  数据: {json.dumps(test_message, indent=2)}")

    client.publish(topic, payload, qos=1)

    print()
    print("等待消息处理...")
    time.sleep(2)

    print()
    print("=" * 60)
    print("检查步骤：")
    print("=" * 60)
    print()
    print("1. ✓ MQTT 消息已发送")
    print("2. → 检查后端日志，应该看到：")
    print("     - '收到 MQTT 消息: bike/001/heartbeat'")
    print("     - '✓ 心跳更新: bike_1'")
    print("     - '消息已提交到事件循环: bike/001/heartbeat'")
    print()
    print("3. → 检查前端浏览器控制台，应该看到：")
    print("     - '📨 收到 MQTT 消息: bike/001/heartbeat'")
    print("     - '[Dashboard] 收到心跳包: bike/001/heartbeat'")
    print("     - 地图上的车辆标记应该实时更新位置")
    print()
    print("4. → 数据库验证（运行 check_bike_data.py）")
    print()

    client.loop_stop()
    client.disconnect()

    print("=" * 60)
    print("测试完成！")
    print("=" * 60)
    print()
    print("如果前端没有实时更新，检查：")
    print("1. 浏览器控制台是否有错误")
    print("2. WebSocket 连接是否成功（查看 'MQTT 已连接' 标志）")
    print("3. 后端日志是否显示 WebSocket 广播成功")
    print()

if __name__ == "__main__":
    test_realtime_flow()
