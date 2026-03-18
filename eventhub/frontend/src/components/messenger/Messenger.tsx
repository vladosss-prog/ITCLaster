import React, { useEffect, useMemo, useRef, useState } from "react";
import { chatAPI, createChatSocket, usersAPI, eventsAPI } from "../../api/apiClient";
import type { ChatMessage, ChatMessagesPage, ChatRoom, ChatSocketEvent, User, EventData } from "../../api/apiClient";
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
  // B-7: бэкенд теперь возвращает display_name
  if (room.display_name) {
    return {
      ...room,
      title: room.display_name,
      subtitle: room.type === "GROUP" ? "Групповой чат" : "Личный чат",
    };
  }
  if (room.type === "GROUP") {
    return {
      ...room,
      title: room.event_id ? `Чат мероприятия` : "Групповой чат",
      subtitle: "Групповой чат",
    };
  }
  return { ...room, title: `Личный чат`, subtitle: "Direct" };
}

export function Messenger({ demoMode, myUserId }: { demoMode: boolean; myUserId?: string }) {
  const [rooms, setRooms] = useState<ChatRoomWithUi[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [eventNames, setEventNames] = useState<Record<string, string>>({});

  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState<string>("");

  // Новый чат
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await usersAPI.search(q);
      setSearchResults((res.data || []).filter(u => u.id !== myUserId));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const handleCreateDirectChat = async (userId: string) => {
    if (demoMode) { setShowNewChat(false); return; }
    try {
      const res = await chatAPI.createDirect({ user_id: userId });
      const newRoom = roomTitle(res.data);
      setRooms(prev => {
        if (prev.find(r => r.id === newRoom.id)) return prev;
        return [...prev, newRoom];
      });
      setActiveRoomId(newRoom.id);
      setShowNewChat(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Не удалось создать чат");
    }
  };

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
      .then(async (res) => {
        const rawRooms = res.data || [];
        const list = rawRooms.map(room => roomTitle(room));
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

    // WS подключение: history приходит автоматически при connect
    const ws = createChatSocket(activeRoomId, (ev: ChatSocketEvent) => {
      if (ev.type === "history") {
        setMessages(ev.items || []);
        setLoadingMessages(false);
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
        setLoadingMessages(false);
      }
    });
    wsRef.current = ws;

    // Fallback: если WS не отправит history за 3 сек — загружаем через REST
    const fallbackTimer = setTimeout(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        chatAPI
          .getMessages(activeRoomId, { limit: 50, offset: 0 })
          .then((res) => {
            setMessages((res.data as ChatMessagesPage).items || []);
            setTimeout(scrollToBottom, 0);
          })
          .catch((e) => setMessagesError(e?.response?.data?.detail || e?.message || "Не удалось загрузить сообщения"))
          .finally(() => setLoadingMessages(false));
      }
    }, 3000);

    return () => {
      clearTimeout(fallbackTimer);
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
              onClick={() => setShowNewChat(true)}
            >
              + Новый
            </button>
          </div>

          {/* Диалог создания нового чата */}
          {showNewChat && (
            <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
              <input
                type="text"
                placeholder="Поиск пользователя..."
                value={searchQuery}
                onChange={e => handleSearchUsers(e.target.value)}
                autoFocus
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #dbe7ff", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
              />
              {searching && <div style={{ fontSize: 12, color: "#777" }}>Поиск...</div>}
              {searchResults.map(u => (
                <div key={u.id} onClick={() => handleCreateDirectChat(u.id)}
                  style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
                  onMouseOver={e => (e.currentTarget.style.background = "#eef6ff")}
                  onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>
                    {u.full_name[0]}
                  </div>
                  {u.full_name}
                </div>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                <div style={{ fontSize: 12, color: "#999" }}>Никого не найдено</div>
              )}
              <button onClick={() => { setShowNewChat(false); setSearchQuery(""); setSearchResults([]); }}
                style={{ marginTop: 4, width: "100%", padding: 6, background: "#f1f5f9", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                Отмена
              </button>
            </div>
          )}

          {loadingRooms ? (
            <Spinner  label="Загрузка чатов..." />
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

