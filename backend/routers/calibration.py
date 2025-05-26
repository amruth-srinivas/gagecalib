from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from typing import List, Optional
from models import CalibrationRecord
from schemas import CalibrationRecordCreate, CalibrationRecordUpdate, CalibrationRecordResponse
from database import get_async_db

router = APIRouter()

@router.get("/calibrations", response_model=List[CalibrationRecordResponse])
async def list_calibrations(
    gage_id: Optional[int] = None,
    limit: Optional[int] = Query(None, ge=1),
    order_by: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db)
):
    query = select(CalibrationRecord)
    
    # Filter by gage_id if provided
    if gage_id is not None:
        query = query.where(CalibrationRecord.gage_id == gage_id)
    
    # Order by calibration_date if specified
    if order_by and "calibration_date" in order_by:
        if "desc" in order_by.lower():
            query = query.order_by(desc(CalibrationRecord.calibration_date))
        else:
            query = query.order_by(CalibrationRecord.calibration_date)
    
    # Apply limit if provided
    if limit is not None:
        query = query.limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/calibrations", response_model=CalibrationRecordResponse)
async def create_calibration(record: CalibrationRecordCreate, db: AsyncSession = Depends(get_async_db)):
    db_record = CalibrationRecord(**record.dict())
    db.add(db_record)
    await db.commit()
    await db.refresh(db_record)
    return db_record

@router.get("/calibrations/{calibration_id}", response_model=CalibrationRecordResponse)
async def get_calibration(calibration_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(CalibrationRecord).where(CalibrationRecord.calibration_id == calibration_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Calibration record not found")
    return record

@router.put("/calibrations/{calibration_id}", response_model=CalibrationRecordResponse)
async def update_calibration(calibration_id: int, update: CalibrationRecordUpdate, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(CalibrationRecord).where(CalibrationRecord.calibration_id == calibration_id))
    db_record = result.scalar_one_or_none()
    if not db_record:
        raise HTTPException(status_code=404, detail="Calibration record not found")
    for key, value in update.dict(exclude_unset=True).items():
        setattr(db_record, key, value)
    await db.commit()
    await db.refresh(db_record)
    return db_record

@router.delete("/calibrations/{calibration_id}")
async def delete_calibration(calibration_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(CalibrationRecord).where(CalibrationRecord.calibration_id == calibration_id))
    db_record = result.scalar_one_or_none()
    if not db_record:
        raise HTTPException(status_code=404, detail="Calibration record not found")
    await db.delete(db_record)
    await db.commit()
    return {"status": "success", "message": f"Calibration record {calibration_id} deleted"}