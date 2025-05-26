from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from models import Gage
from schemas import GageCreate, GageResponse
from database import get_async_db

router = APIRouter()

@router.get("/gages", response_model=List[GageResponse])
async def list_gages(db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Gage))
    return result.scalars().all()

@router.post("/gages", response_model=GageResponse)
async def create_gage(gage: GageCreate, db: AsyncSession = Depends(get_async_db)):
    # Check for existing gage with the same serial_number
    result = await db.execute(select(Gage).where(Gage.serial_number == gage.serial_number))
    existing_gage = result.scalar_one_or_none()
    if existing_gage:
        raise HTTPException(status_code=400, detail="A gage with this serial number already exists.")
    db_gage = Gage(**gage.dict())
    db.add(db_gage)
    await db.commit()
    await db.refresh(db_gage)
    return db_gage

@router.get("/gages/{gage_id}", response_model=GageResponse)
async def get_gage(gage_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Gage).where(Gage.gage_id == gage_id))
    gage = result.scalar_one_or_none()
    if not gage:
        raise HTTPException(status_code=404, detail="Gage not found")
    return gage

@router.put("/gages/{gage_id}", response_model=GageResponse)
async def update_gage(gage_id: int, gage: GageCreate, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Gage).where(Gage.gage_id == gage_id))
    db_gage = result.scalar_one_or_none()
    if not db_gage:
        raise HTTPException(status_code=404, detail="Gage not found")
    for key, value in gage.dict().items():
        setattr(db_gage, key, value)
    await db.commit()
    await db.refresh(db_gage)
    return db_gage

@router.delete("/gages/{gage_id}")
async def delete_gage(gage_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Gage).where(Gage.gage_id == gage_id))
    db_gage = result.scalar_one_or_none()
    if not db_gage:
        raise HTTPException(status_code=404, detail="Gage not found")
    await db.delete(db_gage)
    await db.commit()
    return {"status": "success", "message": f"Gage {gage_id} deleted"} 