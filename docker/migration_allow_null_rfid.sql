-- 数据库迁移脚本：允许 users.rfid_card 字段为 NULL
-- 执行方式：mysql -u bikeuser -pbikepass123 bikesharing < migration_allow_null_rfid.sql

USE bikesharing;

-- 修改 rfid_card 字段允许为 NULL
ALTER TABLE users MODIFY COLUMN rfid_card VARCHAR(20) NULL;

-- 验证修改
DESCRIBE users;

SELECT 'Migration completed successfully!' AS message;
