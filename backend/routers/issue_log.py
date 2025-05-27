from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from models import IssueLog, Gage
from schemas import IssueLogCreate, IssueLogResponse, IssueLogUpdate
from database import get_async_db, get_db
from datetime import datetime
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/api/issue-log",
    tags=["issue-log"]
)

@router.post("/", response_model=IssueLogResponse)
async def create_issue_log(issue_log: IssueLogCreate, db: AsyncSession = Depends(get_async_db)):
    # Check if gage exists
    result = await db.execute(select(Gage).where(Gage.gage_id == issue_log.gage_id))
    gage = result.scalar_one_or_none()
    if not gage:
        raise HTTPException(status_code=404, detail="Gage not found")
    
    # Create new issue log
    db_issue_log = IssueLog(**issue_log.dict())
    db.add(db_issue_log)
    
    # Update gage status to "Issued"
    gage.status = "Issued"
    
    await db.commit()
    await db.refresh(db_issue_log)
    return db_issue_log

@router.get("/", response_model=List[IssueLogResponse])
async def get_issue_logs(db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(IssueLog))
    return result.scalars().all()

@router.get("/{issue_id}", response_model=IssueLogResponse)
async def get_issue_log(issue_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(IssueLog).where(IssueLog.issue_id == issue_id))
    issue_log = result.scalar_one_or_none()
    if not issue_log:
        raise HTTPException(status_code=404, detail="Issue log not found")
    return issue_log

@router.put("/{issue_id}", response_model=IssueLogResponse)
async def update_issue_log(issue_id: int, issue_log: IssueLogUpdate, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(IssueLog).where(IssueLog.issue_id == issue_id))
    db_issue_log = result.scalar_one_or_none()
    if not db_issue_log:
        raise HTTPException(status_code=404, detail="Issue log not found")
    
    # Update fields
    for key, value in issue_log.dict(exclude_unset=True).items():
        setattr(db_issue_log, key, value)
    
    # If return date is being set, update gage status to "Active"
    if issue_log.return_date:
        result = await db.execute(select(Gage).where(Gage.gage_id == db_issue_log.gage_id))
        gage = result.scalar_one_or_none()
        if gage:
            gage.status = "Active"
    
    await db.commit()
    await db.refresh(db_issue_log)
    return db_issue_log

@router.delete("/{issue_id}")
async def delete_issue_log(issue_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(IssueLog).where(IssueLog.issue_id == issue_id))
    db_issue_log = result.scalar_one_or_none()
    if not db_issue_log:
        raise HTTPException(status_code=404, detail="Issue log not found")
    
    await db.delete(db_issue_log)
    await db.commit()
    return {"status": "success", "message": f"Issue log {issue_id} deleted"}

@router.get("/user/{user_id}", response_model=dict)
def get_user_gages(user_id: int, db: Session = Depends(get_db)):
    """
    Get all gages handled and returned by a specific user
    """
    try:
        # Get gages currently handled by the user
        handled_gages = db.query(IssueLog).filter(
            IssueLog.handled_by == user_id,
            IssueLog.return_date == None
        ).all()

        # Get gages returned by the user
        returned_gages = db.query(IssueLog).filter(
            IssueLog.returned_by == user_id
        ).all()

        return {
            "handled_gages": [
                {
                    "issue_id": log.issue_id,
                    "gage_id": log.gage_id,
                    "issue_date": log.issue_date,
                    "issued_from": log.issued_from,
                    "issued_to": log.issued_to
                } for log in handled_gages
            ],
            "returned_gages": [
                {
                    "issue_id": log.issue_id,
                    "gage_id": log.gage_id,
                    "issue_date": log.issue_date,
                    "issued_from": log.issued_from,
                    "issued_to": log.issued_to,
                    "return_date": log.return_date,
                    "condition_on_return": log.condition_on_return
                } for log in returned_gages
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 