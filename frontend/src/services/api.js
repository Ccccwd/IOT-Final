import axios from 'axios';

// 创建 axios 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.detail || error.message || '请求失败';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

// ========== 用户相关 API ==========

export const userAPI = {
  // 注册用户（不绑定卡号）
  register: (data) => api.post('/auth/register', data),

  // 注册用户并绑定卡号
  registerWithCard: (data) => api.post('/auth/register-with-card', data),

  // 绑定 RFID 卡
  bindCard: (userId, rfidCard) => api.post(`/users/${userId}/bind-card`, { rfid_card: rfidCard }),

  // 硬件端自动注册
  autoRegister: (data) => api.post('/auth/auto-register', data),

  // 充值
  topup: (data) => api.post('/auth/topup', data),

  // 获取用户列表
  getUsers: (params) => api.get('/users', { params }),

  // 获取用户详情
  getUser: (userId) => api.get(`/users/${userId}`),
};

// ========== 车辆相关 API ==========

export const bikeAPI = {
  // 获取车辆列表
  getBikes: (params) => api.get('/bikes', { params }),

  // 获取车辆详情
  getBike: (bikeId) => api.get(`/bikes/${bikeId}`),

  // 更新车辆状态
  updateBikeStatus: (bikeId, data) => api.patch(`/bikes/${bikeId}/status`, data),

  // 获取车辆轨迹
  getBikeTrajectory: (bikeId, params) => api.get(`/bikes/${bikeId}/trajectory`, { params }),
};

// ========== 订单相关 API ==========

export const orderAPI = {
  // 开锁（创建订单）
  unlock: (data) => api.post('/orders/unlock', data),

  // 还车（结束订单）
  lock: (data) => api.post('/orders/lock', data),

  // 获取订单列表
  getOrders: (params) => api.get('/orders', { params }),

  // 获取订单详情
  getOrder: (orderId) => api.get(`/orders/${orderId}`),
};

// ========== 认证 API（硬件端调用）==========

export const authAPI = {
  // 验证 RFID 卡
  validateCard: (data) => api.post('/auth/validate-card', data),
};

// ========== 管理员 API ==========

export const adminAPI = {
  // 远程控制
  command: (data) => api.post('/admin/command', data),

  // 获取仪表盘统计数据
  getDashboard: () => api.get('/admin/dashboard'),
};

// ========== 健康检查 ==========

export const healthAPI = {
  // 健康检查
  check: () => api.get('/health', { baseURL: '' }),
};

export default api;
