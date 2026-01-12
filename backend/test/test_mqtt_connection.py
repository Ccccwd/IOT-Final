"""
MQTT 连接诊断脚本
用于测试 MQTT broker 连接问题
"""
import paho.mqtt.client as mqtt
import time
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# 测试配置
BROKER = "broker.emqx.io"
PORT = 1883
KEEPALIVE = 60

# 测试多个备选 broker
TEST_BROKERS = [
    ("broker.emqx.io", 1883, "EMQX 公共 Broker"),
    ("test.mosquitto.org", 1883, "Mosquitto 测试 Broker"),
    ("public.mqtthq.com", 1883, "MQTT HQ 公共 Broker"),
]

def on_connect(client, userdata, flags, reason_code, properties):
    """连接回调"""
    if reason_code == 0:
        logger.info(f"✓ 成功连接到 {client._host}:{client._port}")
        # 测试订阅
        client.subscribe("test/topic", qos=1)
        logger.info("✓ 成功订阅测试主题")
    else:
        logger.error(f"✗ 连接失败，错误代码: {reason_code}")

def on_disconnect(client, userdata, flags, reason_code, properties):
    """断开连接回调"""
    if reason_code != 0:
        logger.warning(f"✗ 意外断开连接，错误代码: {reason_code}")
    else:
        logger.info("正常断开连接")

def on_message(client, userdata, msg):
    """消息回调"""
    logger.info(f"收到消息: {msg.topic} -> {msg.payload.decode()}")

def on_subscribe(client, userdata, mid, reason_codes, properties):
    """订阅回调"""
    logger.info(f"订阅确认: {mid}")

def test_broker(broker, port, name):
    """测试单个 broker"""
    logger.info(f"\n{'='*60}")
    logger.info(f"正在测试: {name} ({broker}:{port})")
    logger.info(f"{'='*60}")

    try:
        # 创建客户端
        client = mqtt.Client(
            client_id=f"test_client_{int(time.time())}",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )

        # 设置回调
        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = on_message
        client.on_subscribe = on_subscribe

        # 启用自动重连
        client.reconnect_delay_set(min_delay=1, max_delay=30)

        # 尝试连接
        logger.info(f"正在连接到 {broker}:{port}...")
        client.connect(broker, port, keepalive=KEEPALIVE)

        # 启动网络循环
        client.loop_start()

        # 等待连接建立
        timeout = 10  # 10秒超时
        start_time = time.time()

        while not client.is_connected() and (time.time() - start_time) < timeout:
            time.sleep(0.5)

        if client.is_connected():
            logger.info(f"✓ 连接稳定，保持 5 秒...")

            # 发送测试消息
            client.publish("test/topic", f"Test message from {broker}", qos=1)
            logger.info("✓ 发送测试消息成功")

            # 保持连接
            time.sleep(5)

            logger.info(f"✓ {name} 测试通过！")
            success = True
        else:
            logger.error(f"✗ {name} 连接超时")
            success = False

        # 清理
        client.loop_stop()
        client.disconnect()

        return success

    except Exception as e:
        logger.error(f"✗ {name} 测试失败: {e}")
        return False

def main():
    """主测试函数"""
    logger.info("\n" + "="*60)
    logger.info("MQTT Broker 连接诊断工具")
    logger.info("="*60)

    results = {}

    for broker, port, name in TEST_BROKERS:
        success = test_broker(broker, port, name)
        results[name] = success
        time.sleep(2)  # 等待2秒再测试下一个

    # 打印汇总
    logger.info("\n" + "="*60)
    logger.info("测试结果汇总")
    logger.info("="*60)

    for name, success in results.items():
        status = "✓ 成功" if success else "✗ 失败"
        logger.info(f"{status}: {name}")

    # 推荐可用的 broker
    available = [name for name, success in results.items() if success]
    if available:
        logger.info(f"\n推荐使用的 Broker: {available[0]}")
    else:
        logger.error("\n所有 Broker 都无法连接！可能的原因：")
        logger.error("  1. 网络连接问题（防火墙/代理）")
        logger.error("  2. DNS 解析失败")
        logger.error("  3. 端口被阻止")
        logger.error("  4. Broker 服务暂时不可用")

if __name__ == "__main__":
    main()
