/**
 * 坐标转换工具函数
 * 用于将 GPS 坐标（WGS84）转换为百度地图坐标（BD09）
 */

// 常量定义
const PI = 3.1415926535897932384626;
const a = 6378245.0; // 长半轴
const ee = 0.00669342162296594323; // 偏心率平方

/**
 * 判断是否在中国境内
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {boolean}
 */
function outOfChina(lat, lng) {
  if (lng < 72.004 || lng > 137.8347) return true;
  if (lat < 0.8293 || lat > 55.8271) return true;
  return false;
}

/**
 * WGS84 转 GCJ02 (火星坐标系)
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {{lat: number, lng: number}}
 */
function transformLat(lat, lng) {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(lat, lng) {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

/**
 * WGS84 转 GCJ02
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {{lat: number, lng: number}}
 */
export function wgs84ToGcj02(lat, lng) {
  if (outOfChina(lat, lng)) {
    return { lat, lng };
  }

  let dLat = transformLat(lat, lng);
  let dLng = transformLng(lat, lng);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);

  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * PI);

  const mgLat = lat + dLat;
  const mgLng = lng + dLng;

  return { lat: mgLat, lng: mgLng };
}

/**
 * GCJ02 转 BD09
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {{lat: number, lng: number}}
 */
export function gcj02ToBd09(lat, lng) {
  const x_pi = (PI * 3000.0) / 180.0;
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * x_pi);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * x_pi);
  const bdLng = z * Math.cos(theta) + 0.0065;
  const bdLat = z * Math.sin(theta) + 0.006;
  return { lat: bdLat, lng: bdLng };
}

/**
 * WGS84 转 BD09 (直接转换)
 * GPS坐标 → 百度地图坐标
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {{lat: number, lng: number}}
 */
export function wgs84ToBd09(lat, lng) {
  const gcj02 = wgs84ToGcj02(lat, lng);
  const bd09 = gcj02ToBd09(gcj02.lat, gcj02.lng);
  return bd09;
}

/**
 * BD09 转 GCJ02
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {{lat: number, lng: number}}
 */
export function bd09ToGcj02(lat, lng) {
  const x_pi = (PI * 3000.0) / 180.0;
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * x_pi);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * x_pi);
  const ggLng = z * Math.cos(theta);
  const ggLat = z * Math.sin(theta);
  return { lat: ggLat, lng: ggLng };
}

/**
 * GCJ02 转 WGS84（粗略估算）
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {{lat: number, lng: number}}
 */
export function gcj02ToWgs84(lat, lng) {
  if (outOfChina(lat, lng)) {
    return { lat, lng };
  }
  const gcj = wgs84ToGcj02(lat, lng);
  const wgsLat = lat * 2 - gcj.lat;
  const wgsLng = lng * 2 - gcj.lng;
  return { lat: wgsLat, lng: wgsLng };
}

/**
 * BD09 转 WGS84（百度地图坐标转GPS坐标）
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {{lat: number, lng: number}}
 */
export function bd09ToWgs84(lat, lng) {
  const gcj02 = bd09ToGcj02(lat, lng);
  const wgs84 = gcj02ToWgs84(gcj02.lat, gcj02.lng);
  return wgs84;
}

/**
 * 判断坐标是否为有效值
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @returns {boolean}
 */
export function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

/**
 * 计算两个坐标点之间的距离（米）
 * 使用 Haversine 公式
 * @param {number} lat1 - 点1纬度
 * @param {number} lng1 - 点1经度
 * @param {number} lat2 - 点2纬度
 * @param {number} lng2 - 点2经度
 * @returns {number} 距离（米）
 */
export function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * PI) / 180;
  const dLng = ((lng2 - lng1) * PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * PI) / 180) *
      Math.cos((lat2 * PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
