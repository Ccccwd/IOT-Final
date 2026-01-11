-- 用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    rfid_card VARCHAR(20) UNIQUE NOT NULL,
    username VARCHAR(50),
    phone VARCHAR(20),
    balance DECIMAL(10, 2) DEFAULT 50.00,
    status VARCHAR(20) DEFAULT 'active',  -- active, frozen
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 车辆表
CREATE TABLE bikes (
    id SERIAL PRIMARY KEY,
    bike_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'idle',  -- idle, riding, fault
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    battery INT DEFAULT 100,
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    bike_id INTEGER REFERENCES bikes(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_minutes INT,
    start_lat DECIMAL(10, 8),
    start_lng DECIMAL(11, 8),
    end_lat DECIMAL(10, 8),
    end_lng DECIMAL(11, 8),
    cost DECIMAL(10, 2),
    distance_km DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'active',  -- active, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 轨迹记录表
CREATE TABLE bike_trajectories (
    id SERIAL PRIMARY KEY,
    bike_id INTEGER REFERENCES bikes(id),
    order_id INTEGER REFERENCES orders(id),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    mode VARCHAR(20),  -- real, simulation
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统日志表
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    bike_id INTEGER REFERENCES bikes(id),
    log_type VARCHAR(50),  -- auth, gps, heartbeat, error
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_rfid ON users(rfid_card);
CREATE INDEX idx_bikes_status ON bikes(status);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_bike ON orders(bike_id);
CREATE INDEX idx_trajectories_bike ON bike_trajectories(bike_id);
CREATE INDEX idx_trajectories_order ON bike_trajectories(order_id);

-- 插入测试数据
INSERT INTO users (rfid_card, username, balance) VALUES
('A3F5C2D1', '测试用户1', 50.00),
('B7E9A4F2', '测试用户2', 30.00);

INSERT INTO bikes (bike_code, status, current_lat, current_lng) VALUES
('BIKE_001', 'idle', 39.915, 116.404),
('BIKE_002', 'idle', 39.916, 116.405),
('BIKE_003', 'riding', 39.917, 116.406);
