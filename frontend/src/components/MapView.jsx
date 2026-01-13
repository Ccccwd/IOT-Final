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
  const polylinesRef = useRef({}); // 存储轨迹线
  const infoWindowRef = useRef(null);
  const bikesRef = useRef(bikes); // 保存 bikes 引用，用于定时器
  // 存储骑行中车辆的轨迹点（实时模拟轨迹）
  const ridingTrajectoriesRef = useRef({}); // bike_id -> [{lat, lng, timestamp}]
  const [internalSelectedBike, setInternalSelectedBike] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [containerReady, setContainerReady] = useState(false);
  const [initTriggered, setInitTriggered] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // 使用外部传入的 selectedBike，如果没有则使用内部状态
  const selectedBike = externalSelectedBike !== undefined ? externalSelectedBike : internalSelectedBike;

  // 保持 bikesRef 同步
  useEffect(() => {
    bikesRef.current = bikes;

    console.log('[MapView] 🔄 检查车辆状态，车辆总数:', bikes.length);

    // 检查骑行中的车辆，更新实时轨迹
    bikes.forEach(bike => {
      console.log('[MapView] 车辆:', bike.bike_code, '状态:', bike.status, '坐标:', bike.current_lat, bike.current_lng);

      if (bike.status === 'riding' && isValidCoord(bike.current_lat, bike.current_lng)) {
        const bikeId = bike.id.toString();
        const trajectory = ridingTrajectoriesRef.current[bikeId] || [];

        console.log('[MapView] ✓ 车辆正在骑行，当前轨迹点数:', trajectory.length);

        // 添加新的轨迹点（避免重复点）
        const lastPoint = trajectory[trajectory.length - 1];
        const isNewPoint = !lastPoint ||
          Math.abs(lastPoint.lat - bike.current_lat) > 0.00001 ||
          Math.abs(lastPoint.lng - bike.current_lng) > 0.00001;

        if (isNewPoint) {
          ridingTrajectoriesRef.current[bikeId] = [
            ...trajectory,
            {
              lat: parseFloat(bike.current_lat),
              lng: parseFloat(bike.current_lng),
              timestamp: Date.now()
            }
          ];

          console.log('[MapView] 📍 添加轨迹点:', bike.bike_code, '总点数:', ridingTrajectoriesRef.current[bikeId].length);
        } else {
          console.log('[MapView] ⏭️ 跳过重复点:', bike.bike_code);
        }
      } else if (bike.status !== 'riding') {
        // 如果车辆不再骑行，清空轨迹
        const bikeId = bike.id.toString();
        if (ridingTrajectoriesRef.current[bikeId]) {
          delete ridingTrajectoriesRef.current[bikeId];
          console.log('[MapView] 🗑️ 清空轨迹:', bike.bike_code);
        }
      }
    });

    // 只有在地图已初始化时才绘制轨迹
    if (mapRef.current && window.BMap) {
      console.log('[MapView] 🎨 准备绘制轨迹，骑行中车辆:', Object.keys(ridingTrajectoriesRef.current));
      // 延迟执行以确保 markers 已更新
      setTimeout(() => {
        drawRidingTrajectories();
      }, 100);
    }
  }, [bikes]);

  console.log('[MapView] 组件渲染开始, bikes.length:', bikes.length, 'loading:', loading, 'mapLoading:', mapLoading);
  if (bikes.length > 0) {
    console.log('[MapView] 第一辆车的数据:', bikes[0]);
  }

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
        minZoom: 12,
        maxZoom: 20,
      });

      console.log('[MapView] 地图实例创建成功');

      // 设置中心点和缩放级别（提高默认缩放级别）
      const point = new window.BMap.Point(
        MAP_CONFIG.center.lng,
        MAP_CONFIG.center.lat
      );
      map.centerAndZoom(point, 16);

      console.log('[MapView] 地图中心点已设置');

      // 启用滚轮缩放
      map.enableScrollWheelZoom(true);

      // 添加控件（调整位置避免重合）
      // 导航控件（左上角，偏移更大）
      map.addControl(new window.BMap.NavigationControl({
        anchor: window.BMAP_ANCHOR_TOP_LEFT,
        offset: new window.BMap.Size(15, 80) // 增加垂直偏移
      }));
      // 比例尺（左下角）
      map.addControl(new window.BMap.ScaleControl({
        anchor: window.BMAP_ANCHOR_BOTTOM_LEFT,
        offset: new window.BMap.Size(15, 10)
      }));

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

    // 清除所有现有的 Marker
    Object.values(markersRef.current).forEach((marker) => {
      map.removeOverlay(marker);
    });
    markersRef.current = {};

    // 只清除非骑行状态车辆的轨迹线（保留骑行中的轨迹）
    const ridingBikeIds = new Set(
      bikesRef.current
        .filter(bike => bike.status === 'riding')
        .map(bike => bike.id.toString())
    );
    
    Object.keys(polylinesRef.current).forEach((bikeId) => {
      if (!ridingBikeIds.has(bikeId.toString())) {
        map.removeOverlay(polylinesRef.current[bikeId]);
        delete polylinesRef.current[bikeId];
      }
    });

    console.log('[MapView] updateMarkers: 开始添加标记，车辆总数:', bikes.length);

    // 添加新的 Marker
    bikes.forEach((bike) => {
      console.log('[MapView] 处理车辆:', bike.bike_code, '原始坐标:', bike.current_lat, bike.current_lng);

      if (!isValidCoord(bike.current_lat, bike.current_lng)) {
        console.log('[MapView] 跳过无效坐标的车辆:', bike.bike_code, '坐标:', bike.current_lat, bike.current_lng);
        return;
      }

      // 坐标转换（假设原始数据是 WGS84）
      const lat = parseFloat(bike.current_lat);
      const lng = parseFloat(bike.current_lng);
      console.log('[MapView] 转换前坐标 (WGS84):', { lat, lng });

      const bd09Coord = wgs84ToBd09(lat, lng);

      console.log('[MapView] 转换后坐标 (BD09):', bd09Coord);

      const point = new window.BMap.Point(bd09Coord.lng, bd09Coord.lat);

      console.log('[MapView] 准备添加标记，状态:', bike.status);

      // 创建自定义自行车图标
      const iconColor = getBikeIconColor(bike.status);

      // 使用更简单的SVG图标，避免base64编码问题
      const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
          <g fill="none" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <!-- 后轮 -->
            <circle cx="10" cy="30" r="7"/>
            <!-- 前轮 -->
            <circle cx="30" cy="30" r="7"/>
            <!-- 车架 -->
            <path d="M10 30 L18 18 L30 30"/>
            <path d="M18 18 L18 10 L24 18"/>
            <!-- 车把 -->
            <path d="M24 18 L27 12"/>
            <!-- 车座 -->
            <path d="M18 10 L15 6"/>
            <!-- 中轴连接 -->
            <path d="M18 18 L18 22"/>
            <!-- 如果正在骑行，添加动画圆圈 -->
            ${bike.status === 'riding' ? `
              <circle cx="20" cy="20" r="15" stroke-width="2" stroke-opacity="0.4">
                <animate attributeName="r" from="15" to="20" dur="1.5s" repeatCount="indefinite"/>
                <animate attributeName="stroke-opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite"/>
              </circle>
            ` : ''}
          </g>
        </svg>
      `;

      // 将SVG转换为base64
      const base64Icon = btoa(unescape(encodeURIComponent(svgIcon)));

      console.log('[MapView] 创建标记，图标颜色:', iconColor);

      const marker = new window.BMap.Marker(point, {
        icon: new window.BMap.Icon(
          `data:image/svg+xml;base64,${base64Icon}`,
          new window.BMap.Size(40, 40),
          {
            anchor: new window.BMap.Size(20, 20),
            imageSize: new window.BMap.Size(40, 40),
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

  // 绘制骑行中车辆的轨迹
  const drawRidingTrajectories = useCallback(() => {
    if (!mapRef.current || !window.BMap) {
      return;
    }

    const map = mapRef.current;

    // 遍历所有骑行中的车辆
    Object.keys(ridingTrajectoriesRef.current).forEach(bikeId => {
      const trajectory = ridingTrajectoriesRef.current[bikeId];

      if (trajectory.length < 2) {
        return; // 至少需要2个点才能绘制轨迹
      }

      console.log('[MapView] 🎨 绘制轨迹, bike_id:', bikeId, '点数:', trajectory.length);

      // 清除旧轨迹
      if (polylinesRef.current[bikeId]) {
        map.removeOverlay(polylinesRef.current[bikeId]);
      }

      // 转换坐标并创建轨迹点数组
      const points = trajectory.map(item => {
        const bd09Coord = wgs84ToBd09(item.lat, item.lng);
        return new window.BMap.Point(bd09Coord.lng, bd09Coord.lat);
      });

      // 创建轨迹线（亮蓝色，更粗，不透明）
      const polyline = new window.BMap.Polyline(points, {
        strokeColor: '#FF4D4F', // 改为红色，更显眼
        strokeWeight: 8, // 更粗
        strokeOpacity: 1.0, // 完全不透明
        strokeStyle: 'solid' // 实线
      });

      // 添加到地图
      map.addOverlay(polyline);
      polylinesRef.current[bikeId] = polyline;

      console.log('[MapView] ✅ 轨迹绘制成功, bike_id:', bikeId, '颜色: 红色, 粗细: 8px');
    });
  }, []);

  // 显示 InfoWindow
  const showInfoWindow = (bike, point) => {
    if (!infoWindowRef.current) {
      return;
    }

    const content = `
      <div style="padding: 10px; min-width: 280px; max-width: 350px; box-sizing: border-box;">
        <h4 style="margin: 0 0 10px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${bike.bike_code}</h4>
        <p style="margin: 5px 0; word-break: break-all;"><strong>状态：</strong>${getStatusText(bike.status)}</p>
        <p style="margin: 5px 0; word-break: break-all; font-size: 12px;"><strong>位置：</strong>${bike.current_lat?.toFixed(6)}, ${bike.current_lng?.toFixed(6)}</p>
        <p style="margin: 5px 0;"><strong>电量：</strong>${bike.battery || 0}%</p>
        <p style="margin: 5px 0; word-break: break-all; font-size: 12px;"><strong>最后心跳：</strong>${bike.last_heartbeat ? new Date(bike.last_heartbeat).toLocaleString() : '无'}</p>
        ${bike.status === 'riding' ? '<p style="margin: 5px 0; color: #1890ff; word-break: break-all;"><strong>骑行轨迹已自动显示在地图上</strong></p>' : ''}
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
      // 远程控制命令
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

  // 组件卸载时清理地图资源
  useEffect(() => {
    return () => {
      // 清除轨迹线
      if (mapRef.current) {
        Object.values(polylinesRef.current).forEach((polyline) => {
          mapRef.current.removeOverlay(polyline);
        });
      }
    };
  }, []);

  // 辅助函数：安全的 UTF-8 base64 编码
  const utf8ToB64 = (str) => {
    try {
      return window.btoa(unescape(encodeURIComponent(str)));
    } catch (error) {
      console.error('[MapView] Base64编码失败:', error);
      // 返回一个默认图标
      return window.btoa('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#1890ff"/></svg>');
    }
  };

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

    // 移动地图中心并缩放（使用最大缩放级别）
    mapRef.current.centerAndZoom(point, 20);

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
