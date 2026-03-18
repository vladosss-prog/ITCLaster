from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Event,
    EventMembership,
    Report,
    ReportComment,
    ReportFeedback,
    Section,
    User,
    UserReportSchedule,
)
from routers.auth import get_current_user

router = APIRouter()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid4())


def _get_event_or_404(db: Session, event_id: str) -> Event:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    return event


def _get_report_with_section_or_404(db: Session, report_id: str) -> tuple[Report, Section]:
    stmt = select(Report, Section).join(Section, Section.id == Report.section_id).where(Report.id == report_id)
    row = db.execute(stmt).first()
    if not row:
        raise HTTPException(status_code=404, detail="Доклад не найден")
    report, section = row
    return report, section


def _ensure_event_membership(db: Session, user_id: str, event_id: str) -> None:
    # Any membership means the user is connected to the event (participant/curator/speaker).
    stmt = select(EventMembership.id).where(and_(EventMembership.user_id == user_id, EventMembership.event_id == event_id))
    if db.execute(stmt).scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Сначала зарегистрируйтесь на мероприятие")


def _can_answer_comment(db: Session, user: User, report: Report, section: Section) -> bool:
    # Direct ownership by fields:
    if report.speaker_id and report.speaker_id == user.id:
        return True
    if section.curator_id and section.curator_id == user.id:
        return True

    # Or membership-based role, optionally scoped to section/report.
    stmt = (
        select(EventMembership.id)
        .where(
            and_(
                EventMembership.user_id == user.id,
                EventMembership.event_id == section.event_id,
                EventMembership.context_role.in_(["CURATOR", "SPEAKER"]),
                # if membership is scoped - must match
                (EventMembership.section_id.is_(None)) | (EventMembership.section_id == section.id),
                (EventMembership.report_id.is_(None)) | (EventMembership.report_id == report.id),
            )
        )
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none() is not None


# ---------- Schemas (kept local, same approach as routers/chat.py) ----------


class RegistrationOut(BaseModel):
    event_id: str
    user_id: str
    role: str
    status: str


class ProgramReportOut(BaseModel):
    id: str
    title: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    speaker_id: Optional[str] = None
    speaker_name: Optional[str] = None
    description: Optional[str] = None


class ProgramSectionOut(BaseModel):
    id: str
    title: str
    format: Optional[str] = None
    location: Optional[str] = None
    section_start: Optional[datetime] = None
    section_end: Optional[datetime] = None
    reports: List[ProgramReportOut]


class ProgramOut(BaseModel):
    event_id: str
    sections: List[ProgramSectionOut]


class MyScheduleItemOut(BaseModel):
    report: ProgramReportOut
    section: ProgramSectionOut
    event_id: str


class ScheduleActionOut(BaseModel):
    report_id: str
    status: str


class CommentCreateIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)


class CommentAnswerIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)


class CommentOut(BaseModel):
    id: str
    report_id: str
    author_id: str
    text: str
    created_at: datetime
    answer_text: Optional[str] = None
    answer_by_id: Optional[str] = None
    answer_created_at: Optional[datetime] = None


class FeedbackIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)


class FeedbackOut(BaseModel):
    report_id: str
    user_id: str
    rating: int


class FeedbackAggregateOut(BaseModel):
    report_id: str
    average: float
    count: int
    distribution: Dict[int, int]


# ---------- Endpoints ----------


@router.post("/events/{id}/register", response_model=RegistrationOut)
def register_on_event(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RegistrationOut:
    _get_event_or_404(db, id)

    # Event-level participant membership: context_role=PARTICIPANT and no section/report scope.
    stmt = select(EventMembership).where(
        and_(
            EventMembership.user_id == current_user.id,
            EventMembership.event_id == id,
            EventMembership.context_role == "PARTICIPANT",
            EventMembership.section_id.is_(None),
            EventMembership.report_id.is_(None),
        )
    )
    membership = db.execute(stmt).scalar_one_or_none()
    if membership:
        return RegistrationOut(event_id=id, user_id=current_user.id, role="PARTICIPANT", status="already_registered")

    membership = EventMembership(
        id=_new_id(),
        user_id=current_user.id,
        event_id=id,
        context_role="PARTICIPANT",
        section_id=None,
        report_id=None,
    )
    db.add(membership)
    db.commit()
    return RegistrationOut(event_id=id, user_id=current_user.id, role="PARTICIPANT", status="registered")


@router.get("/events/{id}/program", response_model=ProgramOut)
def event_program(id: str, db: Session = Depends(get_db)) -> ProgramOut:
    _get_event_or_404(db, id)

    sections = list(db.execute(select(Section).where(Section.event_id == id).order_by(Section.section_start)).scalars().all())
    if not sections:
        return ProgramOut(event_id=id, sections=[])

    section_ids = [s.id for s in sections]
    reports = list(
        db.execute(
            select(Report)
            .where(Report.section_id.in_(section_ids))  # type: ignore[arg-type]
            .order_by(Report.start_time)
        )
        .scalars()
        .all()
    )

    speaker_ids = {r.speaker_id for r in reports if r.speaker_id}
    speakers_by_id: Dict[str, str] = {}
    if speaker_ids:
        users = list(db.execute(select(User).where(User.id.in_(list(speaker_ids)))).scalars().all())  # type: ignore[arg-type]
        speakers_by_id = {u.id: u.full_name for u in users}

    reports_by_section: Dict[str, List[ProgramReportOut]] = {}
    for r in reports:
        reports_by_section.setdefault(r.section_id, []).append(
            ProgramReportOut(
                id=r.id,
                title=r.title,
                start_time=r.start_time,
                end_time=r.end_time,
                speaker_id=r.speaker_id,
                speaker_name=speakers_by_id.get(r.speaker_id) if r.speaker_id else None,
                description=r.description,
            )
        )

    out_sections: List[ProgramSectionOut] = []
    for s in sections:
        out_sections.append(
            ProgramSectionOut(
                id=s.id,
                title=s.title,
                format=s.format,
                location=s.location,
                section_start=s.section_start,
                section_end=s.section_end,
                reports=reports_by_section.get(s.id, []),
            )
        )

    return ProgramOut(event_id=id, sections=out_sections)


@router.get("/schedule/my", response_model=List[MyScheduleItemOut])
def my_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[MyScheduleItemOut]:
    # Join schedule -> report -> section
    stmt = (
        select(UserReportSchedule, Report, Section)
        .join(Report, Report.id == UserReportSchedule.report_id)
        .join(Section, Section.id == Report.section_id)
        .where(UserReportSchedule.user_id == current_user.id)
        .order_by(Report.start_time)
    )
    rows = list(db.execute(stmt).all())

    # Speakers map
    speaker_ids = {report.speaker_id for _, report, _ in rows if report.speaker_id}
    speakers_by_id: Dict[str, str] = {}
    if speaker_ids:
        users = list(db.execute(select(User).where(User.id.in_(list(speaker_ids)))).scalars().all())  # type: ignore[arg-type]
        speakers_by_id = {u.id: u.full_name for u in users}

    items: List[MyScheduleItemOut] = []
    for _, report, section in rows:
        report_out = ProgramReportOut(
            id=report.id,
            title=report.title,
            start_time=report.start_time,
            end_time=report.end_time,
            speaker_id=report.speaker_id,
            speaker_name=speakers_by_id.get(report.speaker_id) if report.speaker_id else None,
            description=report.description,
        )
        section_out = ProgramSectionOut(
            id=section.id,
            title=section.title,
            format=section.format,
            location=section.location,
            section_start=section.section_start,
            section_end=section.section_end,
            reports=[],
        )
        items.append(MyScheduleItemOut(report=report_out, section=section_out, event_id=section.event_id))
    return items


@router.post("/schedule/reports/{id}", response_model=ScheduleActionOut)
def add_report_to_schedule(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleActionOut:
    report, section = _get_report_with_section_or_404(db, id)
    _ensure_event_membership(db, current_user.id, section.event_id)

    stmt = select(UserReportSchedule).where(
        and_(UserReportSchedule.user_id == current_user.id, UserReportSchedule.report_id == report.id)
    )
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        return ScheduleActionOut(report_id=report.id, status="already_added")

    row = UserReportSchedule(id=_new_id(), user_id=current_user.id, report_id=report.id, created_at=_now())
    db.add(row)
    db.commit()
    return ScheduleActionOut(report_id=report.id, status="added")


@router.delete("/schedule/reports/{id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_report_from_schedule(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    stmt = select(UserReportSchedule).where(
        and_(UserReportSchedule.user_id == current_user.id, UserReportSchedule.report_id == id)
    )
    row = db.execute(stmt).scalar_one_or_none()
    if not row:
        # project doesn't have a "style" yet for this; 404 is explicit for frontend.
        raise HTTPException(status_code=404, detail="Доклад не найден в расписании")
    db.delete(row)
    db.commit()
    return None


@router.get("/reports/{id}/comments", response_model=List[CommentOut])
def list_report_comments(
    id: str,
    db: Session = Depends(get_db),
) -> List[CommentOut]:
    """Список комментариев к докладу."""
    _get_report_with_section_or_404(db, id)
    stmt = (
        select(ReportComment)
        .where(ReportComment.report_id == id)
        .order_by(ReportComment.created_at.asc())
    )
    comments = list(db.execute(stmt).scalars().all())
    return [CommentOut.model_validate(c, from_attributes=True) for c in comments]


@router.post("/reports/{id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_report_comment(
    id: str,
    body: CommentCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentOut:
    report, section = _get_report_with_section_or_404(db, id)
    _ensure_event_membership(db, current_user.id, section.event_id)
    comment = ReportComment(
        id=_new_id(),
        report_id=id,
        author_id=current_user.id,
        text=body.text,
        created_at=_now(),
        answer_text=None,
        answer_by_id=None,
        answer_created_at=None,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentOut.model_validate(comment, from_attributes=True)


@router.put("/comments/{id}/answer", response_model=CommentOut)
def answer_comment(
    id: str,
    body: CommentAnswerIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentOut:
    comment = db.get(ReportComment, id)
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")

    report, section = _get_report_with_section_or_404(db, comment.report_id)
    if not _can_answer_comment(db, current_user, report, section):
        raise HTTPException(status_code=403, detail="Нет прав отвечать на этот комментарий")

    comment.answer_text = body.text
    comment.answer_by_id = current_user.id
    comment.answer_created_at = _now()
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentOut.model_validate(comment, from_attributes=True)


@router.post("/reports/{id}/feedback", response_model=FeedbackOut)
def set_report_feedback(
    id: str,
    body: FeedbackIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeedbackOut:
    report, section = _get_report_with_section_or_404(db, id)
    _ensure_event_membership(db, current_user.id, section.event_id)

    stmt = select(ReportFeedback).where(and_(ReportFeedback.report_id == id, ReportFeedback.user_id == current_user.id))
    fb = db.execute(stmt).scalar_one_or_none()
    if fb:
        fb.rating = body.rating
        fb.created_at = _now()
        db.add(fb)
        db.commit()
        return FeedbackOut(report_id=id, user_id=current_user.id, rating=fb.rating)

    fb = ReportFeedback(id=_new_id(), report_id=id, user_id=current_user.id, rating=body.rating, created_at=_now())
    db.add(fb)
    db.commit()
    return FeedbackOut(report_id=id, user_id=current_user.id, rating=body.rating)


@router.get("/reports/{id}/feedback", response_model=FeedbackAggregateOut)
def get_report_feedback(id: str, db: Session = Depends(get_db)) -> FeedbackAggregateOut:
    _get_report_with_section_or_404(db, id)

    avg_stmt = select(func.avg(ReportFeedback.rating), func.count(ReportFeedback.id)).where(ReportFeedback.report_id == id)
    avg, cnt = db.execute(avg_stmt).one()
    count = int(cnt or 0)
    average = float(avg or 0.0)

    dist_stmt = (
        select(ReportFeedback.rating, func.count(ReportFeedback.id))
        .where(ReportFeedback.report_id == id)
        .group_by(ReportFeedback.rating)
    )
    dist_rows = list(db.execute(dist_stmt).all())
    distribution: Dict[int, int] = {i: 0 for i in range(1, 6)}
    for rating, c in dist_rows:
        distribution[int(rating)] = int(c)

    return FeedbackAggregateOut(report_id=id, average=average, count=count, distribution=distribution)


@router.get("/ping")
def ping():
    return {"router": "participants", "status": "ok"}

