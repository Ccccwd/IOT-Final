from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# 创建数据库引擎
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # 自动检测连接是否有效
    pool_recycle=3600,  # 1小时后回收连接
    echo=False,  # 生产环境设为 False，开发调试可设为 True
)

# 创建 SessionLocal 类
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
Base = declarative_base()


def get_db():
    """
    依赖注入函数，用于获取数据库会话
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    初始化数据库（创建所有表）
    注意：表结构由 mysql_init.sql 创建，这里主要用于 ORM 映射
    """
    # 开发时可使用 Base.metadata.create_all(engine)
    # 生产环境建议使用迁移工具（如 Alembic）
    pass
