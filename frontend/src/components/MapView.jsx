import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Tag, Button, Space, Descriptions, Spin, Empty, message } from 'antd';
import {
  UnlockOutlined,
  LockOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { MAP_CONFIG } from '../config/mapConfig';
import { loadBaiduMapScript, isBaiduMapLoaded } from '../utils/loadBaiduMap';
import { wgs84ToBd09, isValidCoord } from '../utils/mapUtils';
import './MapView.css';

function MapView({ bikes, loading, selectedBike: externalSelectedBike, onBikeSelect }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const infoWindowRef = useRef(null);
  const [internalSelectedBike, setInternalSelectedBike] = useState(null);
  const [mapLoading, setMapLoading] = useState(false); // 改为 false，避免死锁
  const [mapError, setMapError] = useState(null);
  const [containerReady, setContainerReady] = useState(false);
  const [initTriggered, setInitTriggered] = useState(false); // 防止重复初始化
  const [isInitializing, setIsInitializing] = useState(false); // 初始化进行中标记

  // 使用外部传入的 selectedBike，如果没有则使用内部状态
  const selectedBike = externalSelectedBike !== undefined ? externalSelectedBike : internalSelectedBike;

  console.log('[MapView] 组件渲染开始, bikes.length:', bikes.length, 'loading:', loading, 'mapLoading:', mapLoading);

  // 回调 ref：当容器被设置时触发
  const setMapContainerRef = useCallback((node) => {
    console.log('[MapView] setMapContainerRef 被调用, node:', node ? 'DOM节点' : null);
    if (node) {
      mapContainerRef.current = node;
      console.log('[MapView] 地图容器 ref 已设置, offsetWidth:', node.offsetWidth);
      setContainerReady(true);
    } else {
      console.log('[MapView] 地图容器 ref 被清空');
      setContainerReady(false);
    }
    return undefined;
  }, []);

  // 初始化地图
  const initMap = useCallback(async () => {
    try {
      setIsInitializing(true);
      setMapError(null);

      // 检查 AK
      console.log('[MapView] 开始初始化地图, AK:', MAP_CONFIG.ak ? `${MAP_CONFIG.ak.substring(0, 10)}...` : '未设置');

      // 检查容器是否准备好
      if (!mapContainerRef.current) {
        console.error('[MapView] 地图容器 ref 未设置');
        throw new Error('地图容器未准备好');
      }

      console.log('[MapView] 地图容器已准备就绪');

      // 加载百度地图脚本
      if (!isBaiduMapLoaded()) {
        console.log('[MapView] 加载百度地图脚本...');
        await loadBaiduMapScript(MAP_CONFIG.ak);
        console.log('[MapView] 百度地图脚本加载完成');
      } else {
        console.log('[MapView] 百度地图已加载，跳过');
      }

      console.log('[MapView] 开始创建地图实例...');
      console.log('[MapView] BMap 可用:', typeof window.BMap !== 'undefined');

      // 创建地图实例
      const map = new window.BMap.Map(mapContainerRef.current, {
        enableMapClick: false,
        minZoom: 10,
        maxZoom: 18,
      });

      console.log('[MapView] 地图实例创建成功');

      // 设置中心点和缩放级别
      const point = new window.BMap.Point(
        MAP_CONFIG.center.lng,
        MAP_CONFIG.center.lat
      );
      map.centerAndZoom(point, MAP_CONFIG.zoom);

      console.log('[MapView] 地图中心点已设置');

      // 启用滚轮缩放
      map.enableScrollWheelZoom(true);

      // 添加控件
      map.addControl(new window.BMap.NavigationControl());
      map.addControl(new window.BMap.ScaleControl());

      console.log('[MapView] 地图控件已添加');

      mapRef.current = map;

      // 创建 InfoWindow
      infoWindowRef.current = new window.BMap.InfoWindow('', {
        width: 300,
        height: 200,
        title: '',
      });

      console.log('[MapView] ✅ 地图初始化完成');
      setIsInitializing(false);
    } catch (error) {
      console.error('[MapView] ❌ 地图初始化失败:', error);
      setMapError(error.message || '地图加载失败，请检查配置');
      setIsInitializing(false);
    }
  }, []);

  // 添加或更新 Marker
  const updateMarkers = useCallback(() => {
    if (!mapRef.current || !window.BMap) {
      console.log('[MapView] updateMarkers: 地图或BMap未准备好');
      return;
    }

    const map = mapRef.current;

    // 清除旧的 Marker
    Object.values(markersRef.current).forEach((marker) => {
      map.removeOverlay(marker);
    });
    markersRef.current = {};

    console.log('[MapView] updateMarkers: 开始添加标记，车辆总数:', bikes.length);

    // 添加新的 Marker
    bikes.forEach((bike) => {
      if (!isValidCoord(bike.current_lat, bike.current_lng)) {
        console.log('[MapView] 跳过无效坐标的车辆:', bike.bike_code, '坐标:', bike.current_lat, bike.current_lng);
        return;
      }

      // 坐标转换（假设原始数据是 WGS84）
      const bd09Coord = wgs84ToBd09(
        parseFloat(bike.current_lat),
        parseFloat(bike.current_lng)
      );

      const point = new window.BMap.Point(bd09Coord.lng, bd09Coord.lat);

      console.log('[MapView] 添加车辆标记:', bike.bike_code, 'BD09坐标:', bd09Coord);

      // 创建自定义图标
      const iconColor = getBikeIconColor(bike.status);
      const marker = new window.BMap.Marker(point, {
        icon: new window.BMap.Icon(
          `data:image/svg+xml;base64,${btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
              <path d="M15 0C6.7 0 0 6.7 0 15c0 8.3 15 25 15 25s15-16.7 15-25C30 6.7 23.3 0 15 0z" fill="${iconColor}"/>
              <circle cx="15" cy="15" r="8" fill="white"/>
              <text x="15" y="19" font-size="10" text-anchor="middle" fill="${iconColor}">${bike.bike_code?.split('_')[1] || '?'}</text>
            </svg>
          `)}`,
          new window.BMap.Size(30, 40),
          {
            anchor: new window.BMap.Size(15, 40),
            imageSize: new window.BMap.Size(30, 40),
          }
        ),
      });

      // 添加点击事件
      marker.addEventListener('click', () => {
        console.log('[MapView] Marker点击:', bike.bike_code);
        if (onBikeSelect) {
          onBikeSelect(bike);
        } else {
          setInternalSelectedBike(bike);
        }
        showInfoWindow(bike, point);
      });

      // 添加到地图
      map.addOverlay(marker);
      markersRef.current[bike.id] = marker;
    });

    console.log('[MapView] updateMarkers: 完成，已添加', Object.keys(markersRef.current).length, '个标记');
  }, [bikes, onBikeSelect]);

  // 显示 InfoWindow
  const showInfoWindow = (bike, point) => {
    if (!infoWindowRef.current) {
      return;
    }

    const content = `
      <div style="padding: 10px; min-width: 280px;">
        <h4 style="margin: 0 0 10px 0;">${bike.bike_code}</h4>
        <p style="margin: 5px 0;"><strong>状态：</strong>${getStatusText(bike.status)}</p>
        <p style="margin: 5px 0;"><strong>位置：</strong>${bike.current_lat?.toFixed(6)}, ${bike.current_lng?.toFixed(6)}</p>
        <p style="margin: 5px 0;"><strong>电量：</strong>${bike.battery || 0}%</p>
        <p style="margin: 5px 0;"><strong>最后心跳：</strong>${bike.last_heartbeat ? new Date(bike.last_heartbeat).toLocaleString() : '无'}</p>
        <div style="margin-top: 15px;">
          <button
            onclick="window.handleBikeControl(${bike.id}, 'unlock')"
            style="margin-right: 10px;"
            ${bike.status === 'riding' ? 'disabled' : ''}
          >远程开锁</button>
          <button
            onclick="window.handleBikeControl(${bike.id}, 'lock')"
            ${bike.status === 'idle' ? 'disabled' : ''}
          >强制关锁</button>
        </div>
      </div>
    `;

    infoWindowRef.current.setContent(content);
    mapRef.current.openInfoWindow(infoWindowRef.current, point);
  };

  // 远程控制处理
  const handleBikeControl = async (bikeId, action) => {
    try {
      const response = await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bike_id: bikeId,
          command: action === 'unlock' ? 'force_unlock' : 'force_lock',
        }),
      });

      if (response.ok) {
        message.success(`${action === 'unlock' ? '开锁' : '关锁'}指令已发送`);
      } else {
        throw new Error('指令发送失败');
      }
    } catch (error) {
      message.error(`操作失败: ${error.message}`);
    }
  };

  // 挂载全局控制函数（供 InfoWindow 中的按钮调用）
  useEffect(() => {
    window.handleBikeControl = handleBikeControl;
    return () => {
      delete window.handleBikeControl;
    };
  }, [handleBikeControl]);

  // 车辆状态辅助函数
  const getStatusText = (status) => {
    const texts = {
      idle: '空闲',
      riding: '骑行中',
      fault: '故障',
    };
    return texts[status] || status;
  };

  const getBikeIconColor = (status) => {
    const colors = {
      idle: '#52c41a',
      riding: '#ff4d4f',
      fault: '#d9d9d9',
    };
    return colors[status] || '#1890ff';
  };

  // 更新 Marker
  useEffect(() => {
    if (!isInitializing && mapRef.current) {
      console.log('[MapView] 更新地图标记，车辆数量:', bikes.length);
      updateMarkers();
    }
  }, [bikes, isInitializing, updateMarkers]);

  // 监听选中车辆变化，跳转到对应位置
  useEffect(() => {
    if (!selectedBike || !mapRef.current || !window.BMap) {
      return;
    }

    console.log('[MapView] 选中车辆变化:', selectedBike.bike_code);

    // 检查坐标是否有效
    if (!isValidCoord(selectedBike.current_lat, selectedBike.current_lng)) {
      console.warn('[MapView] 选中车辆的坐标无效:', selectedBike.current_lat, selectedBike.current_lng);
      return;
    }

    // 坐标转换
    const bd09Coord = wgs84ToBd09(
      parseFloat(selectedBike.current_lat),
      parseFloat(selectedBike.current_lng)
    );

    const point = new window.BMap.Point(bd09Coord.lng, bd09Coord.lat);

    // 移动地图中心并缩放
    mapRef.current.centerAndZoom(point, 16);

    console.log('[MapView] 地图已跳转到车辆位置:', selectedBike.bike_code, bd09Coord);

    // 打开信息窗口
    showInfoWindow(selectedBike, point);

    // 高亮对应的 marker
    const marker = markersRef.current[selectedBike.id];
    if (marker) {
      console.log('[MapView] 高亮标记:', selectedBike.bike_code);
      // 可以在这里添加动画效果
      marker.setAnimation(window.BMap_ANIMATION_BOUNCE);
      // 2秒后停止动画
      setTimeout(() => {
        marker.setAnimation(null);
      }, 2000);
    }
  }, [selectedBike]);

  // 监听容器准备好后初始化地图（只执行一次）
  useEffect(() => {
    if (containerReady && !initTriggered && !mapError) {
      console.log('[MapView] 容器已准备好，开始初始化地图');
      setInitTriggered(true); // 标记已触发
      initMap().catch(error => {
        console.error('[MapView] 地图初始化失败:', error);
      });
    }
  }, [containerReady, initTriggered, mapError]);

  // 如果没有配置 AK
  if (!MAP_CONFIG.ak) {
    return (
      <Card
        title={
          <Space>
            <EnvironmentOutlined />
            实时监控地图
          </Space>
        }
        variant="borderless"
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Empty
            description={
              <div>
                <p>百度地图 API Key 未配置</p>
                <p style={{ fontSize: 12, color: '#999' }}>
                  请参考 docs/百度地图接入指南.md 申请并配置 API Key
                </p>
              </div>
            }
          />
        </div>
      </Card>
    );
  }

  // 加载错误
  if (mapError) {
    return (
      <Card
        title={
          <Space>
            <EnvironmentOutlined />
            实时监控地图
          </Space>
        }
        variant="borderless"
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Empty
            description={
              <div>
                <p style={{ color: '#ff4d4f' }}>{mapError}</p>
                <p style={{ fontSize: 12, color: '#999' }}>
                  请检查 API Key 配置是否正确
                </p>
              </div>
            }
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <EnvironmentOutlined />
          实时监控地图
          <Tag color="blue">{bikes.length} 辆车</Tag>
        </Space>
      }
      variant="borderless"
      styles={{ body: { padding: 0 } }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 600,
        }}
      >
        <div
          ref={setMapContainerRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#f0f0f0',
          }}
        />
        {isInitializing && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 10,
            }}
          >
            <Spin size="large" />
          </div>
        )}
      </div>
    </Card>
  );
}

export default MapView;
