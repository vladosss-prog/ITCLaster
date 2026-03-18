import React, { useEffect, useMemo, useRef, useState } from "react";
import { chatAPI, createChatSocket } from "../../api/apiClient";
import type { ChatMessage, ChatMessagesPage, ChatRoom, ChatSocketEvent } from "../../api/apiClient";
import { ErrorBlock } from "../ui/ErrorBlock";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";

type ChatRoomWithUi = ChatRoom & { title: string; subtitle?: string };

const DEMO_ROOMS: ChatRoomWithUi[] = [
  { id: "room1", type: "GROUP", event_id: "e2", title: "EventHub — общий чат", subtitle: "Хакатон: обсуждение" },
  { id: "room2", type: "DIRECT", title: "Иван Участников", subtitle: "Начат личный чат" },
];

const DEMO_MESSAGES: Record<string, ChatMessage[]> = {
  room1: [
    { id: "m1", room_id: "room1", user_id: "u1", text: "Всем привет! Стартуем по задачам.", created_at: new Date().toISOString() },
    { id: "m2", room_id: "room1", user_id: "u2", text: "Ок, беру фронт по расписанию/чатам.", created_at: new Date().toISOString() },
  ],
  room2: [{ id: "m3", room_id: "room2", user_id: "u2", text: "Привет! Давай созвон?", created_at: new Date().toISOString() }],
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function roomTitle(room: ChatRoom): ChatRoomWithUi {
  if (room.type === "GROUP") {
    return {
      ...room,
      title: room.event_id ? `Чат мероприятия ${room.event_id}` : "Чат мероприятия",
      subtitle: "Групповой чат",
    };
  }
  return { ...room, title: `Личный чат ${room.id.slice(0, 6)}`, subtitle: "Direct" };
}

export function Messenger({ demoMode, myUserId }: { demoMode: boolean; myUserId?: string }) {
  const [rooms, setRooms] = useState<ChatRoomWithUi[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");

  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string>("");

  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId) || null, [rooms, activeRoomId]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const loadRooms = () => {
    setLoadingRooms(true);
    setRoomsError("");
    if (demoMode) {
      setRooms(DEMO_ROOMS);
      setActiveRoomId(DEMO_ROOMS[0]?.id || "");
      setLoadingRooms(false);
      return;
    }
    chatAPI
      .getMy()
      .then((res) => {
        const list = (res.data || []).map(roomTitle);
        setRooms(list);
        setActiveRoomId((prev) => prev || list[0]?.id || "");
      })
      .catch((e) => setRoomsError(e?.response?.data?.detail || e?.message || "Не удалось загрузить чаты"))
      .finally(() => setLoadingRooms(false));
  };

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  useEffect(() => {
    // cleanup previous ws
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    if (!activeRoomId) {
      setMessages([]);
      return;
    }

    setMessagesError("");
    setLoadingMessages(true);

    if (demoMode) {
      setMessages(DEMO_MESSAGES[activeRoomId] || []);
      setLoadingMessages(false);
      setTimeout(scrollToBottom, 0);
      return;
    }

    chatAPI
      .getMessages(activeRoomId, { limit: 50, offset: 0 })
      .then((res) => {
        const page = res.data as ChatMessagesPage;
        setMessages(page.items || []);
        setTimeout(scrollToBottom, 0);
      })
      .catch((e) => setMessagesError(e?.response?.data?.detail || e?.message || "Не удалось загрузить сообщения"))
      .finally(() => setLoadingMessages(false));

    // WS: history + message events
    const ws = createChatSocket(activeRoomId, (ev: ChatSocketEvent) => {
      if (ev.type === "history") {
        setMessages(ev.items || []);
        setTimeout(scrollToBottom, 0);
        return;
      }
      if (ev.type === "message") {
        setMessages((prev) => [...prev, ev.item]);
        setTimeout(scrollToBottom, 0);
        return;
      }
      if (ev.type === "error") {
        setMessagesError(ev.detail || "Ошибка WebSocket");
      }
    });
    wsRef.current = ws;

    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [activeRoomId, demoMode]);

  const send = () => {
    const msg = text.trim();
    if (!msg || !activeRoomId) return;

    if (demoMode) {
      const item: ChatMessage = {
        id: `demo-${Date.now()}`,
        room_id: activeRoomId,
        user_id: myUserId || "me",
        text: msg,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, item]);
      setText("");
      setTimeout(scrollToBottom, 0);
      return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setMessagesError("Соединение с чатом не установлено");
      return;
    }
    ws.send(JSON.stringify({ text: msg }));
    setText("");
  };

  return (
    <div>
      <h2 style={{ fontWeight: 800, marginBottom: 18 }}>Мессенджер</h2>
      <div className="messenger-wrapper">
        <aside className="messenger-sidebar">
          <div className="messenger-sidebar-header">
            <span>Чаты</span>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "6px 10px", fontSize: 12, fontWeight: 900 }}
              onClick={() => alert("Новый чат: появится после подключения users/auth роутеров")}
            >
              + Новый
            </button>
          </div>

          {loadingRooms ? (
            <Spinner size={28} label="Загрузка чатов..." />
          ) : roomsError ? (
            <div style={{ padding: 12 }}>
              <ErrorBlock message={roomsError} onRetry={loadRooms} />
            </div>
          ) : rooms.length === 0 ? (
            <div style={{ padding: 12 }}>
              <EmptyState icon="💬" title="Нет чатов" description="Создайте новый чат или вступите в мероприятие." />
            </div>
          ) : (
            <div style={{ overflowY: "auto" }}>
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className={`chat-item ${r.id === activeRoomId ? "active" : ""}`}
                  onClick={() => setActiveRoomId(r.id)}
                >
                  <div className="chat-avatar">{(r.title || "Ч")[0]?.toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="chat-name">{r.title}</div>
                    <div className="chat-preview">{r.subtitle || " "}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="messenger-main">
          <div className="messenger-header">{activeRoom ? activeRoom.title : "Выберите чат"}</div>

          {loadingMessages ? (
            <Spinner label="Загрузка сообщений..." />
          ) : messagesError ? (
            <div style={{ padding: 12 }}>
              <ErrorBlock message={messagesError} onRetry={() => setActiveRoomId((x) => x)} />
            </div>
          ) : !activeRoomId ? (
            <div style={{ padding: 12 }}>
              <EmptyState icon="💬" title="Чат не выбран" description="Выберите чат слева." />
            </div>
          ) : (
            <div className="messages-list" ref={listRef}>
              {messages.map((m) => {
                const own = myUserId ? m.user_id === myUserId : false;
                return (
                  <div key={m.id} className={`message-bubble ${own ? "own" : "other"}`}>
                    <div>{m.text}</div>
                    <div className="message-time">{formatTime(m.created_at)}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="messenger-input-area">
            <input
              className="messenger-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Сообщение…"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              disabled={!activeRoomId}
            />
            <button type="button" className="messenger-send-btn" onClick={send} disabled={!activeRoomId} aria-label="Отправить">
              ➤
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

