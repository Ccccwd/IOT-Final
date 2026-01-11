import React, { useState, useMemo } from 'react';
import { Card, Tag, Button, Space, Descriptions, Spin, Empty } from 'antd';
import {
  UnlockOutlined,
  LockOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import './MapView.css';

function MapView({ bikes, loading }) {
  const [selectedBike, setSelectedBike] = useState(null);

  // 车辆状态标签颜色
  const getStatusTag = (status) => {
    const colors = {
      idle: 'green',
      riding: 'red',
      fault: 'default',
    };
    const texts = {
      idle: '空闲',
      riding: '骑行中',
      fault: '故障',
    };
    const color = colors[status] || 'default';
    const text = texts[status] || status;

    return <Tag color={color}>{text}</Tag>;
  };

  // 根据状态获取图标颜色
  const getBikeColor = (status) => {
    const colors = {
      idle: '#52c41a',
      riding: '#ff4d4f',
      fault: '#d9d9d9',
    };
    return colors[status] || '#1890ff';
  };

  // 模拟地图上的标记点（实际项目中应使用百度地图/高德地图/Leaflet）
  const bikeMarkers = useMemo(() => {
    return bikes
      .filter((bike) => bike.current_lat && bike.current_lng)
      .map((bike) => ({
        ...bike,
        // 将经纬度映射到百分比位置（简化版）
        left: ((parseFloat(bike.current_lng) - 116.3) * 1000) % 90 + 5,
        top: ((parseFloat(bike.current_lat) - 39.9) * 1000) % 80 + 10,
      }));
  }, [bikes]);

  return (
    <Card
      title={
        <Space>
          <EnvironmentOutlined />
          实时监控地图
        </Space>
      }
      bordered={false}
      bodyStyle={{ padding: 0 }}
    >
      <div className="map-container">
        {/* 简化的地图背景 */}
        <div className="map-background">
          <div className="map-grid">
            {/* 网格线 */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={`h-${i}`} className="grid-line-h" style={{ top: `${i * 10}%` }} />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={`v-${i}`} className="grid-line-v" style={{ left: `${i * 10}%` }} />
            ))}
          </div>

          {/* 车辆标记 */}
          {bikeMarkers.map((bike) => (
            <div
              key={bike.id}
              className="bike-marker"
              style={{
                left: `${bike.left}%`,
                top: `${bike.top}%`,
                backgroundColor: getBikeColor(bike.status),
              }}
              onClick={() => setSelectedBike(bike)}
            >
              <BikeIcon />
              <span className="bike-code">{bike.bike_code}</span>
            </div>
          ))}

          {loading && (
            <div className="map-loading">
              <Spin tip="加载中..." />
            </div>
          )}

          {!loading && bikeMarkers.length === 0 && (
            <div className="map-empty">
              <Empty description="暂无车辆数据" />
            </div>
          )}
        </div>

        {/* 车辆详情面板 */}
        {selectedBike && (
          <div className="bike-info-panel">
            <Card
              title={selectedBike.bike_code}
              size="small"
              extra={
                <Button
                  type="text"
                  onClick={() => setSelectedBike(null)}
                >
                  ×
                </Button>
              }
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="状态">
                  {getStatusTag(selectedBike.status)}
                </Descriptions.Item>
                <Descriptions.Item label="位置">
                  {parseFloat(selectedBike.current_lat).toFixed(6)},{' '}
                  {parseFloat(selectedBike.current_lng).toFixed(6)}
                </Descriptions.Item>
                <Descriptions.Item label="电池">
                  {selectedBike.battery}%
                </Descriptions.Item>
                <Descriptions.Item label="最后心跳">
                  {selectedBike.last_heartbeat
                    ? new Date(selectedBike.last_heartbeat).toLocaleString()
                    : '无'}
                </Descriptions.Item>
              </Descriptions>

              <Space style={{ marginTop: 12, width: '100%' }}>
                <Button
                  type="primary"
                  icon={<UnlockOutlined />}
                  size="small"
                  disabled={selectedBike.status === 'riding'}
                  block
                >
                  远程开锁
                </Button>
                <Button
                  danger
                  icon={<LockOutlined />}
                  size="small"
                  disabled={selectedBike.status === 'idle'}
                  block
                >
                  强制关锁
                </Button>
              </Space>
            </Card>
          </div>
        )}

        {/* 图例 */}
        <div className="map-legend">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#52c41a' }} />
            <span>空闲</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#ff4d4f' }} />
            <span>骑行中</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#d9d9d9' }} />
            <span>故障</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// 车辆图标组件
const BikeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1.2-.4-1.6 0l-1.6 1.6c-.6.6-.9 1.4-.9 2.2V15H9v-4.2c0-.4.2-.8.4-1.1l1.4-1.4zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z" />
  </svg>
);

export default MapView;
