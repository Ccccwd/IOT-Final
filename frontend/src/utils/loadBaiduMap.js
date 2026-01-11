/**
 * 动态加载百度地图 API
 * @param {string} ak - 百度地图 AK
 * @returns {Promise<void>}
 */
export function loadBaiduMapScript(ak) {
  return new Promise((resolve, reject) => {
    if (!ak) {
      reject(new Error('百度地图 AK 未配置'));
      return;
    }

    // 检查是否已经加载
    if (window.BMap) {
      console.log('[loadBaiduMap] BMap 已存在，直接返回');
      resolve();
      return;
    }

    console.log('[loadBaiduMap] 开始加载百度地图脚本, AK:', ak.substring(0, 10) + '...');

    // 设置全局回调函数（在创建 script 之前）
    window.initBaiduMap = () => {
      console.log('[loadBaiduMap] initBaiduMap 回调被调用');
      console.log('[loadBaiduMap] BMap 对象:', typeof window.BMap);
      if (window.BMap) {
        delete window.initBaiduMap;
        resolve();
      } else {
        console.error('[loadBaiduMap] BMap 未定义');
        reject(new Error('百度地图 API 加载失败：BMap 未定义'));
      }
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${ak}&callback=initBaiduMap`;
    script.async = true;
    script.defer = true;

    script.onerror = () => {
      console.error('[loadBaiduMap] 百度地图 API 脚本加载失败');
      delete window.initBaiduMap;
      reject(new Error('百度地图 API 脚本加载失败'));
    };

    script.onload = () => {
      console.log('[loadBaiduMap] 脚本 onload 事件触发');
      // 回调会在脚本执行完成后被调用
    };

    document.head.appendChild(script);
    console.log('[loadBaiduMap] 脚本标签已添加到页面，src:', script.src);
  });
}

/**
 * 检查百度地图是否已加载
 * @returns {boolean}
 */
export function isBaiduMapLoaded() {
  return typeof window.BMap !== 'undefined';
}
