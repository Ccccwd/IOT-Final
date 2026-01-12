from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from datetime import datetime, timedelta
from decimal import Decimal
import asyncio

from database import engine, get_db
from models import (
    User, Bike, Order, BikeTrajectory, SystemLog,
    BikeStatus, OrderStatus, LogType
)
from schemas import (
    UserCreate, UserCreateWithCard, UserUpdate, UserResponse, UserTopup,
    BindCardRequest, AutoRegisterRequest,
    BikeCreate, BikeResponse, BikeListResponse, BikeUpdate,
    OrderUnlock, OrderLock, OrderResponse, LockResponse,
    RFIDAuthRequest, RFIDAuthResponse, HardwareUnlockRequest,
    AdminCommand, DashboardStats, MessageResponse
)
from mqtt_handler import mqtt_client
from config import settings
import logging

# WebSocket 支持
from websocket_server import websocket_manager, setup_mqtt_forwarding

# MQTT消息处理
from mqtt_message_handler import setup_mqtt_subscriptions

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(
    title="智能共享单车管理系统 API",
    description="基于 FastAPI + MySQL + MQTT 的共享单车后端服务",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== 启动和关闭事件 ==========

@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    logger.info("FastAPI 应用启动中...")

    # 首先设置事件循环（必须在 MQTT 连接之前）
    try:
        loop = asyncio.get_running_loop()
        websocket_manager.set_event_loop(loop)
        logger.info(f"✓ 事件循环已设置: {loop}")
    except Exception as e:
        logger.error(f"✗ 设置事件循环失败: {e}")
        return

    # 然后启动 MQTT 客户端
    if mqtt_client.connect():
        logger.info("✓ MQTT 客户端启动成功")

        # 设置 MQTT 消息转发到 WebSocket
        setup_mqtt_forwarding()
        logger.info("✓ WebSocket MQTT 转发已启用")

        # 设置 MQTT 消息处理（更新数据库）
        setup_mqtt_subscriptions(mqtt_client, get_db)
        logger.info("✓ MQTT 消息处理已启用（心跳/GPS自动更新）")
    else:
        logger.warning("✗ MQTT 客户端启动失败")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时执行"""
    logger.info("FastAPI 应用关闭中...")
    mqtt_client.disconnect()


# ========== 基础路由 ==========

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "智能共享单车管理系统 API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "mqtt_connected": mqtt_client.connected,
        "timestamp": datetime.now().isoformat()
    }


# ========== 用户相关 API ==========

@app.post("/api/auth/register", response_model=UserResponse, tags=["用户认证"])
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """注册新用户（不需要提供卡号）"""
    # 创建新用户（不绑定卡号）
    db_user = User(
        username=user.username,
        phone=user.phone,
        balance=Decimal(str(user.balance)) if user.balance else Decimal("50.00")
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    logger.info(f"新用户注册: ID={db_user.id}, 用户名={user.username}")
    return db_user


@app.post("/api/auth/register-with-card", response_model=UserResponse, tags=["用户认证"])
async def register_user_with_card(user: UserCreateWithCard, db: Session = Depends(get_db)):
    """注册新用户并绑定卡号"""
    # 检查 RFID 卡是否已存在
    existing_user = db.query(User).filter(User.rfid_card == user.rfid_card).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RFID 卡已被绑定"
        )

    # 创建新用户并绑定卡号
    db_user = User(
        rfid_card=user.rfid_card,
        username=user.username,
        phone=user.phone,
        balance=Decimal(str(user.balance)) if user.balance else Decimal("50.00")
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    logger.info(f"新用户注册并绑定卡: {user.rfid_card}, 用户名={user.username}")
    return db_user


@app.post("/api/auth/topup", response_model=UserResponse, tags=["用户认证"])
async def topup_balance(topup: UserTopup, db: Session = Depends(get_db)):
    """用户充值"""
    db_user = db.query(User).filter(User.id == topup.user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 更新余额
    db_user.balance += Decimal(str(topup.amount))
    db.commit()
    db.refresh(db_user)

    logger.info(f"用户充值: 用户ID={topup.user_id}, 金额={topup.amount}")
    return db_user


@app.get("/api/users", response_model=List[UserResponse], tags=["用户管理"])
async def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取用户列表"""
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@app.get("/api/users/{user_id}", response_model=UserResponse, tags=["用户管理"])
async def get_user(user_id: int, db: Session = Depends(get_db)):
    """获取用户详情"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    return user


@app.put("/api/users/{user_id}", response_model=UserResponse, tags=["用户管理"])
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db)
):
    """更新用户信息（不包括RFID卡号）"""
    # 检查用户是否存在
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 更新字段（只更新提供的字段）
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    logger.info(f"用户信息更新: ID={user_id}, 字段={list(update_data.keys())}")
    return user


@app.post("/api/users/{user_id}/bind-card", response_model=UserResponse, tags=["用户管理"])
async def bind_card(user_id: int, request: BindCardRequest, db: Session = Depends(get_db)):
    """为用户绑定 RFID 卡"""
    # 检查用户是否存在
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 检查用户是否已绑定卡
    if user.rfid_card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已绑定卡片，如需更换请联系管理员"
        )

    # 检查卡是否已被其他用户绑定
    existing_card = db.query(User).filter(User.rfid_card == request.rfid_card).first()
    if existing_card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该卡已被其他用户绑定"
        )

    # 绑定卡号
    user.rfid_card = request.rfid_card
    db.commit()
    db.refresh(user)

    logger.info(f"用户绑定卡: 用户ID={user_id}, 卡号={request.rfid_card}")
    return user


@app.post("/api/auth/auto-register", response_model=UserResponse, tags=["用户认证"])
async def auto_register(request: AutoRegisterRequest, db: Session = Depends(get_db)):
    """硬件端自动注册（刷卡自动创建用户）"""
    # 检查卡是否已注册
    existing_user = db.query(User).filter(User.rfid_card == request.rfid_card).first()
    if existing_user:
        # 如果已注册，直接返回
        return existing_user

    # 自动创建新用户
    db_user = User(
        rfid_card=request.rfid_card,
        username=request.username or f"用户_{request.rfid_card[-4:]}",
        balance=Decimal(str(request.initial_balance))
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    logger.info(f"自动注册新用户: 卡号={request.rfid_card}, 用户名={db_user.username}")
    return db_user


# ========== 车辆相关 API ==========

@app.get("/api/bikes", response_model=BikeListResponse, tags=["车辆管理"])
async def get_bikes(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    db: Session = Depends(get_db)
):
    """获取车辆列表"""
    query = db.query(Bike)
    if status:
        query = query.filter(Bike.status == status)

    total = query.count()
    bikes = query.offset(skip).limit(limit).all()

    return BikeListResponse(total=total, items=bikes)


@app.get("/api/bikes/{bike_id}", response_model=BikeResponse, tags=["车辆管理"])
async def get_bike(bike_id: int, db: Session = Depends(get_db)):
    """获取车辆详情"""
    bike = db.query(Bike).filter(Bike.id == bike_id).first()
    if not bike:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="车辆不存在"
        )
    return bike


@app.patch("/api/bikes/{bike_id}/status", response_model=BikeResponse, tags=["车辆管理"])
async def update_bike_status(
    bike_id: int,
    bike_update: BikeUpdate,
    db: Session = Depends(get_db)
):
    """更新车辆状态"""
    bike = db.query(Bike).filter(Bike.id == bike_id).first()
    if not bike:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="车辆不存在"
        )

    # 更新字段
    update_data = bike_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bike, field, value)

    db.commit()
    db.refresh(bike)

    logger.info(f"车辆状态更新: {bike.bike_code}, 状态: {bike.status}")
    return bike


@app.get("/api/bikes/{bike_id}/trajectory", tags=["车辆管理"])
async def get_bike_trajectory(
    bike_id: int,
    order_id: int = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取车辆轨迹"""
    query = db.query(BikeTrajectory).filter(BikeTrajectory.bike_id == bike_id)
    if order_id:
        query = query.filter(BikeTrajectory.order_id == order_id)

    trajectories = query.order_by(desc(BikeTrajectory.recorded_at)).limit(limit).all()
    return trajectories


# ========== 订单相关 API ==========

@app.post("/api/hardware/unlock", tags=["硬件接口"])
async def hardware_unlock(request: HardwareUnlockRequest, db: Session = Depends(get_db)):
    """硬件端开锁接口（自动匹配车辆）"""
    # 1. 根据车辆编号查找车辆
    bike = db.query(Bike).filter(Bike.bike_code == request.bike_code).first()
    if not bike:
        return {
            "success": False,
            "message": f"车辆 {request.bike_code} 不存在，请先在系统中注册车辆"
        }
    
    # 2. 查找用户（如果不存在则自动注册）
    user = db.query(User).filter(User.rfid_card == request.rfid_card).first()
    if not user:
        # 自动注册新用户
        user = User(
            rfid_card=request.rfid_card,
            username=f"用户_{request.rfid_card[-4:]}",
            phone="",
            balance=Decimal("50.00")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"自动注册新用户: RFID={request.rfid_card}, ID={user.id}")
    
    # 3. 检查余额
    if user.balance < Decimal(str(settings.MIN_BALANCE)):
        return {
            "success": False,
            "message": f"余额不足，当前余额: {float(user.balance):.2f} 元，最低需要 {settings.MIN_BALANCE} 元"
        }
    
    # 4. 检查车辆状态
    if bike.status != BikeStatus.IDLE.value:
        return {
            "success": False,
            "message": f"车辆正在使用中，当前状态: {bike.status}"
        }
    
    # 5. 创建订单
    order = Order(
        user_id=user.id,
        bike_id=bike.id,
        start_time=datetime.now(),
        start_lat=request.lat,
        start_lng=request.lng,
        status=OrderStatus.ACTIVE.value
    )
    db.add(order)
    
    # 6. 更新车辆状态
    bike.status = BikeStatus.RIDING.value
    bike.current_lat=request.lat
    bike.current_lng = request.lng
    
    db.commit()
    db.refresh(order)
    
    # 7. 发送 MQTT 开锁指令
    mqtt_client.publish_command(bike.id, "unlock", order.id)
    
    logger.info(f"硬件开锁成功: 用户={request.rfid_card}, 车辆={bike.bike_code}, 订单={order.id}")
    
    return {
        "success": True,
        "message": "开锁成功",
        "user_id": user.id,
        "balance": float(user.balance),
        "order_id": order.id
    }


@app.post("/api/orders/unlock", response_model=OrderResponse, tags=["订单管理"])
async def unlock_bike(unlock: OrderUnlock, db: Session = Depends(get_db)):
    """开锁（创建订单）"""
    # 查找用户
    user = db.query(User).filter(User.rfid_card == unlock.rfid_card).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 检查余额
    if user.balance < settings.MIN_BALANCE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"余额不足，最低需要 {settings.MIN_BALANCE} 元"
        )

    # 查找车辆
    bike = db.query(Bike).filter(Bike.id == unlock.bike_id).first()
    if not bike:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="车辆不存在"
        )

    # 检查车辆状态
    if bike.status != BikeStatus.IDLE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"车辆状态不是空闲，当前状态: {bike.status}"
        )

    # 创建订单
    order = Order(
        user_id=user.id,
        bike_id=bike.id,
        start_time=datetime.now(),
        start_lat=unlock.lat,
        start_lng=unlock.lng,
        status=OrderStatus.ACTIVE.value
    )
    db.add(order)

    # 更新车辆状态
    bike.status = BikeStatus.RIDING.value
    bike.current_lat = unlock.lat
    bike.current_lng = unlock.lng

    db.commit()
    db.refresh(order)

    # 发送 MQTT 开锁指令
    mqtt_client.publish_command(bike.id, "unlock", order.id)

    logger.info(f"开锁成功: 用户={unlock.rfid_card}, 车辆={bike.bike_code}, 订单={order.id}")
    return order


@app.post("/api/orders/lock", response_model=LockResponse, tags=["订单管理"])
async def lock_bike(lock: OrderLock, db: Session = Depends(get_db)):
    """还车（结束订单）"""
    # 查找订单
    order = db.query(Order).filter(Order.id == lock.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在"
        )

    # 验证用户
    user = db.query(User).filter(User.rfid_card == lock.rfid_card).first()
    if not user or user.id != order.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户信息不匹配"
        )

    # 检查订单状态
    if order.status != OrderStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"订单状态错误，当前状态: {order.status}"
        )

    # 计算骑行时长（分钟）
    end_time = datetime.now()
    duration_minutes = int((end_time - order.start_time).total_seconds() / 60)

    # 计算费用
    cost = round(duration_minutes * settings.PRICE_PER_MINUTE, 2)

    # 检查余额
    if user.balance < cost:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"余额不足，本次消费 {cost} 元，当前余额 {user.balance} 元"
        )

    # 更新订单
    order.end_time = end_time
    order.duration_minutes = duration_minutes
    order.end_lat = lock.end_lat
    order.end_lng = lock.end_lng
    order.cost = cost
    order.status = OrderStatus.COMPLETED.value

    # 更新车辆状态
    bike = db.query(Bike).filter(Bike.id == order.bike_id).first()
    if bike:
        bike.status = BikeStatus.IDLE.value
        bike.current_lat = lock.end_lat
        bike.current_lng = lock.end_lng

    # 扣除余额
    user.balance -= cost

    db.commit()

    # 发送 MQTT 关锁指令
    mqtt_client.publish_command(bike.id, "lock")

    logger.info(f"还车成功: 用户={lock.rfid_card}, 车辆={bike.bike_code}, 时长={duration_minutes}分钟, 费用={cost}元")

    return LockResponse(
        success=True,
        duration_minutes=duration_minutes,
        cost=cost,
        new_balance=float(user.balance),
        message="还车成功"
    )


@app.get("/api/orders", response_model=List[OrderResponse], tags=["订单管理"])
async def get_orders(
    skip: int = 0,
    limit: int = 100,
    user_id: int = None,
    db: Session = Depends(get_db)
):
    """获取订单列表"""
    query = db.query(Order)
    if user_id:
        query = query.filter(Order.user_id == user_id)

    orders = query.order_by(desc(Order.created_at)).offset(skip).limit(limit).all()
    return orders


@app.get("/api/orders/{order_id}", response_model=OrderResponse, tags=["订单管理"])
async def get_order(order_id: int, db: Session = Depends(get_db)):
    """获取订单详情"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在"
        )
    return order


# ========== 认证 API（硬件端调用）==========

@app.post("/api/auth/validate-card", response_model=RFIDAuthResponse, tags=["硬件认证"])
async def validate_card(auth: RFIDAuthRequest, db: Session = Depends(get_db)):
    """验证 RFID 卡（硬件端调用）"""
    # 查找用户
    user = db.query(User).filter(User.rfid_card == auth.rfid_uid).first()

    if not user:
        # 发送认证失败响应
        mqtt_client.publish_response(
            auth.bike_id,
            success=False,
            message="卡未注册"
        )
        return RFIDAuthResponse(
            success=False,
            message="卡未注册"
        )

    # 检查用户状态
    if user.status != "active":
        mqtt_client.publish_response(
            auth.bike_id,
            success=False,
            message="账户已冻结"
        )
        return RFIDAuthResponse(
            success=False,
            message="账户已冻结"
        )

    # 检查余额
    if user.balance < settings.MIN_BALANCE:
        mqtt_client.publish_response(
            auth.bike_id,
            success=False,
            message=f"余额不足，最低需要 {settings.MIN_BALANCE} 元"
        )
        return RFIDAuthResponse(
            success=False,
            message=f"余额不足，最低需要 {settings.MIN_BALANCE} 元"
        )

    # 处理开锁或还车
    if auth.action == "unlock":
        # 查找车辆
        bike = db.query(Bike).filter(Bike.id == auth.bike_id).first()
        if not bike or bike.status != BikeStatus.IDLE.value:
            mqtt_client.publish_response(
                auth.bike_id,
                success=False,
                message="车辆不可用"
            )
            return RFIDAuthResponse(
                success=False,
                message="车辆不可用"
            )

        # 创建订单
        order = Order(
            user_id=user.id,
            bike_id=auth.bike_id,
            start_time=datetime.now(),
            status=OrderStatus.ACTIVE.value
        )
        db.add(order)

        # 更新车辆状态
        bike.status = BikeStatus.RIDING.value
        db.commit()
        db.refresh(order)

        # 发送认证成功响应
        mqtt_client.publish_response(
            auth.bike_id,
            success=True,
            message="开锁成功",
            balance=float(user.balance),
            order_id=order.id
        )

        return RFIDAuthResponse(
            success=True,
            message="开锁成功",
            user_id=user.id,
            balance=float(user.balance),
            order_id=order.id
        )

    elif auth.action == "lock":
        # 查找进行中的订单
        order = db.query(Order).filter(
            Order.user_id == user.id,
            Order.bike_id == auth.bike_id,
            Order.status == OrderStatus.ACTIVE.value
        ).first()

        if not order:
            mqtt_client.publish_response(
                auth.bike_id,
                success=False,
                message="未找到进行中的订单"
            )
            return RFIDAuthResponse(
                success=False,
                message="未找到进行中的订单"
            )

        # 计算费用
        duration_minutes = int((datetime.now() - order.start_time).total_seconds() / 60)
        cost = round(duration_minutes * settings.PRICE_PER_MINUTE, 2)

        # 更新订单
        order.end_time = datetime.now()
        order.duration_minutes = duration_minutes
        order.cost = cost
        order.status = OrderStatus.COMPLETED.value

        # 更新车辆状态
        bike = db.query(Bike).filter(Bike.id == auth.bike_id).first()
        if bike:
            bike.status = BikeStatus.IDLE.value

        # 扣除余额
        user.balance -= cost
        db.commit()

        # 发送认证成功响应
        mqtt_client.publish_response(
            auth.bike_id,
            success=True,
            message="还车成功",
            balance=float(user.balance)
        )

        return RFIDAuthResponse(
            success=True,
            message="还车成功",
            user_id=user.id,
            balance=float(user.balance)
        )


# ========== 管理员 API ==========

@app.post("/api/admin/command", response_model=MessageResponse, tags=["管理员"])
async def admin_command(command: AdminCommand, db: Session = Depends(get_db)):
    """管理员远程控制"""
    bike = db.query(Bike).filter(Bike.id == command.bike_id).first()
    if not bike:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="车辆不存在"
        )

    # 发送控制指令
    mqtt_client.publish_command(bike.id, command.command)

    # 记录日志
    log = SystemLog(
        bike_id=bike.id,
        log_type=LogType.AUTH.value,
        message=f"管理员远程操作: {command.command}, 原因: {command.reason}"
    )
    db.add(log)
    db.commit()

    logger.info(f"管理员远程控制: {command.bike_id} - {command.command}")
    return MessageResponse(message="指令已发送")


@app.get("/api/admin/dashboard", response_model=DashboardStats, tags=["管理员"])
async def get_dashboard(db: Session = Depends(get_db)):
    """获取仪表盘统计数据"""
    # 车辆统计
    total_bikes = db.query(Bike).count()
    idle_bikes = db.query(Bike).filter(Bike.status == BikeStatus.IDLE.value).count()
    riding_bikes = db.query(Bike).filter(Bike.status == BikeStatus.RIDING.value).count()
    fault_bikes = db.query(Bike).filter(Bike.status == BikeStatus.FAULT.value).count()

    # 用户统计
    total_users = db.query(User).count()

    # 今日订单统计
    today = datetime.now().date()
    today_orders = db.query(Order).filter(
        func.date(Order.created_at) == today
    ).count()

    # 今日收入
    today_revenue = db.query(func.sum(Order.cost)).filter(
        func.date(Order.created_at) == today,
        Order.status == OrderStatus.COMPLETED.value
    ).scalar() or Decimal("0.00")

    return DashboardStats(
        total_bikes=total_bikes,
        idle_bikes=idle_bikes,
        riding_bikes=riding_bikes,
        fault_bikes=fault_bikes,
        total_users=total_users,
        today_orders=today_orders,
        today_revenue=float(today_revenue)
    )


@app.get("/api/admin/statistics/trends", tags=["管理员"])
async def get_statistics_trends(
    days: int = 7,
    db: Session = Depends(get_db)
):
    """获取指定天数的统计数据趋势"""
    trends_data = []

    for i in range(days - 1, -1, -1):
        date = datetime.now().date() - timedelta(days=i)

        # 当天的订单数
        order_count = db.query(Order).filter(
            func.date(Order.created_at) == date
        ).count()

        # 当天的收入（只统计已完成的订单）
        revenue = db.query(func.sum(Order.cost)).filter(
            func.date(Order.created_at) == date,
            Order.status == OrderStatus.COMPLETED.value
        ).scalar() or Decimal("0.00")

        trends_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "display_date": date.strftime("%m-%d"),
            "order_count": order_count,
            "revenue": float(revenue)
        })

    return {
        "trends": trends_data
    }


# ========== WebSocket 端点 ==========

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 端点，用于向前端推送实时数据"""
    await websocket_manager.connect(websocket)

    try:
        # 保持连接，接收客户端消息（如果有）
        while True:
            data = await websocket.receive_text()
            # 可以处理客户端发送的消息
            logger.debug(f"收到 WebSocket 消息: {data}")

    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
        logger.info("WebSocket 客户端主动断开连接")
    except Exception as e:
        websocket_manager.disconnect(websocket)
        logger.error(f"WebSocket 错误: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False  # Windows 上禁用自动重载避免多进程问题
    )
