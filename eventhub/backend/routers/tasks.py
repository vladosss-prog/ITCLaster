from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from database import get_db
from models import Event, EventMembership, Section, SectionReport, Task, User
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
    Ключ - user_id, значение - активное WebSocket-соединение.
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
            # Если отправка не удалась — отключаем пользователя молча
            await self.disconnect(user_id)


manager = ConnectionManager()


def _new_id() -> str:
    return str(uuid4())


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


@router.get("/tasks/", response_model=list[TaskOut])
def list_tasks(
    event_id: str = Query(..., description="ID мероприятия"),
    status: Optional[str] = Query(default=None, description="Фильтр по статусу задачи"),
    assigned_to: Optional[str] = Query(default=None, description="Фильтр по исполнителю"),
    db: Session = Depends(get_db),
) -> list[TaskOut]:
    """
    Получить список задач по мероприятию с необязательными фильтрами по статусу и исполнителю.
    """

    stmt = select(Task).where(Task.event_id == event_id)

    if status is not None:
        stmt = stmt.where(Task.status == status)

    if assigned_to is not None:
        stmt = stmt.where(Task.assigned_to == assigned_to)

    tasks = list(db.execute(stmt).scalars().all())
    return [TaskOut.model_validate(t, from_attributes=True) for t in tasks]


@router.post("/tasks/", response_model=TaskOut, status_code=201)
def create_task(
    body: TaskCreate,
    created_by: str = Query(..., description="ID пользователя, создавшего задачу (временно, без JWT)"),
    db: Session = Depends(get_db),
) -> TaskOut:
    """
    Создать новую задачу для мероприятия.

    Временно идентификатор создателя (`created_by`) передаётся как query-параметр.
    """

    task = Task(
        id=_new_id(),
        event_id=body.event_id,
        title=body.title,
        assigned_to=body.assigned_to,
        created_by=created_by,
        status="TODO",
        due_date=body.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task, from_attributes=True)


@router.patch("/tasks/{task_id}/status", response_model=TaskOut)
async def update_task_status(
    task_id: str,
    body: TaskStatusUpdate,
    db: Session = Depends(get_db),
) -> TaskOut:
    """
    Обновить статус задачи.

    Допустимые значения статуса: `TODO`, `IN_PROGRESS`, `DONE`.
    При переходе в статус `DONE` отправляются WS-уведомления.
    """

    allowed_statuses = {"TODO", "IN_PROGRESS", "DONE"}
    if body.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Недопустимый статус задачи")

    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    task.status = body.status
    db.add(task)
    db.commit()
    db.refresh(task)

    if task.status == "DONE":
        await _notify_task_done(task, db)

    return TaskOut.model_validate(task, from_attributes=True)


@router.get("/events/{event_id}/progress", response_model=ProgressOut)
def event_progress(event_id: str, db: Session = Depends(get_db)) -> ProgressOut:
    """
    Получить процент выполнения задач по мероприятию.
    """

    total_stmt = select(func.count(Task.id)).where(Task.event_id == event_id)
    done_stmt = select(func.count(Task.id)).where(
        and_(Task.event_id == event_id, Task.status == "DONE")
    )

    total = int(db.execute(total_stmt).scalar_one() or 0)
    done = int(db.execute(done_stmt).scalar_one() or 0)

    progress = int(done / total * 100) if total > 0 else 0

    return ProgressOut(event_id=event_id, total=total, done=done, progress=progress)


@router.get("/events/calendar", response_model=list[CalendarEvent])
def events_calendar(db: Session = Depends(get_db)) -> list[CalendarEvent]:
    """
    Получить объединённый календарь мероприятий и задач для использования во фронтенде (FullCalendar).
    """

    items: list[CalendarEvent] = []

    # Мероприятия
    events = list(db.execute(select(Event)).scalars().all())
    for ev in events:
        if ev.start_date is None:
            # Без даты в календарь не попадаем
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

    # Задачи с дедлайнами
    tasks_with_due = list(
        db.execute(select(Task).where(Task.due_date.is_not(None))).scalars().all()
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


@router.post(
    "/sections/{section_id}/report",
    response_model=SectionReportOut,
    status_code=201,
)
def create_section_report(
    section_id: str,
    body: SectionReportCreate,
    author_id: str = Query(..., description="ID автора отчёта (временно, без JWT)"),
    db: Session = Depends(get_db),
) -> SectionReportOut:
    """
    Создать отчёт куратора по секции.

    Временно идентификатор автора (`author_id`) передаётся как query-параметр.
    """

    section = db.get(Section, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Секция не найдена")

    report = SectionReport(
        id=_new_id(),
        section_id=section_id,
        author_id=author_id,
        text=body.text,
        created_at=datetime.utcnow(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return SectionReportOut.model_validate(report, from_attributes=True)


@router.get("/sections/{section_id}/report", response_model=SectionReportOut)
def get_section_report(section_id: str, db: Session = Depends(get_db)) -> SectionReportOut:
    """
    Получить отчёт куратора по секции.
    """

    stmt = select(SectionReport).where(SectionReport.section_id == section_id)
    report = db.execute(stmt).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Отчёт не найден")

    return SectionReportOut.model_validate(report, from_attributes=True)


@router.websocket("/ws/tasks")
async def websocket_tasks(websocket: WebSocket, db: Session = Depends(get_db)) -> None:
    """
    WebSocket-подключение для получения уведомлений по задачам.

    Временно авторизация осуществляется через query-параметр `user_id`.
    Пример: `ws://localhost:8000/api/ws/tasks?user_id=...`.
    """

    user_id = websocket.query_params.get("user_id")
    if not user_id or not isinstance(user_id, str):
        await websocket.close(code=1008, reason="Требуется query-параметр user_id")
        return

    # Опциональная валидация существования пользователя
    user = db.get(User, user_id)
    if not user:
        await websocket.close(code=1008, reason="Пользователь не найден")
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            # Держим соединение открытым, читаем любые входящие сообщения
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(user_id)
    except Exception:
        await manager.disconnect(user_id)
        try:
            await websocket.close(code=1011, reason="Внутренняя ошибка сервера")
        except Exception:
            pass

