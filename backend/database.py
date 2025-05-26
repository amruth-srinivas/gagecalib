from models import Base, engine, SessionLocal, User, async_engine, AsyncSessionLocal
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

def init_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create admin user if it doesn't exist
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@gagecalibration.com",
                role="admin",
                password_hash=User.get_password_hash("admin123")  # Change this in production!
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()

async def init_async_db():
    # Create tables
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create admin user if it doesn't exist
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).filter(User.username == "admin"))
        admin = result.scalar_one_or_none()
        
        if not admin:
            admin = User(
                username="admin",
                email="admin@gagecalibration.com",
                role="admin",
                password_hash=User.get_password_hash("admin123")  # Change this in production!
            )
            db.add(admin)
            await db.commit()

def get_admin_user(db: Session):
    return db.query(User).filter(User.username == "admin").first()

async def get_admin_user_async(db: AsyncSession):
    result = await db.execute(select(User).filter(User.username == "admin"))
    return result.scalar_one_or_none()

# Dependency to get the synchronous database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_async_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

__all__ = ['SessionLocal', 'AsyncSessionLocal', 'engine', 'async_engine', 'get_db', 'get_async_db']
