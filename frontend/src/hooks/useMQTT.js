import { useState, useEffect, useCallback, useRef } from 'react';
import mqttService from '../services/mqtt';

export const useMQTT = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const isConnecting = useRef(false);

  // 连接 MQTT
  const connect = useCallback(async () => {
    if (isConnecting.current || connected) {
      return;
    }

    isConnecting.current = true;

    try {
      await mqttService.connect();
      setConnected(true);
    } catch (error) {
      console.error('MQTT 连接失败:', error);
      setConnected(false);
    } finally {
      isConnecting.current = false;
    }
  }, [connected]);

  // 断开连接
  const disconnect = useCallback(() => {
    mqttService.disconnect();
    setConnected(false);
  }, []);

  // 发布消息
  const publish = useCallback((topic, message, qos = 1) => {
    mqttService.publish(topic, message, qos);
  }, []);

  // 订阅主题
  const subscribe = useCallback((event, callback) => {
    mqttService.on(event, callback);

    // 返回取消订阅函数
    return () => {
      mqttService.off(event, callback);
    };
  }, []);

  // 组件挂载时自动连接
  useEffect(() => {
    connect();

    // 组件卸载时断开连接
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // 监听所有消息（用于调试）
  useEffect(() => {
    if (!connected) return;

    const unsubscribe = subscribe('bike/#', (topic, data) => {
      console.log('收到 MQTT 消息:', topic, data);
      setMessages((prev) => [...prev, { topic, data, timestamp: Date.now() }]);

      // 只保留最近 100 条消息
      setMessages((prev) => prev.slice(-100));
    });

    return unsubscribe;
  }, [connected, subscribe]);

  return {
    connected,
    messages,
    connect,
    disconnect,
    publish,
    subscribe,
  };
};

export default useMQTT;
