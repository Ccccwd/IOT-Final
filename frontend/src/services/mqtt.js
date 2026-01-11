import mqtt from 'mqtt';

// MQTT 配置
const MQTT_BROKER = 'broker.emqx.io';
const MQTT_PORT = 8084; // WebSocket Secure 端口
const MQTT_URL = `wss://${MQTT_BROKER}:${MQTT_PORT}/mqtt`;

class MQTTService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    return new Promise((resolve, reject) => {
      // 生成随机客户端 ID
      const clientId = `web_client_${Math.random().toString(16).substr(2, 8)}`;

      this.client = mqtt.connect(MQTT_URL, {
        clientId,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 10000,
      });

      // 连接成功
      this.client.on('connect', () => {
        console.log('MQTT 连接成功');
        this.connected = true;
        this.reconnectAttempts = 0;

        // 订阅主题
        this.subscribeTopics();

        resolve(this.client);
      });

      // 连接错误
      this.client.on('error', (err) => {
        console.error('MQTT 连接错误:', err);
        this.connected = false;
        reject(err);
      });

      // 连接断开
      this.client.on('close', () => {
        console.log('MQTT 连接关闭');
        this.connected = false;
      });

      // 重新连接
      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        console.log(`MQTT 重新连接中... (${this.reconnectAttempts})`);

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error('MQTT 重新连接失败，已达到最大尝试次数');
          this.client.end();
        }
      });

      // 接收消息
      this.client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          this._handleMessage(topic, data);
        } catch (error) {
          console.error('解析 MQTT 消息失败:', error);
        }
      });
    });
  }

  subscribeTopics() {
    if (!this.client || !this.connected) {
      console.warn('MQTT 未连接，无法订阅主题');
      return;
    }

    // 订阅所有车辆的心跳
    this.client.subscribe('bike/+/heartbeat', { qos: 0 });

    // 订阅所有车辆的 GPS 数据
    this.client.subscribe('bike/+/gps', { qos: 0 });

    // 订阅所有车辆的状态更新
    this.client.subscribe('bike/+/status', { qos: 0 });

    console.log('已订阅所有车辆主题');
  }

  _handleMessage(topic, data) {
    // 触发所有注册的监听器
    Object.keys(this.listeners).forEach((event) => {
      if (this._topicMatch(topic, event)) {
        this.listeners[event].forEach((callback) => {
          callback(topic, data);
        });
      }
    });
  }

  _topicMatch(topic, pattern) {
    // 简单的通配符匹配
    const regex = pattern.replace('+', '[^/]+').replace('#', '.*');
    return new RegExp(`^${regex}$`).test(topic);
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  publish(topic, message, qos = 1) {
    if (!this.client || !this.connected) {
      console.warn('MQTT 未连接，无法发送消息');
      return;
    }

    this.client.publish(topic, JSON.stringify(message), { qos });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.connected = false;
      console.log('MQTT 已断开连接');
    }
  }
}

// 创建全局单例
const mqttService = new MQTTService();

export default mqttService;
