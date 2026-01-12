"""
测试本地 MQTT broker 连接
"""
import paho.mqtt.client as mqtt
import time

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"✓ 成功连接到本地 MQTT broker (localhost:1883)")
        # 订阅测试主题
        client.subscribe("test/connection", qos=1)
        print(f"✓ 成功订阅主题: test/connection")
        # 发布测试消息
        client.publish("test/connection", "本地MQTT broker测试成功!", qos=1)
        print(f"✓ 发布测试消息成功")
    else:
        print(f"✗ 连接失败，错误代码: {reason_code}")

def on_disconnect(client, userdata, flags, reason_code, properties):
    if reason_code != 0:
        print(f"✗ 意外断开连接，错误代码: {reason_code}")
    else:
        print("✓ 正常断开连接")

def on_message(client, userdata, msg):
    print(f"✓ 收到消息: {msg.topic} -> {msg.payload.decode()}")

def main():
    print("="*60)
    print("本地 MQTT Broker 连接测试")
    print("="*60)
    print("\n确保 Mosquitto broker 已启动！")
    print("启动命令: mosquitto -v\n")

    try:
        # 创建客户端
        client = mqtt.Client(
            client_id="test_local_broker",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )

        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = on_message

        # 启用自动重连
        client.reconnect_delay_set(min_delay=1, max_delay=30)

        print("正在连接到 localhost:1883...")
        client.connect("localhost", 1883, keepalive=60)
        client.loop_start()

        # 等待连接
        timeout = 10
        start_time = time.time()

        while not client.is_connected() and (time.time() - start_time) < timeout:
            time.sleep(0.5)

        if client.is_connected():
            print("\n保持连接 3 秒以接收测试消息...\n")
            time.sleep(3)

            print("\n" + "="*60)
            print("✓ 本地 MQTT Broker 测试通过！")
            print("="*60)
            print("\n现在可以启动后端服务了：")
            print("  cd E:\\IOT-Final\\backend")
            print("  python main.py")
        else:
            print("\n" + "="*60)
            print("✗ 连接超时！")
            print("="*60)
            print("\n请检查：")
            print("  1. Mosquitto broker 是否已启动（mosquitto -v）")
            print("  2. 端口 1883 是否被占用")
            print("  3. 防火墙是否阻止连接")

        client.loop_stop()
        client.disconnect()

    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        print("\n可能的原因：")
        print("  1. Mosquitto 未安装或未启动")
        print("  2. 端口 1883 被占用")
        print("  3. 网络配置问题")

if __name__ == "__main__":
    main()
