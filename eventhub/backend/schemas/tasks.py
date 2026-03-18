from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    event_id: str
    title: str
    assigned_to: str | None = None
    due_date: date | None = None


class TaskStatusUpdate(BaseModel):
    status: str


class TaskOut(BaseModel):
    id: str
    event_id: str
    title: str
    assigned_to: str | None
    created_by: str
    status: str
    due_date: date | None

    model_config = ConfigDict(from_attributes=True)


class ProgressOut(BaseModel):
    event_id: str
    total: int
    done: int
    progress: int


class CalendarEvent(BaseModel):
    id: str
    title: str
    start: str
    end: str | None
    type: str
    color: str | None = None


class SectionReportCreate(BaseModel):
    text: str


class SectionReportOut(BaseModel):
    id: str
    section_id: str
    author_id: str
    text: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

