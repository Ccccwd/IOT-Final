-- 数据库字符集修复脚本
-- 用于修复中文乱码问题

-- 1. 修改数据库字符集
ALTER DATABASE bikesharing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. 修改所有表的字符集
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE bikes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE orders CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE bike_trajectories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE system_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. 验证修改
SELECT
    table_name,
    table_collation
FROM information_schema.tables
WHERE table_schema = 'bikesharing';

SELECT '✓ 字符集修复完成' AS status;
