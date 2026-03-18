from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import tasks

app = FastAPI(
    title="EventHub API",
    version="1.0.0",
    description="Платформа управления мероприятиями — ИТ-Кластер Сибири",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роутеры подключаются сюда по мере готовности каждого разработчика:
from routers import tasks, participants, chat
# app.include_router(auth.router,         prefix="/api/auth",         tags=["Auth"])
# app.include_router(events.router,       prefix="/api/events",       tags=["Events"])
app.include_router(tasks.router,        prefix="/api",        tags=["Tasks"])
app.include_router(participants.router, prefix="/api/participants",  tags=["Participants"])
app.include_router(chat.router,         prefix="/api/chat",         tags=["Chat"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "EventHub API работает", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}

