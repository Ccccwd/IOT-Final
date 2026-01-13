import { useState, useEffect, useCallback, useRef } from 'react';
import websocketService from '../services/websocket';

export const useMQTT = () => {
  console.log('[useMQTT] 🔧 Hook被调用');
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const isConnecting = useRef(false);

  console.log('[useMQTT] 当前connected状态:', connected);

  // 连接 WebSocket（实际上是通过 WebSocket 接收 MQTT 消息）
  const connect = useCallback(async () => {
    console.log('[useMQTT] 🔗 connect函数被调用, isConnecting:', isConnecting.current, 'connected:', connected);

    if (isConnecting.current || connected) {
      console.log('[useMQTT] ⚠️ 已连接或正在连接，跳过连接');
      return;
    }

    console.log('[useMQTT] 🚀 开始连接WebSocket...');
    isConnecting.current = true;

    try {
      await websocketService.connect();
      setConnected(true);
      console.log('[useMQTT] ✅ WebSocket连接成功，connected状态已设为true');
    } catch (error) {
      console.error('[useMQTT] ❌ WebSocket连接失败:', error);
      setConnected(false);
    } finally {
      isConnecting.current = false;
    }
  }, []); // 移除connected依赖，避免无限循环

  // 断开连接
  const disconnect = useCallback(() => {
    websocketService.disconnect();
    setConnected(false);
  }, []);

  // 发布消息（通过 WebSocket 发送，后端会转发到 MQTT）
  const publish = useCallback((topic, message, qos = 1) => {
    websocketService.send({
      type: 'mqtt_publish',
      topic,
      message,
      qos
    });
  }, []);

  // 订阅主题
  const subscribe = useCallback((event, callback) => {
    console.log('[useMQTT] 注册订阅:', event, 'callback:', callback.name || 'anonymous');
    websocketService.on(event, callback);

    // 返回取消订阅函数
    return () => {
      console.log('[useMQTT] 取消订阅:', event);
      websocketService.off(event, callback);
    };
  }, []);

  // 组件挂载时自动连接
  useEffect(() => {
    console.log('[useMQTT] 🎯 useEffect执行，准备连接WebSocket');
    console.log('[useMQTT] connect函数引用:', connect);
    console.log('[useMQTT] disconnect函数引用:', disconnect);

    // 调用connect
    connect();

    // 组件卸载时断开连接
    return () => {
      console.log('[useMQTT] 🔄 清理函数执行，组件卸载');
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 监听所有消息（用于调试）
  useEffect(() => {
    if (!connected) return;

    const unsubscribe = subscribe('bike/#', (topic, data) => {
      console.log('📨 收到 MQTT 消息:', topic, data);
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
