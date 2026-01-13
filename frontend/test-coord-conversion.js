/**
 * 坐标转换测试脚本
 * 验证硬件端坐标经过转换后是否显示为目标百度坐标
 */

// 从 mapUtils.js 复制的转换函数
const PI = 3.1415926535897932384626;
const a = 6378245.0;
const ee = 0.00669342162296594323;

function outOfChina(lat, lng) {
    if (lng < 72.004 || lng > 137.8347) return true;
    if (lat < 0.8293 || lat > 55.8271) return true;
    return false;
}

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

function wgs84ToGcj02(lat, lng) {
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

function gcj02ToBd09(lat, lng) {
    const x_pi = (PI * 3000.0) / 180.0;
    const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * x_pi);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * x_pi);
    const bdLng = z * Math.cos(theta) + 0.0065;
    const bdLat = z * Math.sin(theta) + 0.006;
    return { lat: bdLat, lng: bdLng };
}

function wgs84ToBd09(lat, lng) {
    const gcj02 = wgs84ToGcj02(lat, lng);
    const bd09 = gcj02ToBd09(gcj02.lat, gcj02.lng);
    return bd09;
}

// 测试硬件端坐标
const hardwareCoord = {
    lat: 30.307645,
    lng: 120.389866
};

console.log('硬件端WGS84坐标:', hardwareCoord);

const result = wgs84ToBd09(hardwareCoord.lat, hardwareCoord.lng);
console.log('转换后的百度坐标:', result);
console.log('目标百度坐标: { lat: 30.313506, lng: 120.395996 }');
console.log('误差:', {
    lat: Math.abs(result.lat - 30.313506).toFixed(6),
    lng: Math.abs(result.lng - 120.395996).toFixed(6)
});
