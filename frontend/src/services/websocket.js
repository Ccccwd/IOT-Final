/**
 * WebSocket 服务 - 连接到后端 WebSocket 端点
 *
 * 后端会订阅 MQTT 消息并通过 WebSocket 转发给前端
 * 这样避免了浏览器直接连接 MQTT broker 的限制
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        // 连接到后端 WebSocket 端点
        const wsUrl = `ws://localhost:8000/ws`;

        console.log('正在连接后端 WebSocket...');
        console.log('地址:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        // 连接成功
        this.ws.onopen = () => {
          console.log('✅ WebSocket 连接成功');
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve(this.ws);
        };

        // 连接错误
        this.ws.onerror = (error) => {
          console.error('❌ WebSocket 连接错误:', error);
          this.connected = false;
          reject(error);
        };

        // 连接关闭
        this.ws.onclose = (event) => {
          console.log('WebSocket 连接关闭', event.code, event.reason);
          this.connected = false;

          // 尝试重新连接
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch(err => {
                console.error('重新连接失败:', err);
              });
            }, 5000);
          } else {
            console.error('❌ 已达到最大重连次数，停止重连');
          }
        };

        // 接收消息
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
          } catch (error) {
            console.error('解析 WebSocket 消息失败:', error);
          }
        };

      } catch (error) {
        console.error('创建 WebSocket 连接失败:', error);
        reject(error);
      }
    });
  }

  _handleMessage(message) {
    // 处理来自后端的消息
    if (message.type === 'mqtt') {
      // MQTT 消息转发
      const { topic, data } = message;
      console.log('📨 收到 MQTT 消息:', topic, data);
      console.log('[WebSocket] 当前注册的监听器:', Object.keys(this.listeners));

      // 触发所有注册的监听器
      Object.keys(this.listeners).forEach((pattern) => {
        const matched = this._topicMatch(topic, pattern);
        console.log('[WebSocket] 匹配测试 - topic:', topic, 'pattern:', pattern, 'matched:', matched);
        if (matched) {
          console.log('[WebSocket] 触发监听器:', pattern, '回调数量:', this.listeners[pattern].length);
          this.listeners[pattern].forEach((callback) => {
            console.log('[WebSocket] 执行回调函数');
            callback(topic, data);
          });
        }
      });
    }
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
    console.log('[WebSocket] 注册监听器:', event, '该事件监听器数量:', this.listeners[event].length);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  send(message) {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket 未连接，无法发送消息');
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      console.log('WebSocket 已断开连接');
    }
  }
}

// 创建全局单例
const websocketService = new WebSocketService();

export default websocketService;
