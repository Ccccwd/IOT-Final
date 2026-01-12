-- 创建数据库
CREATE DATABASE IF NOT EXISTS bikesharing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bikesharing;

-- 用户表
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfid_card VARCHAR(20) UNIQUE NULL,
    username VARCHAR(50),
    phone VARCHAR(20),
    balance DECIMAL(10, 2) DEFAULT 50.00,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 车辆表
CREATE TABLE bikes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bike_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'idle',
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    battery INT DEFAULT 100,
    last_heartbeat TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单表
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    bike_id INT,
    start_time TIMESTAMP NULL,
    end_time TIMESTAMP NULL,
    duration_minutes INT,
    start_lat DECIMAL(10, 8),
    start_lng DECIMAL(11, 8),
    end_lat DECIMAL(10, 8),
    end_lng DECIMAL(11, 8),
    cost DECIMAL(10, 2),
    distance_km DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 轨迹记录表
CREATE TABLE bike_trajectories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bike_id INT,
    order_id INT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    mode VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 系统日志表
CREATE TABLE system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bike_id INT,
    log_type VARCHAR(50),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建索引
CREATE INDEX idx_users_rfid ON users(rfid_card);
CREATE INDEX idx_bikes_status ON bikes(status);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_bike ON orders(bike_id);
CREATE INDEX idx_trajectories_bike ON bike_trajectories(bike_id);
CREATE INDEX idx_trajectories_order ON bike_trajectories(order_id);

-- 注意：不包含任何测试数据，数据库将空表启动
