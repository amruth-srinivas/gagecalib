from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from typing import List, Optional
from models import CalibrationRecord
from schemas import CalibrationRecordCreate, CalibrationRecordUpdate, CalibrationRecordResponse
from database import get_async_db, get_db
from email_service import send_calibration_notification
from datetime import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/calibrations")
async def get_calibrations(db: AsyncSession = Depends(get_async_db)):
    try:
        # Query without notification fields first
        query = select(CalibrationRecord).order_by(desc(CalibrationRecord.calibration_date))
        result = await db.execute(query)
        calibrations = result.scalars().all()
        
        # Convert to dict and add notification fields with defaults
        calibration_list = []
        for cal in calibrations:
            try:
                # Convert dates to strings safely
                calibration_date = cal.calibration_date.isoformat() if cal.calibration_date else None
                next_due_date = cal.next_due_date.isoformat() if cal.next_due_date else None
                notification_sent_date = cal.notification_sent_date.isoformat() if cal.notification_sent_date else None
                notification_read_date = cal.notification_read_date.isoformat() if cal.notification_read_date else None

                cal_dict = {
                    "calibration_id": cal.calibration_id,
                    "gage_id": cal.gage_id,
                    "calibration_date": calibration_date,
                    "calibrated_by": cal.calibrated_by,
                    "calibration_method": cal.calibration_method or "",
                    "calibration_result": cal.calibration_result or "",
                    "deviation_recorded": cal.deviation_recorded or "",
                    "adjustments_made": cal.adjustments_made or 0,
                    "certificate_number": cal.certificate_number or "",
                    "next_due_date": next_due_date,
                    "comments": cal.comments or "",
                    "calibration_document_path": cal.calibration_document_path or "",
                    # Add notification fields with defaults
                    "notification_sent": getattr(cal, 'notification_sent', False),
                    "notification_sent_date": notification_sent_date,
                    "notification_read": getattr(cal, 'notification_read', False),
                    "notification_read_date": notification_read_date
                }
                calibration_list.append(cal_dict)
            except Exception as e:
                logger.error(f"Error processing calibration record {getattr(cal, 'calibration_id', 'unknown')}: {str(e)}")
                continue
        
        return calibration_list
    except Exception as e:
        logger.error(f"Error fetching calibrations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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

@router.post("/calibrations/{calibration_id}/send-notification")
async def send_notification(calibration_id: int):
    """Send email notification for a calibration record"""
    try:
        db = next(get_db())
        success = send_calibration_notification(db, calibration_id)
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to send email notification. Please check the server logs for details."
            )
        return {"status": "success", "message": "Email notification sent successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error sending email notification: {str(e)}"
        )

@router.get("/calibrations/notifications/{user_id}")
async def get_user_notifications(user_id: int, db: AsyncSession = Depends(get_async_db)):
    """Get all notifications for a specific user"""
    query = select(CalibrationRecord).where(
        CalibrationRecord.calibrated_by == user_id,
        CalibrationRecord.notification_sent == True
    ).order_by(desc(CalibrationRecord.notification_sent_date))
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return notifications

@router.post("/calibrations/{calibration_id}/mark-read")
async def mark_notification_read(calibration_id: int, db: AsyncSession = Depends(get_async_db)):
    """Mark a notification as read"""
    result = await db.execute(
        select(CalibrationRecord).where(CalibrationRecord.calibration_id == calibration_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Calibration record not found")
    
    record.notification_read = True
    record.notification_read_date = datetime.utcnow()
    await db.commit()
    
    return {"status": "success", "message": "Notification marked as read"}