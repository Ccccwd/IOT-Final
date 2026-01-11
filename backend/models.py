from sqlalchemy import Column, Integer, String, DECIMAL, TIMESTAMP, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UserStatus(str, enum.Enum):
    """用户状态枚举"""
    ACTIVE = "active"
    FROZEN = "frozen"


class BikeStatus(str, enum.Enum):
    """车辆状态枚举"""
    IDLE = "idle"  # 空闲
    RIDING = "riding"  # 骑行中
    FAULT = "fault"  # 故障


class OrderStatus(str, enum.Enum):
    """订单状态枚举"""
    ACTIVE = "active"  # 进行中
    COMPLETED = "completed"  # 已完成
    CANCELLED = "cancelled"  # 已取消


class LogType(str, enum.Enum):
    """日志类型枚举"""
    AUTH = "auth"  # 认证
    GPS = "gps"  # GPS
    HEARTBEAT = "heartbeat"  # 心跳
    ERROR = "error"  # 错误


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    rfid_card = Column(String(20), unique=True, nullable=True, index=True)  # 改为 nullable=True
    username = Column(String(50))
    phone = Column(String(20))
    balance = Column(DECIMAL(10, 2), default=50.00)
    status = Column(String(20), default=UserStatus.ACTIVE.value)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    # 关系
    orders = relationship("Order", back_populates="user")


class Bike(Base):
    """车辆表"""
    __tablename__ = "bikes"

    id = Column(Integer, primary_key=True, index=True)
    bike_code = Column(String(20), unique=True, nullable=False)
    status = Column(String(20), default=BikeStatus.IDLE.value, index=True)
    current_lat = Column(DECIMAL(10, 8))
    current_lng = Column(DECIMAL(11, 8))
    battery = Column(Integer, default=100)
    last_heartbeat = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    # 关系
    orders = relationship("Order", back_populates="bike")
    trajectories = relationship("BikeTrajectory", back_populates="bike")
    logs = relationship("SystemLog", back_populates="bike")


class Order(Base):
    """订单表"""
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    bike_id = Column(Integer, ForeignKey("bikes.id", ondelete="SET NULL"))
    start_time = Column(TIMESTAMP)
    end_time = Column(TIMESTAMP)
    duration_minutes = Column(Integer)
    start_lat = Column(DECIMAL(10, 8))
    start_lng = Column(DECIMAL(11, 8))
    end_lat = Column(DECIMAL(10, 8))
    end_lng = Column(DECIMAL(11, 8))
    cost = Column(DECIMAL(10, 2))
    distance_km = Column(DECIMAL(10, 2))
    status = Column(String(20), default=OrderStatus.ACTIVE.value)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    # 关系
    user = relationship("User", back_populates="orders")
    bike = relationship("Bike", back_populates="orders")
    trajectories = relationship("BikeTrajectory", back_populates="order")


class BikeTrajectory(Base):
    """车辆轨迹表"""
    __tablename__ = "bike_trajectories"

    id = Column(Integer, primary_key=True, index=True)
    bike_id = Column(Integer, ForeignKey("bikes.id", ondelete="CASCADE"), index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    mode = Column(String(20))  # real 或 simulation
    recorded_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    # 关系
    bike = relationship("Bike", back_populates="trajectories")
    order = relationship("Order", back_populates="trajectories")


class SystemLog(Base):
    """系统日志表"""
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    bike_id = Column(Integer, ForeignKey("bikes.id", ondelete="SET NULL"))
    log_type = Column(String(50))
    message = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    # 关系
    bike = relationship("Bike", back_populates="logs")
