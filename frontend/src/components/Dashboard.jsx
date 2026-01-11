import React from 'react';
import { Card, Row, Col, Statistic, Badge, Space, Spin } from 'antd';
import {
  BikeOutlined,
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
  const { bikes, stats, loading, refetch } = useBikes();
  const { connected } = useMQTT();

  if (loading && bikes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载中..." />
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
              prefix={<BikeOutlined />}
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
          <MapView bikes={bikes} loading={loading} />
        </Col>
        <Col span={6}>
          <ControlPanel bikes={bikes} loading={loading} onRefresh={refetch} />
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
