from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime

from models import Gage, CalibrationRecord, IssueLog, CalibrationMeasurement
from schemas import CalibrationMeasurementBase, CalibrationRecordBase, GageBase, IssueLogBase
from database import get_db

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
)

# Pydantic models for report data
class CalibrationMeasurementReport(CalibrationMeasurementBase):
    measurement_id: int
    class Config:
        orm_mode = True

class CalibrationReportDetail(CalibrationRecordBase):
    calibration_id: int
    measurements: List[CalibrationMeasurementReport] = []
    class Config:
        orm_mode = True

class GageCalibrationReport(GageBase):
    gage_id: int
    calibration_records: List[CalibrationReportDetail] = []
    class Config:
        orm_mode = True

class GageIssueLogReport(GageBase):
    gage_id: int
    issue_logs: List[IssueLogBase] = []
    class Config:
        orm_mode = True

@router.get("/calibration/{gage_id}", response_model=GageCalibrationReport)
def get_calibration_report(
    gage_id: int,
    db: Session = Depends(get_db)
):
    """Retrieve calibration report for a specific Gage ID."""
    gage = db.query(Gage).filter(Gage.gage_id == gage_id).first()
    if not gage:
        raise HTTPException(status_code=404, detail="Gage not found")

    calibration_records = db.query(CalibrationRecord).filter(CalibrationRecord.gage_id == gage_id).all()

    report_details = []
    for record in calibration_records:
        measurements = db.query(CalibrationMeasurement).filter(CalibrationMeasurement.calibration_id == record.calibration_id).all()
        report_details.append(CalibrationReportDetail(
            calibration_id=record.calibration_id,
            gage_id=record.gage_id,
            calibration_date=record.calibration_date,
            calibrated_by=record.calibrated_by,
            calibration_method=record.calibration_method,
            calibration_result=record.calibration_result,
            deviation_recorded=record.deviation_recorded,
            adjustments_made=record.adjustments_made,
            certificate_number=record.certificate_number,
            next_due_date=record.next_due_date,
            comments=record.comments,
            calibration_document_path=record.calibration_document_path,
            measurements=measurements
        ))

    return GageCalibrationReport(
        gage_id=gage.gage_id,
        name=gage.name,
        description=gage.description,
        serial_number=gage.serial_number,
        model_number=gage.model_number,
        manufacturer=gage.manufacturer,
        purchase_date=gage.purchase_date,
        location=gage.location,
        status=gage.status,
        calibration_frequency=gage.calibration_frequency,
        last_calibration_date=gage.last_calibration_date,
        next_calibration_due=gage.next_calibration_due,
        gage_type=gage.gage_type,
        cal_category=gage.cal_category,
        calibration_records=report_details
    )

@router.get("/issue-log/{gage_id}", response_model=GageIssueLogReport)
def get_issue_log_report(
    gage_id: int,
    db: Session = Depends(get_db)
):
    """Retrieve issue log report for a specific Gage ID."""
    try:
        gage = db.query(Gage).filter(Gage.gage_id == gage_id).first()
        if not gage:
            raise HTTPException(status_code=404, detail="Gage not found")

        issue_logs = db.query(IssueLog).filter(IssueLog.gage_id == gage_id).all()

        # Ensure all required fields are present and handle potential None values
        validated_issue_logs = []
        for log in issue_logs:
            validated_issue_logs.append(IssueLogBase(
                issue_id=log.issue_id,
                gage_id=log.gage_id,
                issue_date=log.issue_date,
                issued_from=log.issued_from or "N/A", # Provide default for None
                issued_to=log.issued_to or "N/A",     # Provide default for None
                handled_by=log.handled_by or "N/A", # Provide default for None
                return_date=log.return_date,
                returned_by=log.returned_by or "N/A", # Provide default for None
                condition_on_return=log.condition_on_return or "N/A", # Provide default for None
            ))

        return GageIssueLogReport(
            gage_id=gage.gage_id,
            name=gage.name,
            description=gage.description,
            serial_number=gage.serial_number,
            model_number=gage.model_number,
            manufacturer=gage.manufacturer,
            purchase_date=gage.purchase_date,
            location=gage.location,
            status=gage.status,
            calibration_frequency=gage.calibration_frequency,
            last_calibration_date=gage.last_calibration_date,
            next_calibration_due=gage.next_calibration_due,
            gage_type=gage.gage_type,
            cal_category=gage.cal_category,
            issue_logs=validated_issue_logs # Use the validated list
        )
    except HTTPException as he:
        # Re-raise known HTTP exceptions
        raise he
    except Exception as e:
        # Catch any other exceptions and return a 500 error with detail
        print(f"Error fetching issue log report for gage {gage_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {e}") 