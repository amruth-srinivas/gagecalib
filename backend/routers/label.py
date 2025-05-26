from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from datetime import datetime

from models import Label
from schemas import LabelCreate, LabelResponse
from database import get_async_db

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