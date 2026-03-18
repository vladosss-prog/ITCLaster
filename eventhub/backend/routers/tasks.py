from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from database import get_db
from models import Event, EventMembership, Section, SectionReport, Task, User
from routers.auth import get_current_user, _get_jwt_settings
from schemas.tasks import (
    CalendarEvent,
    ProgressOut,
    SectionReportCreate,
    SectionReportOut,
    TaskCreate,
    TaskOut,
    TaskStatusUpdate,
)

router = APIRouter()


class ConnectionManager:
    """
    Менеджер WebSocket-подключений для уведомлений по задачам.
    Ключ — user_id, значение — активное WebSocket-соединение.
    """

    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[user_id] = websocket

    async def disconnect(self, user_id: str) -> None:
        self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, data: dict) -> None:
        websocket = self.active_connections.get(user_id)
        if not websocket:
            return
        try:
            await websocket.send_json(data)
        except Exception:
            await self.disconnect(user_id)


manager = ConnectionManager()


def _new_id() -> str:
    return str(uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_event_member(db: Session, user_id: str, event_id: str) -> None:
    """Fix #4: Проверяем, что пользователь является участником мероприятия."""
    stmt = select(EventMembership.id).where(
        and_(EventMembership.user_id == user_id, EventMembership.event_id == event_id)
    )
    if db.execute(stmt).scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Нет доступа к мероприятию")


async def _notify_task_done(task: Task, db: Session) -> None:
    """
    Отправка WS-уведомлений о выполненной задаче владельцу мероприятия и кураторам.
    """
    event = db.get(Event, task.event_id)
    if not event:
        return

    payload = {
        "type": "task_done",
        "task_id": task.id,
        "task_title": task.title,
        "event_id": task.event_id,
    }

    # Владелец мероприятия
    await manager.send_to_user(event.owner_id, payload)

    # Кураторы мероприятия
    stmt = select(EventMembership.user_id).where(
        and_(
            EventMembership.event_id == task.event_id,
            EventMembership.context_role == "CURATOR",
        )
    )
    curator_ids = list(db.execute(stmt).scalars().all())
    for curator_id in curator_ids:
        await manager.send_to_user(curator_id, payload)


# Fix #2: create_task теперь использует JWT
@router.get("/tasks/", response_model=list[TaskOut])
def list_tasks(
    event_id: str = Query(..., description="ID мероприятия"),
    status: Optional[str] = Query(default=None, description="Фильтр по статусу задачи"),
    assigned_to: Optional[str] = Query(default=None, description="Фильтр по исполнителю"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskOut]:
    """
    Получить список задач по мероприятию с необязательными фильтрами по статусу и исполнителю.
    """
    # Fix #4: проверка членства
    _ensure_event_member(db, current_user.id, event_id)

    stmt = select(Task).where(Task.event_id == event_id)

    if status is not None:
        stmt = stmt.where(Task.status == status)

    if assigned_to is not None:
        stmt = stmt.where(Task.assigned_to == assigned_to)

    tasks = list(db.execute(stmt).scalars().all())
    return [TaskOut.model_validate(t, from_attributes=True) for t in tasks]


# Fix #2: JWT вместо query-параметра created_by
@router.post("/tasks/", response_model=TaskOut, status_code=201)
def create_task(
    body: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    """
    Создать новую задачу для мероприятия.
    """
    # Fix #4: проверка членства
    _ensure_event_member(db, current_user.id, body.event_id)

    task = Task(
        id=_new_id(),
        event_id=body.event_id,
        title=body.title,
        assigned_to=body.assigned_to,
        created_by=current_user.id,
        status="TODO",
        due_date=body.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task, from_attributes=True)


# Fix #4: проверка прав при обновлении статуса
@router.patch("/tasks/{task_id}/status", response_model=TaskOut)
async def update_task_status(
    task_id: str,
    body: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    """
    Обновить статус задачи.
    Допустимые значения: `TODO`, `IN_PROGRESS`, `DONE`.
    При переходе в `DONE` отправляются WS-уведомления.
    """
    allowed_statuses = {"TODO", "IN_PROGRESS", "DONE"}
    if body.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Недопустимый статус задачи")

    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    # Fix #4: проверка членства
    _ensure_event_member(db, current_user.id, task.event_id)

    task.status = body.status
    db.add(task)
    db.commit()
    db.refresh(task)

    if task.status == "DONE":
        await _notify_task_done(task, db)

    return TaskOut.model_validate(task, from_attributes=True)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Удалить задачу. Доступно участникам мероприятия."""
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    _ensure_event_member(db, current_user.id, task.event_id)

    db.delete(task)
    db.commit()
    return None


class TaskAssignIn(BaseModel):
    assigned_to: str


@router.patch("/tasks/{task_id}/assign", response_model=TaskOut)
def assign_task(
    task_id: str,
    body: TaskAssignIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskOut:
    """Назначить ответственного на задачу (владелец мероприятия или куратор)."""
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    event = db.get(Event, task.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")

    is_owner = event.owner_id == current_user.id
    is_curator = db.execute(
        select(EventMembership.id).where(
            EventMembership.event_id == task.event_id,
            EventMembership.user_id == current_user.id,
            EventMembership.context_role == "CURATOR",
        )
    ).first() is not None

    if not is_owner and not is_curator:
        raise HTTPException(status_code=403, detail="Нет прав для назначения ответственного")

    target = db.get(User, body.assigned_to)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    task.assigned_to = body.assigned_to
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task, from_attributes=True)


@router.get("/events/{event_id}/progress", response_model=ProgressOut)
def event_progress(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressOut:
    """
    Получить процент выполнения задач по мероприятию.
    """
    # Fix #4: проверка членства
    _ensure_event_member(db, current_user.id, event_id)

    total_stmt = select(func.count(Task.id)).where(Task.event_id == event_id)
    done_stmt = select(func.count(Task.id)).where(
        and_(Task.event_id == event_id, Task.status == "DONE")
    )

    total = int(db.execute(total_stmt).scalar_one() or 0)
    done = int(db.execute(done_stmt).scalar_one() or 0)

    progress = int(done / total * 100) if total > 0 else 0

    return ProgressOut(event_id=event_id, total=total, done=done, progress=progress)


# Fix #21: calendar теперь возвращает только мероприятия/задачи текущего пользователя
@router.get("/events/calendar", response_model=list[CalendarEvent])
def events_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CalendarEvent]:
    """
    Объединённый календарь мероприятий и задач текущего пользователя.
    """
    items: list[CalendarEvent] = []

    # Мероприятия, в которых пользователь состоит
    membership_event_ids = select(EventMembership.event_id).where(
        EventMembership.user_id == current_user.id
    )
    events = list(
        db.execute(
            select(Event).where(
                or_(
                    Event.owner_id == current_user.id,
                    Event.id.in_(membership_event_ids),
                )
            ).distinct()
        ).scalars().all()
    )
    for ev in events:
        if ev.start_date is None:
            continue
        start_str = ev.start_date.isoformat()
        end_date = ev.end_date or ev.start_date
        end_str = end_date.isoformat() if end_date else None
        items.append(
            CalendarEvent(
                id=ev.id,
                title=ev.title,
                start=start_str,
                end=end_str,
                type="event",
                color="#3B82F6",
            )
        )

    # Задачи текущего пользователя с дедлайнами
    tasks_with_due = list(
        db.execute(
            select(Task).where(
                and_(
                    Task.due_date.is_not(None),
                    or_(
                        Task.assigned_to == current_user.id,
                        Task.created_by == current_user.id,
                    ),
                )
            )
        ).scalars().all()
    )
    for task in tasks_with_due:
        if task.due_date is None:
            continue
        date_str = task.due_date.isoformat()
        items.append(
            CalendarEvent(
                id=task.id,
                title=task.title,
                start=date_str,
                end=date_str,
                type="task",
                color="#F59E0B",
            )
        )

    return items


# Fix #12: переименовано /sections/{id}/report → /sections/{id}/curator-report
@router.post(
    "/sections/{section_id}/curator-report",
    response_model=SectionReportOut,
    status_code=201,
)
def create_section_report(
    section_id: str,
    body: SectionReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SectionReportOut:
    """
    Создать отчёт куратора по секции.
    """
    section = db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Секция не найдена")

    report = SectionReport(
        id=_new_id(),
        section_id=section_id,
        author_id=current_user.id,
        text=body.text,
        created_at=_utcnow(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return SectionReportOut.model_validate(report, from_attributes=True)


@router.get("/sections/{section_id}/curator-report", response_model=SectionReportOut)
def get_section_report(
    section_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SectionReportOut:
    """
    Получить отчёт куратора по секции.
    """
    stmt = select(SectionReport).where(SectionReport.section_id == section_id)
    report = db.execute(stmt).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    return SectionReportOut.model_validate(report, from_attributes=True)


# Fix #3: WebSocket авторизация через JWT-токен (как в chat.py)
@router.websocket("/ws/tasks")
async def websocket_tasks(websocket: WebSocket, db: Session = Depends(get_db)) -> None:
    """
    WebSocket для уведомлений по задачам.
    Авторизация через query-параметр `token` (JWT).
    Пример: `ws://localhost:8000/api/ws/tasks?token=<jwt>`
    """
    from jose import jwt as jose_jwt

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Требуется query-параметр token")
        return

    try:
        secret_key, algorithm = _get_jwt_settings()
        payload = jose_jwt.decode(token, secret_key, algorithms=[algorithm])
    except (JWTError, Exception):
        await websocket.close(code=1008, reason="Недействительный токен")
        return

    user_id = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        await websocket.close(code=1008, reason="Недействительный токен: отсутствует sub")
        return

    user = db.get(User, user_id)
    if not user:
        await websocket.close(code=1008, reason="Пользователь не найден")
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(user_id)
    except Exception:
        await manager.disconnect(user_id)
        try:
            await websocket.close(code=1011, reason="Внутренняя ошибка сервера")
        except Exception:
            pass
