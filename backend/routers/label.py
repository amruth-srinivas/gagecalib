from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from datetime import datetime

from models import Label, LabelTemplate, User
from schemas import LabelCreate, LabelResponse, LabelTemplateCreate, LabelTemplateUpdate, LabelTemplateResponse
from pydantic import Field
from database import get_async_db
from routers.auth import get_current_user

router = APIRouter()

# Create Label
@router.post("/labels/", response_model=LabelResponse)
async def create_label(
    label: LabelCreate,
    db: AsyncSession = Depends(get_async_db)
):
    db_label = Label(**label.model_dump())
    db.add(db_label)
    await db.commit()
    await db.refresh(db_label)
    return db_label

# Get Labels (List)
@router.get("/labels/", response_model=List[LabelResponse])
async def read_labels(
    skip: int = 0,
    limit: int = 100,
    gage_id: int | None = None,
    calibration_record_id: int | None = None,
    db: AsyncSession = Depends(get_async_db)
):
    query = select(Label)
    if gage_id is not None:
        query = query.where(Label.gage_id == gage_id)
    if calibration_record_id is not None:
        query = query.where(Label.calibration_record_id == calibration_record_id)

    result = await db.execute(query.offset(skip).limit(limit))
    labels = result.scalars().all()

    # TODO: Implement logic to filter labels based on user role if necessary in a real-world scenario
    # This might involve checking the authenticated user's role and filtering the results accordingly.

    return labels

# Get Label by ID
@router.get("/labels/{label_id}", response_model=LabelResponse)
async def read_label(
    label_id: int,
    db: AsyncSession = Depends(get_async_db)
):
    result = await db.execute(select(Label).where(Label.id == label_id))
    db_label = result.scalar_one_or_none()
    if db_label is None:
        raise HTTPException(status_code=404, detail="Label not found")

    # TODO: Implement logic to check user role visibility if necessary

    return db_label

# Delete Label
@router.delete("/labels/{label_id}")
async def delete_label(
    label_id: int,
    db: AsyncSession = Depends(get_async_db)
):
    result = await db.execute(select(Label).where(Label.id == label_id))
    db_label = result.scalar_one_or_none()
    if db_label is None:
        raise HTTPException(status_code=404, detail="Label not found")

    await db.delete(db_label)
    await db.commit()
    return {"detail": "Label deleted successfully"}

class LabelTemplateCreateWithQR(LabelTemplateCreate):
    qr_code_size: int = Field(default=100, ge=50, le=300, description="Size of the QR code in pixels")

@router.post("/label-templates/", response_model=LabelTemplateResponse)
async def create_label_template(
    template: LabelTemplateCreateWithQR,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    # Only admin can create templates
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create label templates"
        )
    
    # Create new template
    db_template = LabelTemplate(
        gage_id=template.gage_id,
        template_name=template.template_name,
        template_data={
            **template.template_data,
            "qr_code_size": template.qr_code_size
        },
        created_by=current_user.id
    )
    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)
    return db_template

@router.get("/label-templates", response_model=List[LabelTemplateResponse])
async def get_label_templates(
    gage_id: int = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    query = select(LabelTemplate)
    
    # Filter by gage_id if provided
    if gage_id is not None:
        query = query.where(LabelTemplate.gage_id == gage_id)
    
    result = await db.execute(query)
    templates = result.scalars().all()
    return templates

@router.get("/label-templates/{template_id}", response_model=LabelTemplateResponse)
async def get_label_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    result = await db.execute(select(LabelTemplate).where(LabelTemplate.id == template_id))
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Label template not found"
        )
    
    return template

@router.put("/label-templates/{template_id}", response_model=LabelTemplateResponse)
async def update_label_template(
    template_id: int,
    template_update: LabelTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    # Only admin can update templates
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update label templates"
        )
    
    result = await db.execute(select(LabelTemplate).where(LabelTemplate.id == template_id))
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Label template not found"
        )
    
    # Update template fields
    update_data = template_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    await db.commit()
    await db.refresh(template)
    return template

@router.delete("/label-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    # Only admin can delete templates
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete label templates"
        )
    
    result = await db.execute(select(LabelTemplate).where(LabelTemplate.id == template_id))
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Label template not found"
        )
    
    await db.delete(template)
    await db.commit()
    return None 