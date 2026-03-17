from fastapi import APIRouter

router = APIRouter()

# TODO: Бек 6 — мессенджер, WebSocket, групповые и личные чаты
# GET    /api/chat/my
# POST   /api/chat/direct
# GET    /api/chat/{room_id}/messages
# WS     /ws/chat/{room_id}


@router.get("/ping")
def ping():
    return {"router": "chat", "status": "todo"}

