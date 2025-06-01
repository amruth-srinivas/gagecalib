from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, date

class GageBase(BaseModel):
    name: str
    description: str
    serial_number: str
    model_number: str
    manufacturer: str
    purchase_date: date
    location: str
    status: str
    calibration_frequency: int
    last_calibration_date: date
    next_calibration_due: date
    gage_type: str
    cal_category: str

class GageCreate(GageBase):
    pass

class GageResponse(GageBase):
    gage_id: int
    class Config:
        orm_mode = True

class ItemResponse(BaseModel):
    id: int
    item_code: str
    subcategory: Optional[int]
    quantity: int
    available_quantity: int
    status: str
    description: Optional[str] = None
    type: Optional[str] = None

    @staticmethod
    def from_orm_with_dynamic(item):
        # Extract data from dynamic_data JSON
        description = None
        instrument_code = None
        
        try:
            if item.dynamic_data and isinstance(item.dynamic_data, dict):
                # Try both "Size" and "size" keys (case insensitive)
                description = item.dynamic_data.get('Size') or item.dynamic_data.get('size')
                # Try both "Instrument code" and "instrument code" keys (case insensitive)
                instrument_code = (
                    item.dynamic_data.get('Instrument code') or 
                    item.dynamic_data.get('instrument code') or
                    item.dynamic_data.get('Instrument Code')
                )
        except Exception as e:
            print(f"Error extracting dynamic_data for item {item.id}: {str(e)}")
        
        # Safely handle potentially null fields
        quantity = item.quantity if item.quantity is not None else 0
        available_quantity = item.available_quantity if item.available_quantity is not None else 0
        
        return ItemResponse(
            id=item.id,
            item_code=instrument_code or item.item_code or "",  # Use Instrument code if available
            subcategory=item.subcategory,
            quantity=quantity,
            available_quantity=available_quantity,
            status=item.status or "Unknown",
            description=description,
            type="LC Plug Gage"  # Always set this value
        )

class CalibrationRecordBase(BaseModel):
    gage_id: int
    calibration_date: date
    calibrated_by: int
    calibration_method: str
    calibration_result: str
    deviation_recorded: str
    adjustments_made: bool
    certificate_number: str
    next_due_date: date
    comments: str
    calibration_document_path: str

class CalibrationRecordCreate(CalibrationRecordBase):
    pass

class CalibrationRecordUpdate(BaseModel):
    calibration_date: Optional[date] = None
    calibrated_by: Optional[int] = None
    calibration_method: Optional[str] = None
    calibration_result: Optional[str] = None
    deviation_recorded: Optional[str] = None
    adjustments_made: Optional[bool] = None
    certificate_number: Optional[str] = None
    next_due_date: Optional[date] = None
    comments: Optional[str] = None
    calibration_document_path: Optional[str] = None

class CalibrationRecordResponse(CalibrationRecordBase):
    calibration_id: int
    class Config:
        orm_mode = True

class IssueLogBase(BaseModel):
    gage_id: int
    issue_date: datetime
    issued_from: str
    issued_to: str
    handled_by: int
    return_date: datetime
    returned_by: int
    condition_on_return: str

class IssueLogCreate(IssueLogBase):
    pass

class IssueLogResponse(IssueLogBase):
    issue_id: int
    # Make fields optional to allow None values from the database
    return_date: Optional[datetime] = None
    returned_by: Optional[int] = None
    condition_on_return: Optional[str] = None

    class Config:
        orm_mode = True

class IssueLogUpdate(BaseModel):
    gage_id: Optional[int] = None
    issue_date: Optional[datetime] = None
    issued_from: Optional[str] = None
    issued_to: Optional[str] = None
    handled_by: Optional[int] = None
    return_date: Optional[datetime] = None
    returned_by: Optional[int] = None
    condition_on_return: Optional[str] = None

# New Label Schemas
class LabelBase(BaseModel):
    gage_id: int
    calibration_record_id: Optional[int] = None
    template_used: str
    label_size: str
    logo_filename: Optional[str] = None
    # Add other fields for specific settings saved with the label if needed

class LabelCreate(LabelBase):
    pass

class LabelResponse(LabelBase):
    id: int
    generated_at: datetime

    class Config:
        orm_mode = True

# Calibration Measurement Schemas
class CalibrationMeasurementBase(BaseModel):
    calibration_id: int
    gage_id: int
    function_point: str
    nominal_value: float
    tolerance_plus: float
    tolerance_minus: float
    before_measurement: float
    after_measurement: float
    master_gage_id: Optional[int] = None
    temperature: float
    humidity: float

class CalibrationMeasurementCreate(CalibrationMeasurementBase):
    pass

class CalibrationMeasurementUpdate(BaseModel):
    calibration_id: Optional[int] = None
    gage_id: Optional[int] = None
    function_point: Optional[str] = None
    nominal_value: Optional[float] = None
    tolerance_plus: Optional[float] = None
    tolerance_minus: Optional[float] = None
    before_measurement: Optional[float] = None
    after_measurement: Optional[float] = None
    master_gage_id: Optional[int] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None

class CalibrationMeasurementResponse(CalibrationMeasurementBase):
    measurement_id: int
    
    class Config:
        orm_mode = True

class LabelTemplateBase(BaseModel):
    gage_id: int
    template_name: str
    template_data: dict

class LabelTemplateCreate(LabelTemplateBase):
    pass

class LabelTemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    template_data: Optional[dict] = None

class LabelTemplateResponse(LabelTemplateBase):
    id: int
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
