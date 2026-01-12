import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Badge, Space, Spin } from 'antd';
import {
  CarOutlined,
  UserOutlined,
  ShoppingOutlined,
  DollarOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import MapView from './MapView';
import ControlPanel from './ControlPanel';
import { useBikes } from '../hooks/useBikes';
import { useMQTT } from '../hooks/useMQTT';
import './Dashboard.css';

function Dashboard() {
  const { bikes, stats, loading, refetch, updateBike } = useBikes();
  const { connected, subscribe } = useMQTT();
  const [selectedBike, setSelectedBike] = useState(null);

  // 处理车辆选中
  const handleBikeSelect = (bike) => {
    console.log('[Dashboard] 选中车辆:', bike.bike_code);
    setSelectedBike(bike);
  };

  // 监听 MQTT 心跳消息，实时更新车辆数据
  useEffect(() => {
    if (!connected) return;

    // 订阅心跳包主题
    const unsubscribeHeartbeat = subscribe(
      'bike/+/heartbeat',
      (topic, data) => {
        console.log('[Dashboard] 收到心跳包:', topic, data);

        // 从主题中提取 bike_id，例如: bike/001/heartbeat -> 1
        const bikeCode = topic.split('/')[1];
        const bikeId = parseInt(bikeCode);

        // 实时更新车辆数据
        updateBike(bikeId, {
          current_lat: data.lat,
          current_lng: data.lng,
          battery: data.battery,
          status: data.status,
          last_heartbeat: new Date().toISOString(),
        });
      }
    );

    // 订阅 GPS 上报主题
    const unsubscribeGps = subscribe(
      'bike/+/gps',
      (topic, data) => {
        console.log('[Dashboard] 收到GPS上报:', topic, data);

        // 从主题中提取 bike_id
        const bikeCode = topic.split('/')[1];
        const bikeId = parseInt(bikeCode);

        // 实时更新车辆位置
        updateBike(bikeId, {
          current_lat: data.lat,
          current_lng: data.lng,
          last_heartbeat: new Date().toISOString(),
        });
      }
    );

    // 清理函数
    return () => {
      unsubscribeHeartbeat();
      unsubscribeGps();
    };
  }, [connected, subscribe, updateBike]);

  if (loading && bikes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* 顶部状态栏 */}
      <div style={{ marginBottom: 16 }}>
        <Space size="large">
          <Badge
            status={connected ? 'success' : 'error'}
            text={`MQTT ${connected ? '已连接' : '断开'}`}
          />
          <Badge
            status="processing"
            text={`车辆总数: ${stats.total_bikes || 0}`}
          />
          <Badge
            status="default"
            text={`在线车辆: ${bikes.filter(b => b.last_heartbeat).length}`}
          />
          <ReloadOutlined
            onClick={refetch}
            style={{ cursor: 'pointer', fontSize: 16 }}
          />
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总车辆数"
              value={stats.total_bikes || 0}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="骑行中"
              value={stats.riding_bikes || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日订单"
              value={stats.today_orders || 0}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日收入"
              value={stats.today_revenue || 0}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 地图和控制面板 */}
      <Row gutter={16}>
        <Col span={18}>
          <MapView
            bikes={bikes}
            loading={loading}
            selectedBike={selectedBike}
            onBikeSelect={handleBikeSelect}
          />
        </Col>
        <Col span={6}>
          <ControlPanel
            bikes={bikes}
            loading={loading}
            onRefresh={refetch}
            onBikeSelect={handleBikeSelect}
          />
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
