from __future__ import annotations

import os
from datetime import datetime
from typing import Dict, List, Optional, Set
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, distinct, func, or_, select
from sqlalchemy.orm import Session

from database import get_db
from models import ChatMessage, ChatRoom, EventMembership, User
from routers.auth import get_current_user, _get_jwt_settings

router = APIRouter()


def _now() -> datetime:
    return datetime.utcnow()


def _new_id() -> str:
    return str(uuid4())


class DirectChatCreateIn(BaseModel):
    user_id: str = Field(..., min_length=1)


class MessageCreateIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    global_role: str


class ChatRoomOut(BaseModel):
    id: str
    event_id: Optional[str] = None
    type: str


class ChatMessageOut(BaseModel):
    id: str
    room_id: str
    user_id: str
    text: str
    created_at: datetime


class ChatMessagesPageOut(BaseModel):
    items: List[ChatMessageOut]
    offset: int
    limit: int


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket, db: Session) -> None:
        await websocket.accept()
        self.active_connections.setdefault(room_id, []).append(websocket)

        # При подключении — отправляем последние 20 сообщений
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.room_id == room_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(20)
        )
        last_messages = list(db.execute(stmt).scalars().all())
        last_messages.reverse()
        await websocket.send_json(
            {
                "type": "history",
                "items": [ChatMessageOut.model_validate(m, from_attributes=True).model_dump() for m in last_messages],
            }
        )

    def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        conns = self.active_connections.get(room_id)
        if not conns:
            return
        try:
            conns.remove(websocket)
        except ValueError:
            return
        if not conns:
            self.active_connections.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict) -> None:
        conns = list(self.active_connections.get(room_id, []))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(room_id, ws)


manager = ConnectionManager()


def add_user_to_event_chat(event_id: str, db: Session) -> ChatRoom:
    stmt = select(ChatRoom).where(and_(ChatRoom.event_id == event_id, ChatRoom.type == "GROUP"))
    room = db.execute(stmt).scalar_one_or_none()
    if room:
        return room

    room = ChatRoom(id=_new_id(), event_id=event_id, type="GROUP")
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def _user_event_ids(db: Session, user_id: str) -> Set[str]:
    stmt = select(EventMembership.event_id).where(EventMembership.user_id == user_id)
    return set(db.execute(stmt).scalars().all())


def _ensure_room_access(db: Session, room: ChatRoom, user_id: str) -> None:
    # GROUP: доступ по membership к event_id
    if room.type == "GROUP":
        if not room.event_id:
            raise HTTPException(status_code=400, detail="Некорректная комната: у GROUP-чата отсутствует event_id")
        stmt = select(EventMembership.id).where(
            and_(EventMembership.user_id == user_id, EventMembership.event_id == room.event_id)
        )
        if db.execute(stmt).scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Нет доступа к чату мероприятия")
        return

    # DIRECT: доступ, если пользователь уже писал в этой комнате
    stmt = select(ChatMessage.id).where(and_(ChatMessage.room_id == room.id, ChatMessage.user_id == user_id)).limit(1)
    if db.execute(stmt).scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Нет доступа к личному чату")


@router.get("/my", response_model=List[ChatRoomOut])
def my_rooms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> List[ChatRoomOut]:
    # Комнаты, где пользователь писал сообщения
    rooms_by_messages = (
        select(ChatRoom)
        .join(ChatMessage, ChatMessage.room_id == ChatRoom.id)
        .where(ChatMessage.user_id == current_user.id)
        .distinct()
    )

    # GROUP-комнаты мероприятий, где пользователь состоит
    event_ids = _user_event_ids(db, current_user.id)
    if event_ids:
        rooms_by_membership = select(ChatRoom).where(
            and_(ChatRoom.type == "GROUP", ChatRoom.event_id.in_(event_ids))  # type: ignore[arg-type]
        )
        stmt = select(ChatRoom).from_statement(rooms_by_messages.union(rooms_by_membership))
    else:
        stmt = rooms_by_messages

    rooms = list(db.execute(stmt).scalars().all())
    return [ChatRoomOut.model_validate(r, from_attributes=True) for r in rooms]


@router.post("/direct", response_model=ChatRoomOut)
def create_direct_chat(
    body: DirectChatCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatRoomOut:
    if body.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя создать личный чат с самим собой")

    other = db.get(User, body.user_id)
    if not other:
        raise HTTPException(status_code=404, detail="Пользователь для личного чата не найден")

    # Пытаемся найти существующий DIRECT-чат, где писали только эти 2 пользователя
    u1, u2 = current_user.id, other.id
    distinct_users_total = func.count(distinct(ChatMessage.user_id))
    distinct_users_in_pair = func.count(distinct(case((ChatMessage.user_id.in_([u1, u2]), ChatMessage.user_id))))

    subq = (
        select(ChatMessage.room_id)
        .join(ChatRoom, ChatRoom.id == ChatMessage.room_id)
        .where(and_(ChatRoom.type == "DIRECT", ChatRoom.event_id.is_(None)))
        .group_by(ChatMessage.room_id)
        .having(and_(distinct_users_total == 2, distinct_users_in_pair == 2))
        .subquery()
    )
    existing = db.execute(select(ChatRoom).where(ChatRoom.id.in_(select(subq.c.room_id)))).scalar_one_or_none()
    if existing:
        return ChatRoomOut.model_validate(existing, from_attributes=True)

    room = ChatRoom(id=_new_id(), event_id=None, type="DIRECT")
    db.add(room)
    db.commit()
    db.refresh(room)

    # Чтобы у создателя был доступ (в модели нет участников комнаты) — создаём первое сообщение
    msg = ChatMessage(id=_new_id(), room_id=room.id, user_id=current_user.id, text="Начат личный чат", created_at=_now())
    db.add(msg)
    db.commit()

    return ChatRoomOut.model_validate(room, from_attributes=True)


@router.get("/{room_id}/messages", response_model=ChatMessagesPageOut)
def get_room_messages(
    room_id: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMessagesPageOut:
    room = db.get(ChatRoom, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Комната чата не найдена")

    _ensure_room_access(db=db, room=room, user_id=current_user.id)

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    items = list(db.execute(stmt).scalars().all())
    return ChatMessagesPageOut(
        items=[ChatMessageOut.model_validate(m, from_attributes=True) for m in items],
        offset=offset,
        limit=limit,
    )


@router.post("/{room_id}/messages", response_model=ChatMessageOut)
def post_message(
    room_id: str,
    body: MessageCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMessageOut:
    room = db.get(ChatRoom, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Комната чата не найдена")

    _ensure_room_access(db=db, room=room, user_id=current_user.id)

    msg = ChatMessage(id=_new_id(), room_id=room_id, user_id=current_user.id, text=body.text, created_at=_now())
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return ChatMessageOut.model_validate(msg, from_attributes=True)


def _ws_user_from_token(db: Session, token: Optional[str]) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Для WebSocket нужен query-параметр token")

    secret_key, algorithm = _get_jwt_settings()
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Недействительный токен")

    user_id = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail='Недействительный токен: отсутствует поле "sub"')

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


@router.websocket("/ws/{room_id}")
async def websocket_chat(room_id: str, websocket: WebSocket, db: Session = Depends(get_db)):
    token = websocket.query_params.get("token")
    try:
        user = _ws_user_from_token(db=db, token=token)
    except HTTPException as e:
        await websocket.close(code=1008, reason=str(e.detail))
        return

    room = db.get(ChatRoom, room_id)
    if not room:
        await websocket.close(code=1008, reason="Комната чата не найдена")
        return

    try:
        _ensure_room_access(db=db, room=room, user_id=user.id)
    except HTTPException as e:
        await websocket.close(code=1008, reason=str(e.detail))
        return

    await manager.connect(room_id=room_id, websocket=websocket, db=db)

    try:
        while True:
            data = await websocket.receive_json()
            text = (data or {}).get("text")
            if not isinstance(text, str) or not text.strip():
                await websocket.send_json({"type": "error", "detail": "Сообщение должно содержать непустое поле text"})
                continue

            msg = ChatMessage(id=_new_id(), room_id=room_id, user_id=user.id, text=text.strip(), created_at=_now())
            db.add(msg)
            db.commit()
            db.refresh(msg)

            out = ChatMessageOut.model_validate(msg, from_attributes=True).model_dump()
            await manager.broadcast(room_id=room_id, message={"type": "message", "item": out})
    except WebSocketDisconnect:
        manager.disconnect(room_id=room_id, websocket=websocket)
    except Exception:
        manager.disconnect(room_id=room_id, websocket=websocket)
        try:
            await websocket.close(code=1011, reason="Внутренняя ошибка сервера")
        except Exception:
            pass


