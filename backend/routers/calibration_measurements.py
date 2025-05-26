from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, distinct, join
from typing import List, Optional
from models import CalibrationMeasurement, CalibrationRecord, User
from schemas import (
    CalibrationMeasurementCreate, 
    CalibrationMeasurementUpdate, 
    CalibrationMeasurementResponse
)
from database import get_async_db

router = APIRouter()

@router.get("/measurements", response_model=List[CalibrationMeasurementResponse])
async def get_measurements(
    gage_id: Optional[int] = None,
    calibration_id: Optional[int] = None,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get all measurement data for a given gage and calibration id.
    If both parameters are provided, returns measurements matching both.
    If only one parameter is provided, returns measurements matching that parameter.
    If no parameters are provided, returns all measurements.
    """
    query = select(CalibrationMeasurement)
    
    # Build filter conditions
    conditions = []
    if gage_id is not None:
        conditions.append(CalibrationMeasurement.gage_id == gage_id)
    if calibration_id is not None:
        conditions.append(CalibrationMeasurement.calibration_id == calibration_id)
    
    # Apply filters if any conditions exist
    if conditions:
        query = query.where(and_(*conditions))
    
    result = await db.execute(query)
    measurements = result.scalars().all()
    
    if not measurements:
        return []  # Return empty list instead of raising exception
    
    return measurements

@router.post("/measurements", response_model=CalibrationMeasurementResponse)
async def create_measurement(
    measurement: CalibrationMeasurementCreate,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Create a new measurement record for a given gage and calibration id.
    """
    # Create new measurement record
    db_measurement = CalibrationMeasurement(**measurement.dict())
    
    # Add to database
    db.add(db_measurement)
    await db.commit()
    await db.refresh(db_measurement)
    
    return db_measurement

@router.put("/measurements/{measurement_id}", response_model=CalibrationMeasurementResponse)
async def update_measurement(
    measurement_id: int,
    measurement_update: CalibrationMeasurementUpdate,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Update an existing measurement record by ID.
    """
    # Get the measurement record
    result = await db.execute(
        select(CalibrationMeasurement).where(CalibrationMeasurement.measurement_id == measurement_id)
    )
    db_measurement = result.scalar_one_or_none()
    
    if not db_measurement:
        raise HTTPException(status_code=404, detail="Measurement record not found")
    
    # Update fields
    update_data = measurement_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_measurement, key, value)
    
    # Save changes
    await db.commit()
    await db.refresh(db_measurement)
    
    return db_measurement

@router.delete("/measurements/{measurement_id}")
async def delete_measurement(
    measurement_id: int,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Delete a measurement record by ID.
    """
    # Get the measurement record
    result = await db.execute(
        select(CalibrationMeasurement).where(CalibrationMeasurement.measurement_id == measurement_id)
    )
    db_measurement = result.scalar_one_or_none()
    
    if not db_measurement:
        raise HTTPException(status_code=404, detail="Measurement record not found")
    
    # Delete the record
    await db.delete(db_measurement)
    await db.commit()
    
    return {"status": "success", "message": f"Measurement record {measurement_id} deleted"}

@router.get("/measurements/unique-gage-calibrations")
async def get_unique_gage_calibrations(db: AsyncSession = Depends(get_async_db)):
    """
    Return unique (gage_id, calibration_id) pairs from calibration_measurements, with calibration_date, calibration_result, performed_by (user id), and performed_by_name (username) from calibration_records and users.
    """
    # Join calibration_measurements, calibration_records, and users on calibration_id and calibrated_by
    stmt = select(
        CalibrationMeasurement.gage_id,
        CalibrationMeasurement.calibration_id,
        CalibrationRecord.calibration_date,
        CalibrationRecord.calibration_result,
        CalibrationRecord.calibrated_by,
        User.username
    ).join(
        CalibrationRecord,
        CalibrationMeasurement.calibration_id == CalibrationRecord.calibration_id
    ).join(
        User,
        CalibrationRecord.calibrated_by == User.id,
        isouter=True
    ).distinct(
        CalibrationMeasurement.gage_id,
        CalibrationMeasurement.calibration_id
    )

    result = await db.execute(stmt)
    rows = result.all()
    # Return as list of dicts
    return [
        {
            "gage_id": row.gage_id,
            "calibration_id": row.calibration_id,
            "calibration_date": row.calibration_date,
            "calibration_result": row.calibration_result,
            "performed_by": row.calibrated_by,
            "performed_by_name": row.username
        }
        for row in rows
    ] 