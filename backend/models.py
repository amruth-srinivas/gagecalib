from sqlalchemy import Column, Integer, String, DateTime, create_engine, Text, JSON, Date, ForeignKey, Numeric, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base
from datetime import datetime
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from config import get_settings
from datetime import datetime, timezone

settings = get_settings()

# SQLAlchemy setup
Base = declarative_base()
pwd_context = CryptContext(
    schemes=["bcrypt"],
    bcrypt__rounds=12,  # Use a fixed number of rounds
    deprecated="auto"
)

# Database engines
engine = create_engine(settings.DATABASE_URL)
async_engine = create_async_engine(settings.ASYNC_DATABASE_URL)

# Session makers
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
AsyncSessionLocal = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)

# SQLAlchemy Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    role = Column(String(20), nullable=False, default="user")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    def verify_password(self, password: str) -> bool:
        try:
            return pwd_context.verify(password, self.password_hash)
        except Exception:
            return False

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

class Gage(Base):
    __tablename__ = "gages"
    gage_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    description = Column(Text)
    serial_number = Column(String(100))
    model_number = Column(String(100))
    manufacturer = Column(String(100))
    purchase_date = Column(Date)
    location = Column(String(100))
    status = Column(String(50))
    calibration_frequency = Column(Integer)
    last_calibration_date = Column(Date)
    next_calibration_due = Column(Date)
    gage_type = Column(String(50))
    cal_category = Column(String(50))

class CalibrationRecord(Base):
    __tablename__ = "calibration_records"

    calibration_id = Column(Integer, primary_key=True, index=True)
    gage_id = Column(Integer)
    calibration_date = Column(Date)
    calibrated_by = Column(Integer)
    calibration_method = Column(Text)
    calibration_result = Column(String(100))
    deviation_recorded = Column(Text)
    adjustments_made = Column(Integer)  # Boolean in DB, use Integer for compatibility
    certificate_number = Column(String(100))
    next_due_date = Column(Date)
    comments = Column(Text)
    calibration_document_path = Column(Text)
    notification_sent = Column(Boolean, default=False)
    notification_sent_date = Column(DateTime, nullable=True)
    notification_read = Column(Boolean, default=False)
    notification_read_date = Column(DateTime, nullable=True)

# Add association table for Gage <-> Calibration Record if needed
# Example: calibration_gage_link = Table('calibration_gage_link', Base.metadata, ...)

# New Label Model
class Label(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, index=True)
    gage_id = Column(Integer, ForeignKey("gages.gage_id"), nullable=False)
    calibration_record_id = Column(Integer, ForeignKey("calibration_records.calibration_id"), nullable=True) # Link to specific calibration
    template_used = Column(String, index=True, nullable=False)
    label_size = Column(String, nullable=False)
    logo_filename = Column(String, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    # Add other fields for specific settings saved with the label if needed

    # Relationships
    gage = relationship("Gage")
    calibration_record = relationship("CalibrationRecord")

class IssueLog(Base):
    __tablename__ = "issue_log"

    issue_id = Column(Integer, primary_key=True, index=True)
    gage_id = Column(Integer)
    issue_date = Column(DateTime)
    issued_from = Column(String(100))
    issued_to = Column(String(100))
    handled_by = Column(Integer)
    return_date = Column(DateTime)
    returned_by = Column(Integer)
    condition_on_return = Column(Text)

class CalibrationMeasurement(Base):
    __tablename__ = "calibration_measurements"
    
    measurement_id = Column(Integer, primary_key=True, index=True)
    calibration_id = Column(Integer, ForeignKey("calibration_records.calibration_id"))
    gage_id = Column(Integer, ForeignKey("gages.gage_id"))
    function_point = Column(String(50))
    nominal_value = Column(Numeric(precision=10, scale=6))
    tolerance_plus = Column(Numeric(precision=10, scale=6))
    tolerance_minus = Column(Numeric(precision=10, scale=6))
    before_measurement = Column(Numeric(precision=10, scale=6))
    after_measurement = Column(Numeric(precision=10, scale=6))
    master_gage_id = Column(Integer, ForeignKey("gages.gage_id"), nullable=True)
    temperature = Column(Numeric(precision=5, scale=2))
    humidity = Column(Numeric(precision=5, scale=2))
    
    # Relationships
    calibration_record = relationship("CalibrationRecord")
    gage = relationship("Gage", foreign_keys=[gage_id])
    master_gage = relationship("Gage", foreign_keys=[master_gage_id])

# Pydantic Models
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: str = "user"

    class Config:
        orm_mode = True

class UserCreate(UserBase):
    password: str

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Database dependencies
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

class LabelTemplate(Base):
    __tablename__ = "label_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    gage_id = Column(Integer, ForeignKey("gages.gage_id"), nullable=False)
    template_name = Column(String(100), nullable=False)
    template_data = Column(JSON, nullable=False)  # Stores template configuration
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    gage = relationship("Gage", back_populates="label_templates")
    creator = relationship("User", back_populates="created_templates")

# Add relationship to User model
User.created_templates = relationship("LabelTemplate", back_populates="creator")

# Add relationship to Gage model
Gage.label_templates = relationship("LabelTemplate", back_populates="gage")
