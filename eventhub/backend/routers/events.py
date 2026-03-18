from __future__ import annotations

import re
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete as sa_delete, or_, select
from sqlalchemy.orm import Session

from database import get_db
from models import (
    ChatMessage,
    ChatRoom,
    Event,
    EventMembership,
    Report,
    ReportComment,
    ReportFeedback,
    Section,
    SectionReport,
    Task,
    User,
    UserReportSchedule,
)
from routers.auth import get_current_user, get_current_user_optional
from routers.chat import add_user_to_event_chat


router = APIRouter()
users_router = APIRouter()
sections_router = APIRouter()
reports_router = APIRouter()


# ---------- Schemas ----------


class EventCreateIn(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class EventOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    owner_id: str
    status: str

    class Config:
        from_attributes = True


class SectionCreateIn(BaseModel):
    title: str = Field(..., min_length=1)
    format: Optional[str] = None
    location: Optional[str] = None
    section_start: Optional[datetime] = None
    section_end: Optional[datetime] = None
    tech_notes: Optional[str] = None


class SectionOut(BaseModel):
    id: str
    event_id: str
    title: str
    curator_id: Optional[str] = None
    format: Optional[str] = None
    location: Optional[str] = None
    section_start: Optional[datetime] = None
    section_end: Optional[datetime] = None
    moderator_id: Optional[str] = None       # Fix #23: добавлено
    tech_notes: Optional[str] = None          # Fix #23: добавлено
    readiness_percent: int

    class Config:
        from_attributes = True


class AssignCuratorIn(BaseModel):
    user_id: str
    section_id: Optional[str] = None


class MembershipOut(BaseModel):
    id: str
    user_id: str
    event_id: str
    context_role: str
    section_id: Optional[str] = None
    report_id: Optional[str] = None

    class Config:
        from_attributes = True


class ReportCreateIn(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    presentation_format: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class AssignSpeakerIn(BaseModel):
    user_id: str


class ReportOut(BaseModel):
    id: str
    section_id: str
    title: str
    speaker_id: Optional[str] = None
    speaker_confirmed: bool
    presentation_format: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    organization: Optional[str] = None
    global_role: str
    created_at: datetime

    class Config:
        from_attributes = True


class EventUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None


class ReportUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    presentation_format: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    speaker_confirmed: Optional[bool] = None


# ---------- Helpers ----------


def _escape_like(value: str) -> str:
    """Экранировать спецсимволы LIKE/ILIKE (%, _)."""
    return re.sub(r"([%_])", r"\\\1", value)


# ---------- Events ----------


@router.post("/", response_model=EventOut)
def create_event(
    body: EventCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    event = Event(
        title=body.title,
        description=body.description,
        start_date=body.start_date,
        end_date=body.end_date,
        owner_id=current_user.id,
        status="DRAFT",
    )
    db.add(event)
    # Fix #13: flush вместо commit — получаем event.id, но сохраняем транзакцию
    db.flush()

    membership = EventMembership(
        user_id=current_user.id,
        event_id=event.id,
        context_role="OWNER",
    )
    db.add(membership)
    # Один commit для обеих сущностей — атомарная операция
    db.commit()
    db.refresh(event)

    # Автоматически создаём GROUP-чат для мероприятия
    add_user_to_event_chat(event.id, db)

    return EventOut.model_validate(event, from_attributes=True)


@router.get("/", response_model=List[EventOut])
def list_events(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[EventOut]:
    membership_event_ids_stmt = select(EventMembership.event_id).where(EventMembership.user_id == current_user.id)
    membership_event_ids = membership_event_ids_stmt.subquery()

    stmt = (
        select(Event)
        .where(
            or_(
                Event.owner_id == current_user.id,
                Event.id.in_(select(membership_event_ids.c.event_id)),
            )
        )
        .distinct()          # Fix #20: убираем дубли
        .offset(skip)
        .limit(limit)
    )
    events = list(db.execute(stmt).scalars().all())
    return [EventOut.model_validate(e, from_attributes=True) for e in events]


@router.get("/public", response_model=List[EventOut])
def list_events_public(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[EventOut]:
    """Публичный список мероприятий (без авторизации). Только PUBLISHED."""
    stmt = (
        select(Event)
        .where(Event.status == "PUBLISHED")
        .offset(skip)
        .limit(limit)
    )
    events = list(db.execute(stmt).scalars().all())
    return [EventOut.model_validate(e, from_attributes=True) for e in events]


@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> EventOut:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")

    # PUBLISHED мероприятия доступны всем
    if event.status == "PUBLISHED":
        return EventOut.model_validate(event, from_attributes=True)

    # Для DRAFT/FINISHED нужна авторизация и членство
    if not current_user:
        raise HTTPException(status_code=403, detail="Нет доступа к мероприятию")

    membership_stmt = select(EventMembership.id).where(
        EventMembership.user_id == current_user.id,
        EventMembership.event_id == event_id,
    )
    has_membership = db.execute(membership_stmt).scalar_one_or_none() is not None
    if event.owner_id != current_user.id and not has_membership:
        raise HTTPException(status_code=403, detail="Нет доступа к мероприятию")

    return EventOut.model_validate(event, from_attributes=True)


@router.get("/{event_id}/public", response_model=EventOut)
def get_event_public(
    event_id: str,
    db: Session = Depends(get_db),
) -> EventOut:
    """Публичная страница мероприятия (без авторизации). Только PUBLISHED."""
    event = db.get(Event, event_id)
    if not event or event.status != "PUBLISHED":
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    return EventOut.model_validate(event, from_attributes=True)


# Fix #24: GET-список секций мероприятия
@router.get("/{event_id}/sections", response_model=List[SectionOut])
def list_sections(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SectionOut]:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")

    stmt = (
        select(Section)
        .where(Section.event_id == event_id)
        .order_by(Section.section_start)
    )
    sections = list(db.execute(stmt).scalars().all())
    return [SectionOut.model_validate(s, from_attributes=True) for s in sections]


@router.post("/{event_id}/sections", response_model=SectionOut)
def create_section(
    event_id: str,
    body: SectionCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SectionOut:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    if event.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только владелец мероприятия может создавать секции")

    section = Section(
        event_id=event_id,
        title=body.title,
        format=body.format,
        location=body.location,
        section_start=body.section_start,
        section_end=body.section_end,
        tech_notes=body.tech_notes,
        readiness_percent=0,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return SectionOut.model_validate(section, from_attributes=True)


@router.post("/{event_id}/curators", response_model=MembershipOut)
def assign_curator(
    event_id: str,
    body: AssignCuratorIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MembershipOut:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    if event.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только владелец мероприятия может назначать кураторов")

    target_user = db.get(User, body.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if body.section_id:
        section = db.get(Section, body.section_id)
        if not section or section.event_id != event_id:
            raise HTTPException(status_code=404, detail="Секция не найдена в этом мероприятии")
        section.curator_id = body.user_id
        db.add(section)

    # Fix #7: проверяем существующую роль, не перезаписываем OWNER/SPEAKER
    stmt = select(EventMembership).where(
        EventMembership.user_id == body.user_id,
        EventMembership.event_id == event_id,
    )
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        if existing.context_role == "OWNER":
            raise HTTPException(
                status_code=409,
                detail="Пользователь является владельцем мероприятия, назначение куратором невозможно",
            )
        # Если уже CURATOR — обновляем section_id; если SPEAKER — создаём отдельный membership
        if existing.context_role == "CURATOR":
            existing.section_id = body.section_id
            db.commit()
            db.refresh(existing)
            return MembershipOut.model_validate(existing, from_attributes=True)
        # Для SPEAKER/PARTICIPANT — создаём новую запись с ролью CURATOR
        # (поддержка множественных ролей через отдельные записи)

    membership = EventMembership(
        user_id=body.user_id,
        event_id=event_id,
        context_role="CURATOR",
        section_id=body.section_id,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return MembershipOut.model_validate(membership, from_attributes=True)


@sections_router.post("/{section_id}/reports", response_model=ReportOut)
def create_report(
    section_id: str,
    body: ReportCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    section = db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Секция не найдена")

    event = db.get(Event, section.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено для секции")
    if event.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только владелец мероприятия может создавать доклады")

    report = Report(
        section_id=section_id,
        title=body.title,
        description=body.description,
        presentation_format=body.presentation_format,
        start_time=body.start_time,
        end_time=body.end_time,
        speaker_confirmed=False,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report, from_attributes=True)


@reports_router.get("/my", response_model=List[ReportOut])
def my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ReportOut]:
    """Доклады, где текущий пользователь — спикер."""
    stmt = select(Report).where(Report.speaker_id == current_user.id)
    reports = list(db.execute(stmt).scalars().all())
    return [ReportOut.model_validate(r, from_attributes=True) for r in reports]


@reports_router.post("/{report_id}/speaker", response_model=ReportOut)
def assign_speaker(
    report_id: str,
    body: AssignSpeakerIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Доклад не найден")

    section = db.get(Section, report.section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Секция для доклада не найдена")

    event = db.get(Event, section.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие для доклада не найдено")
    if event.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только владелец мероприятия может назначать докладчиков")

    target_user = db.get(User, body.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    report.speaker_id = body.user_id
    report.speaker_confirmed = False
    db.add(report)

    # Fix #7: проверяем существующую роль
    stmt = select(EventMembership).where(
        EventMembership.user_id == body.user_id,
        EventMembership.event_id == event.id,
    )
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        if existing.context_role == "OWNER":
            raise HTTPException(
                status_code=409,
                detail="Пользователь является владельцем мероприятия, назначение докладчиком невозможно",
            )
        if existing.context_role == "SPEAKER":
            existing.report_id = report_id
            db.commit()
            db.refresh(report)
            return ReportOut.model_validate(report, from_attributes=True)
        # Для CURATOR/PARTICIPANT — создаём новую запись

    membership = EventMembership(
        user_id=body.user_id,
        event_id=event.id,
        context_role="SPEAKER",
        report_id=report_id,
    )
    db.add(membership)
    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report, from_attributes=True)


# Fix #5: экранирование спецсимволов ILIKE
@users_router.get("/search", response_model=List[UserOut])
def search_users(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[UserOut]:
    safe_q = _escape_like(q)
    stmt = (
        select(User)
        .where(User.full_name.ilike(f"%{safe_q}%"))
        .order_by(User.full_name.asc())
        .limit(20)
    )
    users = list(db.execute(stmt).scalars().all())
    return [UserOut.model_validate(u, from_attributes=True) for u in users]


# =============================================
# НОВЫЕ ЭНДПОИНТЫ (F1, F8, F13, F14)
# =============================================


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    body: EventUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    """Обновить мероприятие (только владелец)."""
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    if event.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только владелец может редактировать мероприятие")

    for field in ("title", "description", "start_date", "end_date", "status"):
        value = getattr(body, field, None)
        if value is not None:
            setattr(event, field, value)

    db.add(event)
    db.commit()
    db.refresh(event)
    return EventOut.model_validate(event, from_attributes=True)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Удалить мероприятие (только владелец). Каскадно удаляет все связанные данные."""
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    if event.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только владелец может удалить мероприятие")

    # 1. Задачи мероприятия
    db.execute(sa_delete(Task).where(Task.event_id == event_id))

    # 2. Секции и их содержимое
    section_ids_stmt = select(Section.id).where(Section.event_id == event_id)
    section_ids = list(db.execute(section_ids_stmt).scalars().all())

    if section_ids:
        # 2a. Доклады секций
        report_ids_stmt = select(Report.id).where(Report.section_id.in_(section_ids))
        report_ids = list(db.execute(report_ids_stmt).scalars().all())

        if report_ids:
            db.execute(sa_delete(ReportComment).where(ReportComment.report_id.in_(report_ids)))
            db.execute(sa_delete(ReportFeedback).where(ReportFeedback.report_id.in_(report_ids)))
            db.execute(sa_delete(UserReportSchedule).where(UserReportSchedule.report_id.in_(report_ids)))
            # Сбрасываем report_id в memberships
            db.execute(
                sa_delete(EventMembership).where(
                    EventMembership.event_id == event_id
                )
            )
            db.execute(sa_delete(Report).where(Report.section_id.in_(section_ids)))
        else:
            db.execute(sa_delete(EventMembership).where(EventMembership.event_id == event_id))

        db.execute(sa_delete(SectionReport).where(SectionReport.section_id.in_(section_ids)))
        db.execute(sa_delete(Section).where(Section.event_id == event_id))
    else:
        db.execute(sa_delete(EventMembership).where(EventMembership.event_id == event_id))

    # 3. Чат-комнаты мероприятия
    room_ids_stmt = select(ChatRoom.id).where(ChatRoom.event_id == event_id)
    room_ids = list(db.execute(room_ids_stmt).scalars().all())
    if room_ids:
        db.execute(sa_delete(ChatMessage).where(ChatMessage.room_id.in_(room_ids)))
        db.execute(sa_delete(ChatRoom).where(ChatRoom.event_id == event_id))

    db.delete(event)
    db.commit()
    return None


@reports_router.patch("/{report_id}", response_model=ReportOut)
def update_report(
    report_id: str,
    body: ReportUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    """Обновить доклад (владелец мероприятия или назначенный спикер)."""
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Доклад не найден")

    section = db.get(Section, report.section_id)
    event = db.get(Event, section.event_id) if section else None

    is_owner = event and event.owner_id == current_user.id
    is_speaker = report.speaker_id == current_user.id

    if not is_owner and not is_speaker:
        raise HTTPException(status_code=403, detail="Нет прав на редактирование доклада")

    for field in ("title", "description", "presentation_format", "start_time", "end_time", "speaker_confirmed"):
        value = getattr(body, field, None)
        if value is not None:
            setattr(report, field, value)

    db.add(report)
    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report, from_attributes=True)
