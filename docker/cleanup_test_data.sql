-- 清理测试数据脚本
-- 使用方法：
-- mysql -u root -p bikesharing < cleanup_test_data.sql

USE bikesharing;

-- 删除所有测试用户
DELETE FROM users WHERE id IN (1, 2);

-- 删除所有测试车辆
DELETE FROM bikes WHERE id IN (1, 2, 3);

-- 删除所有测试订单
DELETE FROM orders;

-- 删除所有轨迹数据
DELETE FROM bike_trajectories;

-- 删除所有系统日志
DELETE FROM system_logs;

-- 重置自增ID
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE bikes AUTO_INCREMENT = 1;
ALTER TABLE orders AUTO_INCREMENT = 1;
ALTER TABLE bike_trajectories AUTO_INCREMENT = 1;
ALTER TABLE system_logs AUTO_INCREMENT = 1;

-- 显示清理结果
SELECT '✓ 清理完成' AS status;
SELECT COUNT(*) AS remaining_users FROM users;
SELECT COUNT(*) AS remaining_bikes FROM bikes;
SELECT COUNT(*) AS remaining_orders FROM orders;
