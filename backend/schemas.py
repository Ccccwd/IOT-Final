from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# ========== 用户相关 Schemas ==========

class UserBase(BaseModel):
    """用户基础模型"""
    username: Optional[str] = Field(None, max_length=50, description="用户名")
    phone: Optional[str] = Field(None, max_length=20, description="手机号")


class UserCreate(UserBase):
    """创建用户（注册时不需要卡号）"""
    password: Optional[str] = Field(None, max_length=100, description="密码（可选）")
    balance: Optional[float] = Field(50.0, ge=0, description="初始余额")


class UserCreateWithCard(UserCreate):
    """创建用户并绑定卡号"""
    rfid_card: str = Field(..., min_length=1, max_length=20, description="RFID 卡号")


class UserUpdate(BaseModel):
    """更新用户"""
    username: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None


class UserResponse(UserBase):
    """用户响应"""
    id: int
    rfid_card: Optional[str] = None
    balance: float
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserTopup(BaseModel):
    """用户充值"""
    user_id: int
    amount: float = Field(..., gt=0, description="充值金额")


class BindCardRequest(BaseModel):
    """绑定卡号请求"""
    rfid_card: str = Field(..., min_length=1, max_length=20, description="RFID 卡号")


class AutoRegisterRequest(BaseModel):
    """硬件端自动注册请求（刷卡自动创建用户）"""
    rfid_card: str = Field(..., min_length=1, max_length=20, description="RFID 卡号")
    username: Optional[str] = Field("新用户", description="用户名")
    initial_balance: Optional[float] = Field(50.0, description="初始余额")


# ========== 车辆相关 Schemas ==========

class BikeBase(BaseModel):
    """车辆基础模型"""
    bike_code: str = Field(..., min_length=1, max_length=20, description="车辆编号")


class BikeCreate(BikeBase):
    """创建车辆"""
    status: Optional[str] = "idle"
    current_lat: Optional[float] = Field(None, ge=-90, le=90)
    current_lng: Optional[float] = Field(None, ge=-180, le=180)


class BikeUpdate(BaseModel):
    """更新车辆"""
    status: Optional[str] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    battery: Optional[int] = Field(None, ge=0, le=100)


class BikeResponse(BikeBase):
    """车辆响应"""
    id: int
    status: str
    current_lat: Optional[float]
    current_lng: Optional[float]
    battery: int
    last_heartbeat: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BikeListResponse(BaseModel):
    """车辆列表响应"""
    total: int
    items: List[BikeResponse]


# ========== 订单相关 Schemas ==========

class OrderBase(BaseModel):
    """订单基础模型"""
    bike_id: int
    rfid_card: str


class OrderUnlock(OrderBase):
    """开锁（创建订单）"""
    lat: float = Field(..., ge=-90, le=90, description="纬度")
    lng: float = Field(..., ge=-180, le=180, description="经度")


class OrderLock(BaseModel):
    """还车（结束订单）"""
    order_id: int
    rfid_card: str
    end_lat: float = Field(..., ge=-90, le=90)
    end_lng: float = Field(..., ge=-180, le=180)


class OrderResponse(BaseModel):
    """订单响应"""
    id: int
    user_id: Optional[int]
    bike_id: Optional[int]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    duration_minutes: Optional[int]
    start_lat: Optional[float]
    start_lng: Optional[float]
    end_lat: Optional[float]
    end_lng: Optional[float]
    cost: Optional[float]
    distance_km: Optional[float]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class LockResponse(BaseModel):
    """还车响应"""
    success: bool
    duration_minutes: Optional[int] = None
    distance_km: Optional[float] = None
    cost: Optional[float] = None
    new_balance: Optional[float] = None
    message: str


# ========== 认证相关 Schemas ==========

class RFIDAuthRequest(BaseModel):
    """RFID 认证请求"""
    rfid_uid: str = Field(..., min_length=1, max_length=20)
    bike_id: int
    action: str = Field(..., pattern="^(unlock|lock)$", description="操作类型：unlock 或 lock")


class RFIDAuthResponse(BaseModel):
    """RFID 认证响应"""
    success: bool
    message: str
    user_id: Optional[int] = None
    balance: Optional[float] = None
    order_id: Optional[int] = None


# ========== MQTT 相关 Schemas ==========

class HeartbeatData(BaseModel):
    """心跳数据"""
    timestamp: datetime
    lat: float
    lng: float
    battery: int
    status: str


class GPSData(BaseModel):
    """GPS 数据"""
    lat: float
    lng: float
    mode: str = "real"  # real 或 simulation
    timestamp: datetime


class MQTTCommand(BaseModel):
    """MQTT 控制指令"""
    action: str  # unlock, lock, force_lock
    order_id: Optional[int] = None
    timestamp: datetime


# ========== 管理员相关 Schemas ==========

class AdminCommand(BaseModel):
    """管理员远程控制"""
    bike_id: int
    command: str = Field(..., pattern="^(force_unlock|force_lock)$")
    reason: Optional[str] = "管理员远程操作"


class DashboardStats(BaseModel):
    """仪表盘统计数据"""
    total_bikes: int
    idle_bikes: int
    riding_bikes: int
    fault_bikes: int
    total_users: int
    today_orders: int
    today_revenue: float


# ========== 通用响应 Schemas ==========

class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str
    success: bool = True
