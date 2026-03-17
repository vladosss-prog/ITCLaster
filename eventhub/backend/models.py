from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def _uuid() -> str:
    return str(uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    organization: Mapped[str | None] = mapped_column(String, nullable=True)
    global_role: Mapped[str] = mapped_column(String, nullable=False, default="PARTICIPANT")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="DRAFT")


class EventMembership(Base):
    __tablename__ = "event_memberships"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    event_id: Mapped[str] = mapped_column(String, ForeignKey("events.id"), nullable=False)
    context_role: Mapped[str] = mapped_column(String, nullable=False)
    section_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("sections.id", use_alter=True, name="fk_membership_section"),
        nullable=True,
    )
    report_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("reports.id", use_alter=True, name="fk_membership_report"),
        nullable=True,
    )


class Section(Base):
    __tablename__ = "sections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String, ForeignKey("events.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    curator_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    format: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    section_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    section_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    moderator_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    tech_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    readiness_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    section_id: Mapped[str] = mapped_column(String, ForeignKey("sections.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    speaker_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    speaker_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    presentation_format: Mapped[str | None] = mapped_column(String, nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String, ForeignKey("events.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="TODO")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class SectionReport(Base):
    __tablename__ = "section_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    section_id: Mapped[str] = mapped_column(String, ForeignKey("sections.id"), nullable=False)
    author_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    event_id: Mapped[str | None] = mapped_column(String, ForeignKey("events.id"), nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    room_id: Mapped[str] = mapped_column(String, ForeignKey("chat_rooms.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

