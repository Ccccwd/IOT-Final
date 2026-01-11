/**
 * 地图配置文件
 */
const ak = import.meta.env.VITE_BAIDU_MAP_AK || '';

// 调试：输出AK配置
console.log('[MapConfig] 百度地图 AK 配置:', ak ? `${ak.substring(0, 10)}...` : '未设置');
console.log('[MapConfig] 环境变量可用:', {
  VITE_BAIDU_MAP_AK: !!ak,
  allEnv: import.meta.env,
});

export const MAP_CONFIG = {
  // 百度地图 AK（从环境变量读取）
  ak: ak,

  // 默认中心点（杭州西湖）
  center: {
    lng: 120.1551,
    lat: 30.2741,
  },

  // 默认缩放级别
  zoom: 15,

  // 地图样式
  mapStyle: {
    styleJson: [
      {
        featureType: 'all',
        elementType: 'all',
        stylers: {
          lightness: 10,
          saturation: -100,
        },
      },
    ],
  },

  // Marker 图标配置
  markerIcons: {
    idle: 'https://api.map.baidu.com/images/marker_red_sprite.png',
    riding: 'https://api.map.baidu.com/images/marker_blue_sprite.png',
    fault: 'https://api.map.baidu.com/images/marker_gray_sprite.png',
  },

  // 车辆状态颜色
  bikeStatusColors: {
    idle: '#52c41a',
    riding: '#ff4d4f',
    fault: '#d9d9d9',
  },
};
