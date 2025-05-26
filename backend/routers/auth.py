from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional
from sqlalchemy import select
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

from models import User, UserCreate, UserResponse, Token, get_db, get_async_db
from database import get_admin_user, get_admin_user_async
from config import get_settings

router = APIRouter()
settings = get_settings()

# JWT Configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    try:
        logger.debug(f"Creating token with data: {to_encode}")
        encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        logger.debug(f"Created token: {encoded_jwt}")
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create access token"
        )

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_async_db)):
    logger.debug(f"Received token: {token}")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode the token
        logger.debug(f"Attempting to decode token with key: {settings.JWT_SECRET_KEY[:10]}...")
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        logger.debug(f"Decoded payload: {payload}")
        user_id = payload.get("sub")
        if user_id is None:
            logger.error("No user_id in token payload")
            raise credentials_exception
        
        # Convert user_id from string to integer
        try:
            user_id = int(user_id)  # Convert from string to integer
            logger.debug(f"Converted user_id to integer: {user_id}")
        except (ValueError, TypeError) as e:
            logger.error(f"Error converting user_id to integer: {str(e)}")
            raise credentials_exception
        
        # Get user from database
        result = await db.execute(select(User).filter(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            logger.error(f"No user found with id {user_id}")
            raise credentials_exception
            
        logger.debug(f"Successfully authenticated user: {user.username}")
        return user
    except JWTError as e:
        logger.error(f"JWT Error: {str(e)}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Error in get_current_user: {str(e)}")
        raise credentials_exception

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_async_db)):
    try:
        logger.debug(f"Login attempt for username: {form_data.username}")
        # Get user from database
        result = await db.execute(select(User).filter(User.username == form_data.username))
        user = result.scalar_one_or_none()
        
        if not user:
            logger.error(f"No user found with username: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.verify_password(form_data.password):
            logger.error(f"Invalid password for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.debug(f"Password verified for user: {user.username}")
        
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        
        # Create access token - convert user.id to string
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},  # Convert to string here
            expires_delta=access_token_expires
        )
        
        logger.debug(f"Login successful for user: {user.username}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
    except Exception as e:
        logger.error(f"Error in login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_async_db)
):
    # Open registration: anyone can register
    # Check if username exists
    result = await db.execute(select(User).filter(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    # Check if email exists
    result = await db.execute(select(User).filter(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        role=user_data.role,
        password_hash=User.get_password_hash(user_data.password)
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user 