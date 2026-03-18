import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import type {
  User,
  Task,
  TaskStatus,
  Event as EventData,
  GlobalRole,
  ChatRoom,
  ChatMessage,
  ChatSocketEvent,
} from "./api/apiClient";

import {
  authAPI,
  eventsAPI,
  tasksAPI,
  participantsAPI,
  chatAPI,
  createChatSocket,
  usersAPI,
} from "./api/apiClient";

// CuratorDashboard moved into unified ParticipantDashboard
import { CreateEventPage } from "./pages/CreateEventPage";
import { ReportPage } from "./pages/ReportPage";
import { EventManagePage } from "./pages/EventManagePage";

// ═══════════════════════════════════════════════════════════════
// DIRECT FETCH HELPERS — вызовы к реальному бэкенду
// ═══════════════════════════════════════════════════════════════
const API_BASE = "http://localhost:8000";
function _authHeaders(): Record<string, string> {
  const t = localStorage.getItem("access_token");
  return t ? { Authorization: "Bearer " + t, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
async function apiFetch<T = any>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(API_BASE + path, { method, headers: _authHeaders(), body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return undefined as any;
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || res.status + ""); }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL CSS
// ═══════════════════════════════════════════════════════════════
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

:root {
  --primary: #2563eb;
  --primary-dark: #0d1b3e;
  --primary-light: #3b82f6;
  --accent: #f59e0b;
  --bg-light: #f1f5f9;
  --bg-medium: #e8f0fe;
  --border: #e2e8f0;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --success: #16a34a;
  --danger: #ef4444;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Nunito', sans-serif;
  background: var(--bg-light);
  color: var(--text-main);
  min-height: 100vh;
}

a { text-decoration: none; color: inherit; }

.dashboard-wrapper { display: flex; min-height: calc(100vh - 58px); }

.dashboard-sidebar {
  width: 260px; background: white; border-right: 1.5px solid var(--border);
  padding: 20px 20px; display: flex; flex-direction: column; gap: 20px;
  position: sticky; top: 58px; height: calc(100vh - 58px); overflow-y: auto;
}

.dashboard-main-content {
  flex: 1; padding: 32px 36px; overflow-y: auto; min-height: calc(100vh - 58px);
}

.sidebar-nav-list { display: flex; flex-direction: column; gap: 4px; }

.nav-link {
  display: flex; align-items: center; padding: 10px 14px; border-radius: 10px;
  font-weight: 700; font-size: 14px; cursor: pointer;
  transition: background 0.15s, color 0.15s;
  font-family: 'Nunito', sans-serif; border: none; text-align: left; width: 100%;
}
.nav-link:hover { background: #eef6ff !important; }

.auth-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #0d1b3e 0%, #1e3a8a 50%, #2563eb 100%);
  padding: 20px;
}
.auth-card {
  background: white; border-radius: 24px; padding: 40px 36px;
  width: 100%; max-width: 420px; box-shadow: 0 25px 80px rgba(0,0,0,0.25);
}
.auth-input {
  width: 100%; padding: 12px 16px; border-radius: 10px;
  border: 1.5px solid var(--border); font-size: 14px;
  font-family: 'Nunito', sans-serif; outline: none;
  transition: border-color 0.2s; box-sizing: border-box;
}
.auth-input:focus { border-color: var(--primary); }
.auth-btn {
  width: 100%; padding: 13px; background: var(--primary); color: white;
  border: none; border-radius: 100px; font-weight: 800; font-size: 15px;
  cursor: pointer; font-family: 'Nunito', sans-serif; transition: opacity 0.15s;
}
.auth-btn:hover { opacity: 0.9; }
.auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kanban-col { background: var(--bg-light); border-radius: 14px; padding: 16px; min-height: 220px; }
.kanban-card {
  background: white; border-radius: 12px; padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(74,89,138,0.06); border: 1.5px solid var(--border);
  margin-bottom: 10px; transition: box-shadow 0.15s, transform 0.1s;
}
.kanban-card:hover { box-shadow: 0 4px 16px rgba(74,89,138,0.12); transform: translateY(-1px); }

.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-cell {
  min-height: 90px; background: white; border-radius: 8px; padding: 6px 8px;
  border: 1.5px solid var(--border); transition: border-color 0.15s; position: relative;
}
.cal-cell:hover { border-color: var(--primary-light); }
.cal-cell.today { border-color: var(--primary); background: #eef6ff; }
.cal-cell.other-month { background: #f8fafc; opacity: 0.5; }
.cal-day-num { font-size: 12px; font-weight: 800; color: var(--text-muted); margin-bottom: 4px; }
.cal-cell.today .cal-day-num { color: var(--primary); }
.cal-dot {
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cal-nav-btn {
  padding: 8px 18px; background: white; border: 1.5px solid var(--border);
  border-radius: 8px; font-weight: 800; cursor: pointer;
  font-family: 'Nunito', sans-serif; font-size: 14px; color: var(--primary-dark);
  transition: background 0.15s, border-color 0.15s;
}
.cal-nav-btn:hover { background: var(--bg-medium); border-color: var(--primary); }

.chat-wrapper { display: flex; height: calc(100vh - 100px); border-radius: 16px; overflow: hidden; border: 1.5px solid var(--border); background: white; }
.chat-rooms-list { width: 280px; border-right: 1.5px solid var(--border); display: flex; flex-direction: column; background: #fafbfc; }
.chat-rooms-header { padding: 16px 18px; border-bottom: 1.5px solid var(--border); font-weight: 800; font-size: 15px; color: var(--primary-dark); display: flex; justify-content: space-between; align-items: center; }
.chat-room-item { padding: 12px 18px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.12s; display: flex; align-items: center; gap: 10px; }
.chat-room-item:hover { background: #eef6ff; }
.chat-room-item.active { background: #e8f0fe; border-left: 3px solid var(--primary); }
.chat-messages-area { flex: 1; display: flex; flex-direction: column; }
.chat-messages-header { padding: 14px 20px; border-bottom: 1.5px solid var(--border); font-weight: 800; font-size: 14px; color: var(--primary-dark); background: white; }
.chat-messages-scroll { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
.chat-msg { max-width: 70%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; word-wrap: break-word; }
.chat-msg.mine { align-self: flex-end; background: var(--primary); color: white; border-bottom-right-radius: 4px; }
.chat-msg.theirs { align-self: flex-start; background: #f1f5f9; color: var(--text-main); border-bottom-left-radius: 4px; }
.chat-input-bar { padding: 12px 16px; border-top: 1.5px solid var(--border); display: flex; gap: 10px; background: white; }
.chat-input-bar input { flex: 1; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--border); font-size: 13px; font-family: 'Nunito', sans-serif; outline: none; }
.chat-input-bar input:focus { border-color: var(--primary); }
.chat-input-bar button { padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; font-family: 'Nunito', sans-serif; white-space: nowrap; }
.chat-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-weight: 600; font-size: 14px; }
@media (max-width: 900px) { .chat-rooms-list { width: 200px; } .chat-msg { max-width: 85%; } }

.landing-hero {
  min-height: 100vh; display: flex; flex-direction: column;
  background: linear-gradient(180deg, #e8f4fc 0%, #d4ecfb 40%, #c3e4f8 100%);
  color: var(--text-main); position: relative; overflow: hidden;
}
.landing-hero::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 85% 30%, rgba(59,130,246,0.12) 0%, transparent 55%),
              radial-gradient(circle at 15% 70%, rgba(59,130,246,0.08) 0%, transparent 50%);
  pointer-events: none;
}
.landing-topbar {
  position: sticky; top: 0; z-index: 100; padding: 16px 48px;
  display: flex; justify-content: center;
  background: rgba(255,255,255,0.65); backdrop-filter: blur(16px);
}
.landing-topbar.on-landing {
  background: transparent; backdrop-filter: none;
}
.landing-topbar.on-dashboard {
  background: rgba(255,255,255,0.85); backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border); padding: 10px 48px;
}
.landing-nav-pill {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(16px);
  border: 1.5px solid rgba(255,255,255,0.7); border-radius: 100px;
  padding: 10px 28px; width: 100%; max-width: 900px;
  box-shadow: 0 2px 20px rgba(0,0,0,0.06);
}
.landing-nav-links {
  display: flex; gap: 28px; align-items: center;
}
.landing-nav-links a {
  font-size: 13px; font-weight: 700; color: var(--text-main);
  text-decoration: none; letter-spacing: 0.3px; transition: color 0.2s;
  cursor: pointer; white-space: nowrap;
}
.landing-nav-links a:hover { color: var(--primary); }
.landing-nav-logo {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.landing-nav-logo-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--primary); color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 16px;
}
.landing-nav-logo-text {
  font-weight: 900; font-size: 14px; color: var(--primary-dark);
  line-height: 1.15; white-space: nowrap;
}
.landing-nav-user {
  width: 38px; height: 38px; border-radius: 50%;
  border: 1.5px solid var(--border); background: white;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: border-color 0.2s; flex-shrink: 0;
}
.landing-nav-user:hover { border-color: var(--primary); }
.nav-user-info {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.nav-user-name {
  font-size: 13px; font-weight: 700; color: var(--primary-dark);
  max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.nav-user-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--primary); color: white; font-weight: 900; font-size: 13px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.nav-logout-btn {
  padding: 6px 14px; background: #fff1f1; color: #ef4444;
  border: 1px solid #fecaca; border-radius: 100;
  font-weight: 700; font-size: 11px; cursor: pointer;
  font-family: 'Nunito', sans-serif; white-space: nowrap;
  transition: background 0.15s;
}
.nav-logout-btn:hover { background: #fee2e2; }
.event-detail-page {
  max-width: 900px; margin: 0 auto; padding: 32px 24px;
}
.comment-card {
  background: white; border-radius: 12px; padding: 14px 18px;
  border: 1.5px solid var(--border); margin-bottom: 10px;
}
.landing-content {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 0 48px; position: relative; z-index: 2;
}
.landing-features { padding: 80px 48px; background: white; }
.feature-card {
  background: var(--bg-light); border-radius: 20px; padding: 32px 28px;
  border: 1.5px solid var(--border); transition: transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(74,89,138,0.1); }

@media (max-width: 900px) {
  .dashboard-wrapper { flex-direction: column; }
  .dashboard-sidebar {
    width: 100%; height: auto; position: relative;
    flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 16px;
  }
  .sidebar-nav-list { flex-direction: row; flex-wrap: wrap; gap: 6px; }
  .dashboard-main-content { padding: 20px 16px; }
  .kanban-board { grid-template-columns: 1fr; }
  .landing-topbar { padding: 12px 16px; }
  .landing-nav-pill { padding: 8px 16px; max-width: 100%; }
  .landing-nav-links { gap: 14px; }
  .landing-nav-links a { font-size: 11px; }
  .landing-content { padding: 0 20px; }
  .landing-features { padding: 40px 20px; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

function injectGlobalCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("eh-css")) return;
  const s = document.createElement("style");
  s.id = "eh-css";
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════
export function Spinner({ label = "Загрузка..." }: { label?: string }) {
  return (
    <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>
        ⏳
      </div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        background: "#fef2f2",
        border: "1.5px solid #fecaca",
        borderRadius: 14,
        padding: "20px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      <div
        style={{
          color: "#dc2626",
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 12,
        }}
      >
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "8px 20px",
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: 100,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "Nunito, sans-serif",
          }}
        >
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 20px",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 16,
          color: "var(--primary-dark)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14 }}>{description}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL TOP BAR — отображается на ВСЕХ страницах
// ═══════════════════════════════════════════════════════════════
function TopBar({ user, onLogout, variant = "default" }: { user: User | null; onLogout: () => void; variant?: "landing" | "default" }) {
  const navigate = useNavigate();
  return (
    <div className={`landing-topbar${variant === "landing" ? " on-landing" : " on-dashboard"}`}>
      <div className="landing-nav-pill">
        <div className="landing-nav-logo" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
          <div className="landing-nav-logo-icon">EH</div>
          <div className="landing-nav-logo-text">EVENT<br/>HUB</div>
        </div>
        <nav className="landing-nav-links">
          <a onClick={() => navigate("/")}>ГЛАВНАЯ</a>
          <a onClick={() => navigate("/events")}>МЕРОПРИЯТИЯ</a>
          {user && <a onClick={() => navigate("/dashboard")}>ЛИЧНЫЙ КАБИНЕТ</a>}
          <a onClick={() => navigate("/events")}>КОНТАКТЫ</a>
        </nav>
        {user ? (
          <div className="nav-user-info">
            <div className="nav-user-avatar">{user.full_name[0]}</div>
            <span className="nav-user-name">{user.full_name}</span>
            <button className="nav-logout-btn" onClick={onLogout}>Выйти</button>
          </div>
        ) : (
          <div className="landing-nav-user" onClick={() => navigate("/login")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EVENTS LIST PAGE — публичный список мероприятий (/events)
// ═══════════════════════════════════════════════════════════════
function EventsListPage({ user, onLogout, demoMode, sharedEvents }: { user: User | null; onLogout: () => void; demoMode: boolean; sharedEvents: EventData[] }) {
  const navigate = useNavigate();
  const events = sharedEvents.filter((e) => e.status === "PUBLISHED");

  return (
    <div>
      <TopBar user={user} onLogout={onLogout} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontWeight: 900, fontSize: 26, color: "var(--primary-dark)", marginBottom: 8 }}>Мероприятия</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 28 }}>Выберите мероприятие для просмотра программы и регистрации</p>
        <div style={{ display: "grid", gap: 16 }}>
            {events.map((ev) => (
              <div
                key={ev.id}
                onClick={() => navigate(`/events/${ev.id}`)}
                style={{
                  background: "white", borderRadius: 16, padding: "24px 28px",
                  boxShadow: "0 2px 12px rgba(74,89,138,0.07)",
                  border: "1.5px solid var(--border)", cursor: "pointer",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(37,99,235,0.12)"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(74,89,138,0.07)"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: 800, fontSize: 18, color: "var(--primary-dark)", marginBottom: 6 }}>{ev.title}</h3>
                    {ev.description && <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.6 }}>{ev.description}</p>}
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, flexWrap: "wrap", alignItems: "center" }}>
                      {ev.start_date && <span>📅 {ev.start_date} — {ev.end_date}</span>}
                      <span style={{ padding: "2px 10px", borderRadius: 100, background: "#f0fdf4", color: "#16a34a", fontWeight: 800 }}>Опубликовано</span>
                    </div>
                  </div>
                  <div style={{ color: "var(--primary)", fontWeight: 800, fontSize: 13, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    Подробнее →
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && <EmptyState icon="📋" title="Нет мероприятий" description="Скоро здесь появятся новые мероприятия." />}
          </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EVENT DETAIL PAGE — страница мероприятия (/events/:id)
// Секции, доклады, регистрация, комментарии
// ═══════════════════════════════════════════════════════════════
interface CommentItem {
  id: string;
  user_name: string;
  text: string;
  created_at: string;
  report_id: string;
}

const DEMO_COMMENTS: CommentItem[] = [
  { id: "c1", user_name: "Иван Участников", text: "Очень жду этот доклад! Тема безопасности сейчас максимально актуальна.", created_at: "2026-03-17T10:30:00Z", report_id: "r1" },
  { id: "c2", user_name: "Алексей Спикеров", text: "Будет ли запись трансляции?", created_at: "2026-03-17T14:00:00Z", report_id: "r1" },
  { id: "c3", user_name: "Куратор Секционов", text: "Да, все доклады будут записаны.", created_at: "2026-03-17T14:10:00Z", report_id: "r1" },
  { id: "c4", user_name: "Иван Участников", text: "Интересно услышать про реальные кейсы внедрения ML на производстве.", created_at: "2026-03-18T09:00:00Z", report_id: "r3" },
];

function EventDetailPage({ user, onLogout, demoMode, sharedEvents, sharedRegs, setSharedRegs }: { user: User | null; onLogout: () => void; demoMode: boolean; sharedEvents: EventData[]; sharedRegs: Set<string>; setSharedRegs: React.Dispatch<React.SetStateAction<Set<string>>> }) {
  const navigate = useNavigate();
  const { id: eventId = "" } = useParams<{ id: string }>();

  const [event, setEvent] = useState<EventData | null>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const registered = sharedRegs.has(eventId);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [activeReportComments, setActiveReportComments] = useState<string>("");
  const [feedback, setFeedback] = useState<Record<string, number>>({});

  useEffect(() => {
    const ev = sharedEvents.find((e) => e.id === eventId);
    if (ev) {
      setEvent(ev);
      if (demoMode || !user) {
        setSections(DEMO_SECTIONS_PROGRAM[eventId] || []);
        setComments([...DEMO_COMMENTS]);
        setLoading(false);
      } else {
        (async () => {
          try {
            const prog = await apiFetch<any>("GET", `/api/events/${eventId}/program`);
            setSections(prog.sections || []);
          } catch {
            setSections(DEMO_SECTIONS_PROGRAM[eventId] || []);
            setComments([...DEMO_COMMENTS]);
          }
          finally { setLoading(false); }
        })();
      }
    } else {
      setEvent(null);
      setLoading(false);
    }
  }, [eventId, demoMode, user, sharedEvents]);

  const handleRegister = async () => {
    if (registered) return;
    if (!user) { navigate("/login"); return; }
    if (!demoMode) {
      try { await apiFetch("POST", `/api/events/${eventId}/register`); } catch {}
    }
    setSharedRegs((prev) => new Set(prev).add(eventId));
  };

  const addComment = async (reportId: string) => {
    if (!commentText.trim()) return;
    if (!user) { navigate("/login"); return; }
    const newComment: CommentItem = {
      id: `c-${Date.now()}`,
      user_name: user.full_name,
      text: commentText.trim(),
      created_at: new Date().toISOString(),
      report_id: reportId,
    };
    if (!demoMode) {
      try { await apiFetch("POST", `/api/reports/${reportId}/comments`, { text: commentText.trim() }); } catch {}
    }
    setComments((prev) => [...prev, newComment]);
    setCommentText("");
  };

  const setRating = async (reportId: string, rating: number) => {
    if (!user) { navigate("/login"); return; }
    setFeedback((prev) => ({ ...prev, [reportId]: rating }));
    if (!demoMode) {
      try { await apiFetch("POST", `/api/reports/${reportId}/feedback`, { rating }); } catch {}
    }
  };

  const fmtTime = (iso?: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  const fmtDate = (iso: string) => {
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return (<div><TopBar user={user} onLogout={onLogout} /><div style={{ padding: 48 }}><Spinner /></div></div>);
  if (!event) return (<div><TopBar user={user} onLogout={onLogout} /><div className="event-detail-page"><EmptyState icon="❌" title="Мероприятие не найдено" description="Проверьте ссылку или вернитесь к списку." /><button onClick={() => navigate("/events")} style={{ display: "block", margin: "20px auto", padding: "10px 24px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>← К мероприятиям</button></div></div>);

  return (
    <div>
      <TopBar user={user} onLogout={onLogout} />
      <div className="event-detail-page">
        {/* Кнопка назад */}
        <button onClick={() => navigate("/events")} style={{ padding: "6px 16px", background: "var(--bg-light)", color: "var(--text-muted)", border: "1.5px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 20 }}>
          ← Все мероприятия
        </button>

        {/* Шапка мероприятия */}
        <div style={{ background: "white", borderRadius: 16, padding: "28px 32px", border: "1.5px solid var(--border)", marginBottom: 24, boxShadow: "0 2px 12px rgba(74,89,138,0.07)" }}>
          <h1 style={{ fontWeight: 900, fontSize: 24, color: "var(--primary-dark)", marginBottom: 8 }}>{event.title}</h1>
          {event.description && <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14 }}>{event.description}</p>}
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>📅 {event.start_date} — {event.end_date}</span>
            <button
              onClick={handleRegister}
              style={{
                padding: "10px 24px", borderRadius: 100, fontWeight: 800, fontSize: 13,
                cursor: "pointer", fontFamily: "Nunito, sans-serif", border: "none",
                background: registered ? "#f0fdf4" : "#16a34a",
                color: registered ? "#16a34a" : "white",
                ...(registered ? { border: "1.5px solid #bbf7d0" } : {}),
              }}
            >
              {registered ? "✅ Вы зарегистрированы" : user ? "Зарегистрироваться" : "Войти для регистрации"}
            </button>
            {registered && (
              <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>
                💬 Вы добавлены в чат мероприятия
              </span>
            )}
          </div>
        </div>

        {/* Секции и доклады */}
        <h2 style={{ fontWeight: 900, fontSize: 20, color: "var(--primary-dark)", marginBottom: 16 }}>Программа</h2>
        {sections.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 600, textAlign: "center", padding: 32 }}>
            Программа пока не опубликована
          </div>
        ) : (
          sections.map((sec: any) => (
            <div key={sec.id} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--primary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                📌 {sec.title}
                {sec.location && <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 13 }}>· 📍 {sec.location}</span>}
                {sec.format && <span style={{ padding: "2px 8px", background: "var(--bg-medium)", borderRadius: 100, fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>{sec.format}</span>}
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {(sec.reports || []).map((r: any) => {
                  const reportComments = comments.filter((c) => c.report_id === r.id);
                  const isOpen = activeReportComments === r.id;
                  const rating = feedback[r.id] || 0;

                  return (
                    <div key={r.id} style={{ background: "white", borderRadius: 14, border: "1.5px solid var(--border)", overflow: "hidden" }}>
                      {/* Доклад */}
                      <div style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            {r.start_time && (
                              <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 800, marginBottom: 4 }}>
                                🕐 {fmtTime(r.start_time)}{r.end_time ? ` – ${fmtTime(r.end_time)}` : ""}
                              </div>
                            )}
                            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--primary-dark)", marginBottom: 4 }}>{r.title}</div>
                            {r.speaker_name && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>🎤 {r.speaker_name}</div>}
                          </div>
                          {/* Оценка */}
                          {user && (
                            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  onClick={() => setRating(r.id, star)}
                                  style={{ cursor: "pointer", fontSize: 18, color: star <= rating ? "#f59e0b" : "#e2e8f0", transition: "color 0.15s" }}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                          <button
                            onClick={() => setActiveReportComments(isOpen ? "" : r.id)}
                            style={{ padding: "6px 14px", background: isOpen ? "var(--bg-medium)" : "var(--bg-light)", color: isOpen ? "var(--primary)" : "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                          >
                            💬 Комментарии ({reportComments.length}) {isOpen ? "↑" : "↓"}
                          </button>
                        </div>
                      </div>

                      {/* Комментарии */}
                      {isOpen && (
                        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 20px", background: "#fafbfc" }}>
                          {reportComments.length === 0 && (
                            <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 12 }}>
                              Пока нет комментариев. Будьте первым!
                            </div>
                          )}
                          {reportComments.map((c) => (
                            <div key={c.id} className="comment-card">
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontWeight: 800, fontSize: 13, color: "var(--primary-dark)" }}>{c.user_name}</span>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(c.created_at)}</span>
                              </div>
                              <div style={{ fontSize: 14, color: "var(--text-main)", lineHeight: 1.5 }}>{c.text}</div>
                            </div>
                          ))}
                          {/* Поле ввода комментария */}
                          {user ? (
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <input
                                type="text"
                                placeholder="Написать комментарий..."
                                value={activeReportComments === r.id ? commentText : ""}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addComment(r.id)}
                                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none" }}
                              />
                              <button
                                onClick={() => addComment(r.id)}
                                style={{ padding: "10px 18px", background: "var(--primary)", color: "white", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap" }}
                              >
                                Отправить
                              </button>
                            </div>
                          ) : (
                            <div style={{ textAlign: "center", marginTop: 10 }}>
                              <button onClick={() => navigate("/login")} style={{ padding: "8px 20px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                Войти для комментирования
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DEMO DATA — «ХАКАТОН ВНУТРИ ХАКАТОНА»
// ═══════════════════════════════════════════════════════════════
interface DemoUser extends User {
  password: string;
}

const DEMO_USERS: Record<string, DemoUser> = {
  "org@it.ru": {
    id: "u1",
    email: "org@it.ru",
    password: "org",
    full_name: "Организатор Иванов",
    global_role: "ORGANIZER",
    organization: "ИТ-Кластер Сибири",
  },
  "user@it.ru": {
    id: "u2",
    email: "user@it.ru",
    password: "user",
    full_name: "Иван Участников",
    global_role: "PARTICIPANT",
    organization: "ОмГТУ",
  },
  "curator@it.ru": {
    id: "u3",
    email: "curator@it.ru",
    password: "curator",
    full_name: "Куратор Секционов",
    global_role: "CURATOR" as GlobalRole,
    organization: "ОмГТУ",
  },
  "speaker@it.ru": {
    id: "u4",
    email: "speaker@it.ru",
    password: "speaker",
    full_name: "Алексей Спикеров",
    global_role: "SPEAKER" as GlobalRole,
    organization: "ОмГТУ",
  },
};

// Контекстные роли — кто какую роль имеет в каком мероприятии
interface DemoMembership {
  user_id: string;
  event_id: string;
  context_role: "CURATOR" | "SPEAKER" | "PARTICIPANT";
  section_id?: string;
  report_id?: string;
}

const DEMO_MEMBERSHIPS_INIT: DemoMembership[] = [
  { user_id: "u3", event_id: "e1", context_role: "CURATOR", section_id: "s1" },
  { user_id: "u3", event_id: "e2", context_role: "CURATOR", section_id: "s3" },
  { user_id: "u4", event_id: "e1", context_role: "SPEAKER", section_id: "s1", report_id: "r1" },
  { user_id: "u2", event_id: "e1", context_role: "PARTICIPANT" },
  { user_id: "u2", event_id: "e2", context_role: "PARTICIPANT" },
];

// Определить лучшую роль пользователя по memberships
function getBestRole(userId: string, memberships: DemoMembership[], globalRole?: string): "ORGANIZER" | "CURATOR" | "SPEAKER" | "PARTICIPANT" {
  // Бэкенд ставит global_role в users таблице — это приоритет
  if (globalRole === "ORGANIZER") return "ORGANIZER";
  if (globalRole === "CURATOR") return "CURATOR";
  if (globalRole === "SPEAKER") return "SPEAKER";
  // Fallback на memberships (для demo-режима)
  if (memberships.some((m) => m.user_id === userId && m.context_role === "CURATOR")) return "CURATOR";
  if (memberships.some((m) => m.user_id === userId && m.context_role === "SPEAKER")) return "SPEAKER";
  return "PARTICIPANT";
}

// Получить все пользователей для назначения
const DEMO_ALL_USERS: User[] = [
  { id: "u1", email: "org@it.ru", full_name: "Организатор Иванов", global_role: "ORGANIZER", organization: "ИТ-Кластер Сибири" },
  { id: "u2", email: "user@it.ru", full_name: "Иван Участников", global_role: "PARTICIPANT", organization: "ОмГТУ" },
  { id: "u3", email: "curator@it.ru", full_name: "Куратор Секционов", global_role: "CURATOR" as GlobalRole, organization: "ОмГТУ" },
  { id: "u4", email: "speaker@it.ru", full_name: "Алексей Спикеров", global_role: "SPEAKER" as GlobalRole, organization: "ОмГТУ" },
];

const DEMO_EVENTS: EventData[] = [
  {
    id: "e1",
    title: "XI Международный ИТ-Форум 2026",
    description:
      "«Основы цифрового будущего» — крупнейший IT-форум Сибири. Секции: ИнфоБез, ML, DevOps, Frontend, UX/UI.",
    start_date: "2026-03-16",
    end_date: "2026-03-20",
    owner_id: "u1",
    status: "PUBLISHED",
  },
  {
    id: "e2",
    title: "Цифровой хакатон 2026",
    description:
      "Хакатон ИТ-Кластера Сибири × ОмГТУ. 6 кейсов, 3 дня, 30 команд.",
    start_date: "2026-03-16",
    end_date: "2026-03-20",
    owner_id: "u1",
    status: "PUBLISHED",
  },
  {
    id: "e3",
    title: "Робофест Омск 2026",
    description: "Фестиваль робототехники. Черновик — запуск осенью.",
    start_date: "2026-10-01",
    end_date: "2026-10-03",
    owner_id: "u1",
    status: "DRAFT",
  },
];

const DEMO_TASKS: Task[] = [
  {
    id: "t1",
    event_id: "e1",
    title: "Подтвердить спикеров секции ИнфоБез",
    assigned_to: "u3",
    assigned_to_name: "Куратор Секционов",
    created_by: "u1",
    status: "IN_PROGRESS",
    due_date: "2026-03-18",
  },
  {
    id: "t2",
    event_id: "e1",
    title: "Забронировать Зал А (корпус 1)",
    assigned_to: "u1",
    assigned_to_name: "Организатор Иванов",
    created_by: "u1",
    status: "DONE",
    due_date: "2026-03-16",
  },
  {
    id: "t3",
    event_id: "e1",
    title: "Подготовить раздаточные материалы",
    assigned_to: "u2",
    assigned_to_name: "Иван Участников",
    created_by: "u1",
    status: "TODO",
    due_date: "2026-03-19",
  },
  {
    id: "t4",
    event_id: "e1",
    title: "Настроить трансляцию секции ML",
    assigned_to: "u1",
    assigned_to_name: "Организатор Иванов",
    created_by: "u1",
    status: "TODO",
    due_date: "2026-03-19",
  },
  {
    id: "t5",
    event_id: "e2",
    title: "Настроить WiFi в аудиториях",
    assigned_to: "u1",
    assigned_to_name: "Организатор Иванов",
    created_by: "u1",
    status: "IN_PROGRESS",
    due_date: "2026-03-18",
  },
  {
    id: "t6",
    event_id: "e2",
    title: "Подготовить кейсы для команд",
    assigned_to: "u1",
    assigned_to_name: "Организатор Иванов",
    created_by: "u1",
    status: "DONE",
    due_date: "2026-03-17",
  },
  {
    id: "t7",
    event_id: "e2",
    title: "Пригласить менторов на хакатон",
    assigned_to: "u3",
    assigned_to_name: "Куратор Секционов",
    created_by: "u1",
    status: "TODO",
    due_date: "2026-03-18",
  },
  {
    id: "t8",
    event_id: "e2",
    title: "Заказать питание для участников",
    assigned_to: "u2",
    assigned_to_name: "Иван Участников",
    created_by: "u1",
    status: "IN_PROGRESS",
    due_date: "2026-03-19",
  },
  {
    id: "t9",
    event_id: "e1",
    title: "Собрать bio и фото спикеров секции ИнфоБез",
    assigned_to: "u3",
    assigned_to_name: "Куратор Секционов",
    created_by: "u1",
    status: "TODO",
    due_date: "2026-03-18",
  },
  {
    id: "t10",
    event_id: "e1",
    title: "Подготовить слайды к докладу",
    assigned_to: "u4",
    assigned_to_name: "Алексей Спикеров",
    created_by: "u3",
    status: "TODO",
    due_date: "2026-03-19",
  },
  {
    id: "t11",
    event_id: "e1",
    title: "Тестовый прогон доклада",
    assigned_to: "u4",
    assigned_to_name: "Алексей Спикеров",
    created_by: "u3",
    status: "IN_PROGRESS",
    due_date: "2026-03-18",
  },
];

// ═══════════════════════════════════════════════════════════════
// 1. LANDING PAGE  (FIX #5 — возвращён лендинг)
// ═══════════════════════════════════════════════════════════════
function LandingPage({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const navigate = useNavigate();

  const features = [
    { icon: "🏗️", title: "Структура мероприятия", desc: "Секции, доклады, кейсы — всё в одном месте с ролевой моделью" },
    { icon: "📌", title: "Канбан задач", desc: "Ставьте задачи организаторам, кураторам, спикерам. Контролируйте % готовности" },
    { icon: "📅", title: "Календарь и расписание", desc: "Мероприятия, дедлайны задач и личное расписание участника" },
    { icon: "👥", title: "4 роли", desc: "Организатор → Куратор → Спикер → Участник. Каждый видит своё" },
    { icon: "💬", title: "Встроенный мессенджер", desc: "Групповые чаты мероприятий и ЛС. WebSocket в реальном времени" },
    { icon: "⭐", title: "Обратная связь", desc: "Комментарии и оценки докладов. Итоговый отчёт куратора секции" },
  ];

  return (
    <div>
      {/* HERO */}
      <div className="landing-hero">
        <TopBar user={user} onLogout={onLogout} variant="landing" />

        <div className="landing-content">
          <div style={{ maxWidth: 680, animation: "fadeInUp 0.8s ease-out" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 16,
              }}
            >
              Платформа управления мероприятиями
            </div>
            <h1
              style={{
                fontSize: "clamp(36px, 5vw, 56px)",
                fontWeight: 900,
                lineHeight: 1.15,
                marginBottom: 20,
                letterSpacing: "-1px",
                color: "var(--primary-dark)",
              }}
            >
              Организуйте форумы,{" "}
              <span style={{ color: "var(--primary)" }}>конференции</span> и хакатоны в
              одном месте
            </h1>
            <p
              style={{
                fontSize: 18,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 36,
                maxWidth: 520,
              }}
            >
              Замените связку «сайт&nbsp;+ мессенджеры&nbsp;+ таблицы&nbsp;+
              файл&nbsp;программы» одним инструментом.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button
                onClick={() => navigate("/events")}
                style={{
                  padding: "14px 36px",
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                  borderRadius: 100,
                  fontWeight: 900,
                  fontSize: 16,
                  cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                  boxShadow: "0 4px 20px rgba(37,99,235,0.3)",
                }}
              >
                Смотреть мероприятия →
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                style={{
                  padding: "14px 36px",
                  background: "white",
                  color: "var(--primary-dark)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 100,
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                Узнать больше
              </button>
            </div>
            <div style={{ display: "flex", gap: 40, marginTop: 48 }}>
              {[
                { n: "4", l: "Роли" },
                { n: "10+", l: "Функций куратора" },
                { n: "1", l: "Вместо 5 сервисов" },
              ].map((s) => (
                <div key={s.l}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "var(--primary)" }}>
                    {s.n}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" className="landing-features">
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              Возможности
            </div>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: "var(--primary-dark)",
              }}
            >
              Всё что нужно — в одной платформе
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize: 36, marginBottom: 14 }}>{f.icon}</div>
                <h3
                  style={{
                    fontWeight: 800,
                    fontSize: 16,
                    color: "var(--primary-dark)",
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div
        id="footer-cta"
        style={{
          padding: "64px 48px",
          background: "var(--primary-dark)",
          textAlign: "center",
          color: "white",
        }}
      >
        <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>
          Готовы начать?
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            marginBottom: 28,
            fontSize: 16,
          }}
        >
          Создайте первое мероприятие прямо сейчас
        </p>
        <button
          onClick={() => navigate("/events")}
          style={{
            padding: "14px 40px",
            background: "white",
            color: "var(--primary-dark)",
            border: "none",
            borderRadius: 100,
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            fontFamily: "Nunito, sans-serif",
          }}
        >
          Смотреть мероприятия
        </button>
        <div
          style={{
            marginTop: 32,
            fontSize: 12,
            color: "rgba(255,255,255,0.35)",
          }}
        >
          EventHub · Цифровой хакатон 2026 · ОмГТУ × ИТ-Кластер Сибири
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. AUTH PAGE
// ═══════════════════════════════════════════════════════════════
function AuthPage({ onLogin, onRegister, loading, error }: {
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string, full_name: string) => void;
  loading: boolean; error: string;
}) {
  const [isRegister, setIsRegister] = useState(() => new URLSearchParams(window.location.search).has("register"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const navigate = useNavigate();
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); isRegister ? onRegister(email, password, fullName) : onLogin(email, password); };
  const switchMode = () => { setIsRegister(!isRegister); setEmail(""); setPassword(""); setFullName(""); };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{ fontSize: 36, marginBottom: 8, cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            🚀
          </div>
          <h1
            style={{
              fontWeight: 900,
              fontSize: 24,
              color: "var(--primary-dark)",
              marginBottom: 4,
            }}
          >
            EventHub
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
            {isRegister ? "Регистрация" : "Вход в платформу"}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
        >
          {isRegister && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>ФИО</label>
              <input type="text" className="auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" required />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Email
            </label>
            <input
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@it.ru"
              required
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 5,
              }}
            >
              Пароль
            </label>
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (isRegister ? "Регистрация..." : "Вход...") : (isRegister ? "Зарегистрироваться" : "Войти")}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span onClick={switchMode} style={{ fontSize: 13, color: "var(--primary)", fontWeight: 700, cursor: "pointer" }}>
            {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
          </span>
        </div>

        {/* Demo buttons — только на странице входа */}
        {!isRegister && (
        <div
          style={{
            marginTop: 20,
            borderTop: "1.5px solid var(--border)",
            paddingTop: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Быстрый Demo вход
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { email: "org@it.ru", pass: "org", label: "👔 Организатор", bg: "var(--primary)" },
              { email: "curator@it.ru", pass: "curator", label: "📋 Куратор", bg: "#6b7280" },
              { email: "speaker@it.ru", pass: "speaker", label: "🎤 Спикер", bg: "#d97706" },
              { email: "user@it.ru", pass: "user", label: "🙋 Участник", bg: "#16a34a" },
            ].map((d) => (
              <button
                key={d.email}
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.pass);
                }}
                style={{
                  flex: 1,
                  padding: 8,
                  background: d.bg,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        )}

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span
            onClick={() => navigate("/")}
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← На главную
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. CALENDAR  (FIX #3 — настоящая сетка-календарь)
// ═══════════════════════════════════════════════════════════════
function CalendarView({
  events,
  tasks,
}: {
  events: EventData[];
  tasks: Task[];
}) {
  const [viewDate, setViewDate] = useState(() => new Date(2026, 2, 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // Пн=0

  const cells: { day: number; mo: number; yr: number; cur: boolean }[] = [];
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--)
    cells.push({ day: prevLast - i, mo: month - 1, yr: year, cur: false });
  for (let d = 1; d <= lastDay.getDate(); d++)
    cells.push({ day: d, mo: month, yr: year, cur: true });
  while (cells.length < 42)
    cells.push({
      day: cells.length - (startDow + lastDay.getDate()) + 1,
      mo: month + 1,
      yr: year,
      cur: false,
    });

  const monthNames = [
    "Январь","Февраль","Март","Апрель","Май","Июнь",
    "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
  ];

  const getItems = (d: number, mo: number, yr: number) => {
    const ds = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const items: { label: string; color: string; bg: string }[] = [];

    events.forEach((ev) => {
      if (ev.start_date && ev.end_date && ds >= ev.start_date && ds <= ev.end_date) {
        items.push({ label: ev.title.slice(0, 16), color: "#2563eb", bg: "#e8f0fe" });
      }
    });

    tasks.forEach((t) => {
      if (t.due_date === ds) {
        const done = t.status === "DONE";
        items.push({
          label: (done ? "✓ " : "") + t.title.slice(0, 14),
          color: done ? "#16a34a" : t.status === "IN_PROGRESS" ? "#d97706" : "#64748b",
          bg: done ? "#f0fdf4" : t.status === "IN_PROGRESS" ? "#fffbeb" : "#f1f5f9",
        });
      }
    });

    return items;
  };

  const isToday = (d: number, mo: number, yr: number) =>
    d === today.getDate() && mo === today.getMonth() && yr === today.getFullYear();

  return (
    <div>
      {/* Навигация по месяцам */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button className="cal-nav-btn" onClick={() => setViewDate(new Date(year, month - 1, 1))}>← Назад</button>
          <button className="cal-nav-btn" onClick={() => setViewDate(new Date())} style={{ fontSize: 12, padding: "8px 12px" }}>Сегодня</button>
        </div>
        <h2 style={{ fontWeight: 900, fontSize: 20, color: "var(--primary-dark)" }}>
          {monthNames[month]} {year}
        </h2>
        <button className="cal-nav-btn" onClick={() => setViewDate(new Date(year, month + 1, 1))}>Вперёд →</button>
      </div>

      {/* Дни недели */}
      <div className="cal-grid" style={{ marginBottom: 4 }}>
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontWeight: 800,
              fontSize: 12,
              color: "var(--text-muted)",
              padding: "8px 0",
              textTransform: "uppercase",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Ячейки */}
      <div className="cal-grid">
        {cells.map((c, idx) => {
          const items = c.cur ? getItems(c.day, c.mo, c.yr) : [];
          const todayCls = isToday(c.day, c.mo, c.yr) ? " today" : "";
          const otherCls = !c.cur ? " other-month" : "";
          return (
            <div key={idx} className={`cal-cell${todayCls}${otherCls}`}>
              <div className="cal-day-num">{c.day}</div>
              {items.slice(0, 3).map((it, j) => (
                <div
                  key={j}
                  className="cal-dot"
                  style={{ color: it.color, background: it.bg }}
                  title={it.label}
                >
                  {it.label}
                </div>
              ))}
              {items.length > 3 && (
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    paddingLeft: 4,
                  }}
                >
                  +{items.length - 3}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Легенда */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 16,
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-muted)",
          flexWrap: "wrap",
        }}
      >
        {[
          { bg: "#e8f0fe", bc: "#2563eb", label: "Мероприятие" },
          { bg: "#f1f5f9", bc: "#64748b", label: "Задача" },
          { bg: "#fffbeb", bc: "#d97706", label: "В работе" },
          { bg: "#f0fdf4", bc: "#16a34a", label: "Готово" },
        ].map((l) => (
          <span key={l.label}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: l.bg,
                border: `1px solid ${l.bc}`,
                marginRight: 4,
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3b. CHAT VIEW — мессенджер (группы по мероприятию + ЛС)
// ═══════════════════════════════════════════════════════════════
interface DemoChatRoom {
  id: string;
  event_id: string | null;
  type: "GROUP" | "DIRECT";
  name: string;
  avatar: string;
}

interface DemoChatMsg {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

const DEMO_CHAT_ROOMS: DemoChatRoom[] = [
  { id: "cr1", event_id: "e1", type: "GROUP", name: "ИТ-Форум 2026 — общий", avatar: "🏢" },
  { id: "cr2", event_id: "e2", type: "GROUP", name: "Хакатон 2026 — команда", avatar: "🚀" },
  { id: "cr3", event_id: null, type: "DIRECT", name: "Организатор Иванов", avatar: "О" },
  { id: "cr4", event_id: null, type: "DIRECT", name: "Куратор Секционов", avatar: "К" },
];

const DEMO_CHAT_MESSAGES: DemoChatMsg[] = [
  // cr1 — ИТ-Форум общий
  { id: "m1", room_id: "cr1", user_id: "u1", user_name: "Организатор Иванов", text: "Всем привет! Напоминаю: ИТ-Форум стартует 16 марта. Проверяйте свои секции.", created_at: "2026-03-15T09:00:00Z" },
  { id: "m2", room_id: "cr1", user_id: "u3", user_name: "Куратор Секционов", text: "Секция ИнфоБез готова на 60%. Два спикера подтверждены, одного ищем.", created_at: "2026-03-15T09:05:00Z" },
  { id: "m3", room_id: "cr1", user_id: "u2", user_name: "Иван Участников", text: "Подскажите, где можно посмотреть расписание докладов?", created_at: "2026-03-15T09:10:00Z" },
  { id: "m4", room_id: "cr1", user_id: "u1", user_name: "Организатор Иванов", text: "Расписание будет в разделе «Программа» после публикации. Скоро!", created_at: "2026-03-15T09:12:00Z" },
  { id: "m5", room_id: "cr1", user_id: "u3", user_name: "Куратор Секционов", text: "Зал А забронирован, трансляцию настроим к 18-му.", created_at: "2026-03-16T10:00:00Z" },
  { id: "m6", room_id: "cr1", user_id: "u2", user_name: "Иван Участников", text: "Спасибо! Буду на секции ИнфоБез точно 👍", created_at: "2026-03-16T10:05:00Z" },
  // cr2 — Хакатон
  { id: "m10", room_id: "cr2", user_id: "u1", user_name: "Организатор Иванов", text: "Команды, напоминаю: дедлайн загрузки проектов — 19 марта, 23:59!", created_at: "2026-03-16T08:00:00Z" },
  { id: "m11", room_id: "cr2", user_id: "u2", user_name: "Иван Участников", text: "Мы на кейсе 3 — EventHub. Уже есть бэкенд и фронт 💪", created_at: "2026-03-16T08:15:00Z" },
  { id: "m12", room_id: "cr2", user_id: "u3", user_name: "Куратор Секционов", text: "Красавцы! Если нужна помощь с деплоем — пишите.", created_at: "2026-03-16T08:20:00Z" },
  { id: "m13", room_id: "cr2", user_id: "u1", user_name: "Организатор Иванов", text: "WiFi в аудиториях проверяем сегодня. Если глючит — сразу сигнальте в чат.", created_at: "2026-03-17T09:00:00Z" },
  // cr3 — ЛС с Организатором
  { id: "m20", room_id: "cr3", user_id: "u1", user_name: "Организатор Иванов", text: "Привет! Как дела с подготовкой?", created_at: "2026-03-15T14:00:00Z" },
  { id: "m21", room_id: "cr3", user_id: "u2", user_name: "Иван Участников", text: "Всё идёт по плану. Материалы готовлю.", created_at: "2026-03-15T14:05:00Z" },
  { id: "m22", room_id: "cr3", user_id: "u1", user_name: "Организатор Иванов", text: "Отлично, дедлайн 19-го. Если нужна помощь — пиши.", created_at: "2026-03-15T14:07:00Z" },
  // cr4 — ЛС с Куратором
  { id: "m30", room_id: "cr4", user_id: "u3", user_name: "Куратор Секционов", text: "Привет! Видел твою регистрацию на ИнфоБез. Рад что будешь!", created_at: "2026-03-16T11:00:00Z" },
  { id: "m31", room_id: "cr4", user_id: "u2", user_name: "Иван Участников", text: "Обязательно буду! Очень интересная программа.", created_at: "2026-03-16T11:05:00Z" },
];

function ChatView({
  user,
  demoMode,
}: {
  user: User;
  demoMode: boolean;
}) {
  const [rooms, setRooms] = useState<DemoChatRoom[]>([]);
  const [messages, setMessages] = useState<DemoChatMsg[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [inputText, setInputText] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);
  const [dmQuery, setDmQuery] = useState("");
  const [dmResults, setDmResults] = useState<User[]>([]);
  const [dmSearching, setDmSearching] = useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Загрузка комнат
  useEffect(() => {
    if (demoMode) {
      setRooms(DEMO_CHAT_ROOMS);
      setMessages([...DEMO_CHAT_MESSAGES]);
      setActiveRoomId(DEMO_CHAT_ROOMS[0]?.id || "");
      setLoadingRooms(false);
      return;
    }
    (async () => {
      try {
        const apiRooms = await apiFetch<any[]>("GET", "/api/chat/my");
        const mapped: DemoChatRoom[] = [];
        for (const r of (apiRooms || [])) {
          let name = r.type === "GROUP" ? "Группа" : "ЛС";
          if (r.type === "GROUP" && r.event_id) {
            try { const ev = await apiFetch<any>("GET", "/api/events/" + r.event_id); name = ev.title; } catch {}
          }
          if (r.type === "DIRECT") {
            if (r.name) name = r.name;
            else if (r.participants) {
              const other = (r.participants as any[]).find((p: any) => p.id !== user.id);
              if (other) name = other.full_name || other.name || "ЛС";
            }
          }
          mapped.push({ id: r.id, event_id: r.event_id || null, type: r.type, name, avatar: r.type === "GROUP" ? "🏢" : "💬" });
        }
        setRooms(mapped);
        if (mapped.length) {
          setActiveRoomId(mapped[0].id);
          try {
            const data = await apiFetch<any>("GET", "/api/chat/" + mapped[0].id + "/messages?limit=50");
            const items = data.items || data || [];
            setMessages((Array.isArray(items) ? items : []).map((m: any) => ({
              id: m.id, room_id: m.room_id, user_id: m.user_id,
              user_name: m.user_id === user.id ? user.full_name : (m.user_name || m.sender_name || "Пользователь"),
              text: m.text, created_at: m.created_at,
            })));
          } catch {}
        }
      } catch {}
      finally { setLoadingRooms(false); }
    })();
  }, [demoMode]);

  // Прокрутка вниз при смене комнаты или новых сообщениях
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeRoomId, messages]);

  // Сообщения для активной комнаты
  const roomMessages = useMemo(
    () => messages
      .filter((m) => m.room_id === activeRoomId && m.id && m.text)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, activeRoomId]
  );
  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  // Последнее сообщение для превью в списке
  const lastMsg = useCallback(
    (roomId: string) => {
      const msgs = messages.filter((m) => m.room_id === roomId);
      if (!msgs.length) return null;
      return msgs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    },
    [messages]
  );

  // Отправка
  const sendMessage = async () => {
    if (!inputText.trim() || !activeRoomId) return;
    const text = inputText.trim();
    setInputText("");

    if (demoMode) {
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, room_id: activeRoomId, user_id: user.id, user_name: user.full_name, text, created_at: new Date().toISOString() }]);
      return;
    }
    try {
      const msg = await apiFetch<any>("POST", `/api/chat/${activeRoomId}/messages`, { text });
      setMessages((prev) => [...prev, {
        id: msg.id || `msg-${Date.now()}`,
        room_id: msg.room_id || activeRoomId,
        user_id: msg.user_id || user.id,
        user_name: user.full_name,
        text: msg.text || text,
        created_at: msg.created_at || new Date().toISOString(),
      }]);
    } catch {
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, room_id: activeRoomId, user_id: user.id, user_name: user.full_name, text, created_at: new Date().toISOString() }]);
    }
  };

  // Переключение комнаты
  const switchRoom = async (roomId: string) => {
    setActiveRoomId(roomId);
    if (!demoMode) {
      try {
        const data = await apiFetch<any>("GET", `/api/chat/${roomId}/messages?limit=50`);
        const items = data.items || data || [];
        const fetched = (Array.isArray(items) ? items : []).map((m: any) => ({
          id: m.id, room_id: m.room_id, user_id: m.user_id,
          user_name: m.user_id === user.id ? user.full_name : (m.user_name || m.sender_name || "Пользователь"),
          text: m.text, created_at: m.created_at,
        }));
        setMessages((prev) => [...prev.filter((m) => m.room_id !== roomId), ...fetched]);
      } catch {}
    }
  };

  // Поиск для нового ЛС
  const searchDM = async (q: string) => {
    setDmQuery(q);
    if (q.length < 2) { setDmResults([]); return; }
    setDmSearching(true);
    if (demoMode) {
      const demoUsers = ([
        { id: "u1", email: "org@it.ru", full_name: "Организатор Иванов", global_role: "ORGANIZER" as GlobalRole },
        { id: "u3", email: "curator@it.ru", full_name: "Куратор Секционов", global_role: "PARTICIPANT" as GlobalRole },
        { id: "u5", email: "speaker@it.ru", full_name: "Алексей Спикеров", global_role: "PARTICIPANT" as GlobalRole },
      ] as User[]).filter((u) => u.id !== user.id && u.full_name.toLowerCase().includes(q.toLowerCase()));
      setDmResults(demoUsers);
    } else {
      try {
        const users = await apiFetch<any[]>("GET", `/api/users/search?q=${encodeURIComponent(q)}`);
        setDmResults((users || []).filter((u: any) => u.id !== user.id));
      } catch { setDmResults([]); }
    }
    setDmSearching(false);
  };

  const startDM = async (targetUser: User) => {
    // Проверяем, есть ли уже ЛС
    const existing = rooms.find(
      (r) => r.type === "DIRECT" && r.name === targetUser.full_name
    );
    if (existing) {
      setActiveRoomId(existing.id);
      setShowNewDM(false);
      setDmQuery("");
      setDmResults([]);
      return;
    }
    const newRoom: DemoChatRoom = {
      id: `cr-dm-${Date.now()}`,
      event_id: null,
      type: "DIRECT",
      name: targetUser.full_name,
      avatar: targetUser.full_name[0],
    };
    if (!demoMode) {
      try {
        const res = await apiFetch<any>("POST", "/api/chat/direct", { user_id: targetUser.id });
        newRoom.id = res.id;
      } catch {}
    }
    setRooms((prev) => [...prev, newRoom]);
    setActiveRoomId(newRoom.id);
    setShowNewDM(false);
    setDmQuery("");
    setDmResults([]);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (loadingRooms) return <Spinner label="Загружаем чаты..." />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)" }}>💬 Мессенджер</h1>
        <button
          onClick={() => setShowNewDM(true)}
          style={{ padding: "8px 18px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
        >
          + Новое сообщение
        </button>
      </div>

      <div className="chat-wrapper">
        {/* Список комнат */}
        <div className="chat-rooms-list">
          <div className="chat-rooms-header">
            Чаты
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{rooms.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {rooms.map((room) => {
              const last = lastMsg(room.id);
              return (
                <div
                  key={room.id}
                  className={`chat-room-item${activeRoomId === room.id ? " active" : ""}`}
                  onClick={() => switchRoom(room.id)}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: room.type === "GROUP" ? "var(--primary)" : "#16a34a",
                      color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: room.avatar.length > 1 ? 16 : 14,
                    }}
                  >
                    {room.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--primary-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {room.name}
                    </div>
                    {last && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                        {last.user_id === user.id ? "Вы: " : ""}{last.text.slice(0, 30)}{last.text.length > 30 ? "…" : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, fontWeight: 600 }}>
                    {room.type === "GROUP" ? "👥" : "👤"}
                  </div>
                </div>
              );
            })}
            {rooms.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Нет чатов
              </div>
            )}
          </div>
        </div>

        {/* Область сообщений */}
        {activeRoom ? (
          <div className="chat-messages-area">
            <div className="chat-messages-header">
              {activeRoom.type === "GROUP" ? "👥 " : "👤 "}{activeRoom.name}
            </div>

            <div className="chat-messages-scroll" ref={scrollRef}>
              {roomMessages.length === 0 ? (
                <div className="chat-empty">Начните диалог — напишите первое сообщение</div>
              ) : (
                roomMessages.map((msg) => {
                  const isMine = msg.user_id === user.id;
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                      {!isMine && activeRoom.type === "GROUP" && (
                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--primary)", marginBottom: 2, paddingLeft: 4 }}>
                          {msg.user_name}
                        </div>
                      )}
                      <div className={`chat-msg ${isMine ? "mine" : "theirs"}`}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, padding: "0 4px" }}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="chat-input-bar">
              <input
                type="text"
                placeholder="Написать сообщение..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage}>Отправить</button>
            </div>
          </div>
        ) : (
          <div className="chat-messages-area">
            <div className="chat-empty">Выберите чат слева</div>
          </div>
        )}
      </div>

      {/* Модалка нового ЛС */}
      {showNewDM && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)", fontSize: 16 }}>Новое сообщение</h3>
              <button onClick={() => { setShowNewDM(false); setDmQuery(""); setDmResults([]); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
            </div>
            <input
              type="text"
              placeholder="Поиск по ФИО..."
              value={dmQuery}
              onChange={(e) => searchDM(e.target.value)}
              autoFocus
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box", fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 12 }}
            />
            {dmSearching && <div style={{ color: "#777", fontSize: 13, textAlign: "center", padding: 8 }}>Поиск...</div>}
            {dmResults.length > 0 && (
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                {dmResults.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => startDM(u)}
                    style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, transition: "background 0.15s" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#f0f7ff")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "white")}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                      {u.full_name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--primary-dark)" }}>{u.full_name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {dmQuery.length >= 2 && dmResults.length === 0 && !dmSearching && (
              <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Никого не найдено</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. ORGANIZER DASHBOARD
//    FIX #1: events подтягиваются из DEMO_EVENTS
//    FIX #2: новая задача привязывается к selectedEventId
//    FIX #3: CalendarView вместо пустого списка
//    FIX #4: канбан — понятные кнопки переходов
// ═══════════════════════════════════════════════════════════════
const COL_CFG: Record<TaskStatus, { label: string; icon: string; color: string }> = {
  TODO: { label: "К выполнению", icon: "📋", color: "#64748b" },
  IN_PROGRESS: { label: "В работе", icon: "🔧", color: "#d97706" },
  DONE: { label: "Выполнено", icon: "✅", color: "#16a34a" },
};

function OrganizerDashboard({
  user,
  onLogout,
  demoMode,
  memberships,
  setMemberships,
  sharedEvents,
  setSharedEvents,
}: {
  user: User;
  onLogout: () => void;
  demoMode: boolean;
  memberships: DemoMembership[];
  setMemberships: React.Dispatch<React.SetStateAction<DemoMembership[]>>;
  sharedEvents: EventData[];
  setSharedEvents: React.Dispatch<React.SetStateAction<EventData[]>>;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"events" | "kanban" | "calendar" | "chat" | "settings">("events");
  const events = sharedEvents;
  const setEvents = setSharedEvents;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selEv, setSelEv] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>(demoMode ? DEMO_ALL_USERS : []);

  // --- Публикация мероприятия ---
  const publishEvent = async (eid: string) => {
    setEvents((prev) => prev.map((e) => e.id === eid ? { ...e, status: "PUBLISHED" } : e));
    if (!demoMode) try { await apiFetch("PATCH", `/api/events/${eid}`, { status: "PUBLISHED" }); } catch {}
  };

  // --- Назначить куратора секции ---
  const [showAssignCurator, setShowAssignCurator] = useState("");
  const [curatorSearch, setCuratorSearch] = useState("");
  const [curatorResults, setCuratorResults] = useState<User[]>([]);
  const searchCurators = async (q: string) => {
    setCuratorSearch(q);
    if (q.length < 2) { setCuratorResults([]); return; }
    if (demoMode) {
      setCuratorResults(DEMO_ALL_USERS.filter((u) => u.id !== user.id && u.full_name.toLowerCase().includes(q.toLowerCase())));
    } else {
      try {
        const res = await apiFetch<User[]>("GET", `/api/users/search?q=${encodeURIComponent(q)}`);
        setCuratorResults((res || []).filter((u) => u.id !== user.id));
      } catch {
        // Fallback на демо-данные при недоступности API
        setCuratorResults(DEMO_ALL_USERS.filter((u) => u.id !== user.id && u.full_name.toLowerCase().includes(q.toLowerCase())));
      }
    }
  };
  const assignCurator = async (userId: string, eventId: string) => {
    setMemberships((prev) => [...prev, { user_id: userId, event_id: eventId, context_role: "CURATOR" as const }]);
    const foundUser = curatorResults.find((u) => u.id === userId);
    if (foundUser) setAllUsers((prev) => prev.some((u) => u.id === userId) ? prev : [...prev, foundUser]);
    if (!demoMode) {
      try { await apiFetch("POST", `/api/events/${eventId}/curators`, { user_id: userId }); } catch (e: any) { console.warn("API curator assign:", e?.message); }
    }
    setShowAssignCurator("");
    setCuratorSearch("");
    setCuratorResults([]);
  };

  // --- Назначить спикера (орг тоже может) ---
  const [showAssignSpeaker, setShowAssignSpeaker] = useState("");
  const [speakerSearch, setSpeakerSearch] = useState("");
  const [speakerResults, setSpeakerResults] = useState<User[]>([]);
  const searchSpeakers = async (q: string) => {
    setSpeakerSearch(q);
    if (q.length < 2) { setSpeakerResults([]); return; }
    if (demoMode) {
      setSpeakerResults(DEMO_ALL_USERS.filter((u) => u.id !== user.id && u.full_name.toLowerCase().includes(q.toLowerCase())));
    } else {
      try {
        const res = await apiFetch<User[]>("GET", `/api/users/search?q=${encodeURIComponent(q)}`);
        setSpeakerResults((res || []).filter((u) => u.id !== user.id));
      } catch {
        setSpeakerResults(DEMO_ALL_USERS.filter((u) => u.id !== user.id && u.full_name.toLowerCase().includes(q.toLowerCase())));
      }
    }
  };
  const assignSpeakerOrg = async (userId: string, eventId: string) => {
    setMemberships((prev) => [...prev, { user_id: userId, event_id: eventId, context_role: "SPEAKER" as const }]);
    if (!demoMode) {
      // Бэкенд: назначение спикера требует report_id. Если нет — пробуем как куратора с последующим обновлением.
      try { await apiFetch("POST", `/api/events/${eventId}/speakers`, { user_id: userId }); } catch (e: any) { console.warn("API speaker assign:", e?.message); }
    }
    setShowAssignSpeaker("");
    setSpeakerSearch("");
    setSpeakerResults([]);
  };

  // --- Загрузка данных ---
  useEffect(() => {
    setLoading(true);
    if (demoMode) {
      setTasks([...DEMO_TASKS]);
      setSelEv(events[0]?.id || "");
      setLoading(false);
      return;
    }
    // Real backend
    (async () => {
      try {
        const evs = await apiFetch<EventData[]>("GET", "/api/events/");
        if (evs?.length) {
          setEvents(evs);
          setSelEv(evs[0].id);
          let freshUsers: User[] = [];
          try { freshUsers = await apiFetch<User[]>("GET", "/api/users/search?q=") || []; setAllUsers(freshUsers); } catch {}
          // Load tasks
          const all: Task[] = [];
          for (const ev of evs) {
            try {
              const ts = await apiFetch<any[]>("GET", `/api/tasks/?event_id=${ev.id}`);
              for (const t of (ts || [])) {
                const assigneeName = (freshUsers.length ? freshUsers : DEMO_ALL_USERS).find((u) => u.id === t.assigned_to)?.full_name || "";
                all.push({ ...t, assigned_to_name: assigneeName });
              }
            } catch {}
          }
          setTasks(all);
          // Load curators/speakers into memberships
          const loaded: DemoMembership[] = [];
          for (const ev of evs) {
            try {
              const curators = await apiFetch<any[]>("GET", `/api/events/${ev.id}/curators`);
              (curators || []).forEach((m: any) => loaded.push({ user_id: m.user_id, event_id: ev.id, context_role: "CURATOR" as const }));
            } catch {}
            try {
              const speakers = await apiFetch<any[]>("GET", `/api/events/${ev.id}/speakers`);
              (speakers || []).forEach((m: any) => loaded.push({ user_id: m.user_id, event_id: ev.id, context_role: "SPEAKER" as const }));
            } catch {}
          }
          if (loaded.length > 0) {
            setMemberships(prev => [...prev.filter(m => m.context_role === "PARTICIPANT"), ...loaded]);
          }
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [demoMode]);

  const filtered = useMemo(() => tasks.filter((t) => t.event_id === selEv), [tasks, selEv]);
  const selEvent = events.find((e) => e.id === selEv);

  const pct = useCallback(
    (eid: string) => {
      const ts = tasks.filter((t) => t.event_id === eid);
      if (!ts.length) return 0;
      return Math.round((ts.filter((t) => t.status === "DONE").length / ts.length) * 100);
    },
    [tasks]
  );

  // --- Канбан: смена статуса ---
  const moveTask = async (id: string, s: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: s } : t)));
    if (!demoMode) try { await apiFetch("PATCH", `/api/tasks/${id}/status`, { status: s }); } catch {}
  };

  // --- FIX #2: добавление задачи ПРИВЯЗЫВАЕТСЯ к selEv ---
  const addTask = async () => {
    if (!newTitle.trim() || !selEv) return;
    const assignee = allUsers.find((u) => u.id === newAssignee) || { id: user.id, full_name: user.full_name };
    const newTask: Task = {
      id: `t-${Date.now()}`,
      event_id: selEv,
      title: newTitle.trim(),
      assigned_to: assignee.id,
      assigned_to_name: assignee.full_name,
      created_by: user.id,
      status: "TODO",
      due_date: newDue || null,
    };
    if (demoMode) {
      setTasks((prev) => [...prev, newTask]);
    } else {
      try {
        const res = await apiFetch<Task>("POST", "/api/tasks/", {
          event_id: selEv,
          title: newTitle.trim(),
          assigned_to: assignee.id,
          due_date: newDue || undefined,
        });
        setTasks((prev) => [...prev, res]);
      } catch {
        setTasks((prev) => [...prev, newTask]);
      }
    }
    setNewTitle("");
    setNewDue("");
    setNewAssignee("");
  };

  const delTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (!demoMode) try { await apiFetch("DELETE", `/api/tasks/${id}`); } catch {}
  };

  const navItems = [
    { id: "events", icon: "📋", label: "Мероприятия" },
    { id: "kanban", icon: "📌", label: "Канбан задач" },
    { id: "calendar", icon: "📅", label: "Календарь" },
    { id: "chat", icon: "💬", label: "Мессенджер" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ];

  return (
    <div>
      <TopBar user={user} onLogout={onLogout} />
      <div className="dashboard-wrapper">
      {/* SIDEBAR */}
      <aside className="dashboard-sidebar">
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: "50%", background: "var(--primary)",
              color: "white", fontSize: 26, fontWeight: 900, display: "flex",
              alignItems: "center", justifyContent: "center", margin: "0 auto",
            }}
          >
            {user.full_name[0]}
          </div>
          <h5 style={{ marginTop: 10, marginBottom: 4, fontWeight: 800, fontSize: 15 }}>
            {user.full_name}
          </h5>
          <span
            style={{
              display: "inline-block", padding: "3px 10px", background: "#e8f0fe",
              color: "var(--primary)", borderRadius: 100, fontSize: 11, fontWeight: 800,
            }}
          >
            ORGANIZER
          </span>
          {user.organization && (
            <p style={{ fontSize: 11, color: "#777", marginTop: 5 }}>
              {user.organization}
            </p>
          )}
          {demoMode && (
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginTop: 3 }}>
              DEMO
            </div>
          )}
        </div>

        <nav className="sidebar-nav-list">
          {navItems.map((i) => (
            <button
              key={i.id}
              className="nav-link"
              style={{
                background: tab === i.id ? "#eef6ff" : "#f1f5f9",
                color: tab === i.id ? "var(--primary)" : "#475569",
              }}
              onClick={() => setTab(i.id as any)}
            >
              <span style={{ marginRight: 8 }}>{i.icon}</span>
              {i.label}
            </button>
          ))}
          <button
            className="nav-link"
            style={{ marginTop: 8, background: "#f0fdf4", color: "#16a34a" }}
            onClick={() => navigate("/create-event")}
          >
            <span style={{ marginRight: 10 }}>➕</span>Создать мероприятие
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="dashboard-main-content">
        {loading ? (
          <Spinner label="Загружаем данные..." />
        ) : (
          <>
            {/* ═══ TAB: МЕРОПРИЯТИЯ ═══ */}
            {tab === "events" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)" }}>Мои мероприятия</h1>
                  <button onClick={() => navigate("/create-event")} style={{ padding: "10px 24px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ Создать</button>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  {events.map((ev) => {
                    const p = pct(ev.id);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => { setSelEv(ev.id); setTab("kanban"); }}
                        style={{
                          background: "white", borderRadius: 16, padding: "20px 24px",
                          boxShadow: "0 2px 12px rgba(74,89,138,0.07)",
                          border: `1.5px solid ${selEv === ev.id ? "var(--primary)" : "var(--border)"}`,
                          cursor: "pointer", transition: "border-color 0.2s",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontWeight: 800, fontSize: 16, color: "var(--primary-dark)", marginBottom: 6 }}>{ev.title}</h3>
                            {ev.description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{ev.description}</p>}
                            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)", fontWeight: 600, flexWrap: "wrap" }}>
                              {ev.start_date && <span>📅 {ev.start_date} — {ev.end_date}</span>}
                              <span style={{ padding: "2px 8px", borderRadius: 100, background: ev.status === "PUBLISHED" ? "#f0fdf4" : "#fffbeb", color: ev.status === "PUBLISHED" ? "#16a34a" : "#92400e", fontWeight: 800 }}>
                                {ev.status === "PUBLISHED" ? "Опубликовано" : "Черновик"}
                              </span>
                            </div>
                            {ev.status === "DRAFT" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); publishEvent(ev.id); }}
                                style={{ marginTop: 8, padding: "6px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                              >
                                🚀 Опубликовать
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowAssignCurator(showAssignCurator === ev.id ? "" : ev.id); }}
                              style={{ marginTop: 4, padding: "5px 14px", background: "var(--bg-medium)", color: "var(--primary)", border: "1px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                            >
                              📋 Назначить куратора
                            </button>
                            {showAssignCurator === ev.id && (
                              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, background: "#f8fafc", borderRadius: 10, padding: 12, border: "1px solid var(--border)" }}>
                                <input
                                  type="text" placeholder="Поиск по ФИО (мин. 2 символа)..."
                                  value={curatorSearch} onChange={(e) => searchCurators(e.target.value)}
                                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 8, boxSizing: "border-box" }}
                                />
                                {curatorResults.map((u) => (
                                  <div key={u.id} onClick={() => assignCurator(u.id, ev.id)} style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 6, fontSize: 12, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    onMouseOver={(e) => e.currentTarget.style.background = "#e8f0fe"} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                                    <span>{u.full_name}</span>
                                    <span style={{ color: "var(--primary)", fontSize: 11 }}>Назначить</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowAssignSpeaker(showAssignSpeaker === ev.id ? "" : ev.id); }}
                              style={{ marginTop: 4, padding: "5px 14px", background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                            >
                              🎤 Назначить спикера
                            </button>
                            {showAssignSpeaker === ev.id && (
                              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, background: "#f8fafc", borderRadius: 10, padding: 12, border: "1px solid var(--border)" }}>
                                <input type="text" placeholder="Поиск по ФИО (мин. 2 символа)..." value={speakerSearch} onChange={(e) => searchSpeakers(e.target.value)}
                                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
                                {speakerResults.map((u) => (
                                  <div key={u.id} onClick={() => assignSpeakerOrg(u.id, ev.id)} style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 6, fontSize: 12, fontWeight: 600, display: "flex", justifyContent: "space-between" }}
                                    onMouseOver={(e) => e.currentTarget.style.background = "#fffbeb"} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                                    <span>{u.full_name}</span>
                                    <span style={{ color: "#d97706", fontSize: 11 }}>Назначить</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {memberships.filter(m => m.event_id === ev.id && m.context_role === "CURATOR").length > 0 && (
                              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Кураторы:</span>
                                {memberships.filter(m => m.event_id === ev.id && m.context_role === "CURATOR").map(m => {
                                  const u = allUsers.find(x => x.id === m.user_id) || DEMO_ALL_USERS.find(x => x.id === m.user_id);
                                  return u ? <span key={m.user_id} style={{ fontSize: 11, padding: "2px 8px", background: "#e8f0fe", color: "var(--primary)", borderRadius: 100, fontWeight: 700 }}>📋 {u.full_name}</span> : null;
                                })}
                              </div>
                            )}
                            {memberships.filter(m => m.event_id === ev.id && m.context_role === "SPEAKER").length > 0 && (
                              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Спикеры:</span>
                                {memberships.filter(m => m.event_id === ev.id && m.context_role === "SPEAKER").map(m => {
                                  const u = allUsers.find(x => x.id === m.user_id) || DEMO_ALL_USERS.find(x => x.id === m.user_id);
                                  return u ? <span key={m.user_id} style={{ fontSize: 11, padding: "2px 8px", background: "#fffbeb", color: "#d97706", borderRadius: 100, fontWeight: 700 }}>🎤 {u.full_name}</span> : null;
                                })}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "center", minWidth: 70, flexShrink: 0 }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: p >= 75 ? "#16a34a" : p >= 40 ? "#d97706" : "var(--primary)" }}>{p}%</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>готовность</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 12, height: 6, background: "var(--bg-light)", borderRadius: 100, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${p}%`, background: p >= 75 ? "#16a34a" : p >= 40 ? "#d97706" : "var(--primary)", borderRadius: 100, transition: "width 0.5s" }} />
                        </div>
                        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Нажмите чтобы открыть канбан →</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/manage/events/${ev.id}`); }}
                            style={{ padding: "5px 14px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                          >
                            ⚙️ Управление
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {events.length === 0 && <EmptyState icon="📋" title="Нет мероприятий" description="Создайте первое мероприятие." />}
                </div>
              </div>
            )}

            {/* ═══ TAB: КАНБАН ═══ */}
            {tab === "kanban" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)" }}>📌 Канбан задач</h1>
                  <select value={selEv} onChange={(e) => setSelEv(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", fontWeight: 700, outline: "none", minWidth: 200 }}>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>

                {selEvent && (
                  <div style={{ background: "white", borderRadius: 12, padding: "12px 18px", marginBottom: 16, border: "1.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)" }}>{selEvent.title}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: pct(selEv) >= 75 ? "#16a34a" : "#d97706" }}>
                      Готовность: {pct(selEv)}% · Задач: {filtered.length}
                    </span>
                  </div>
                )}

                {/* Добавить задачу */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <input type="text" placeholder="Новая задача..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} style={{ flex: 2, minWidth: 180, padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                  <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", minWidth: 160 }}>
                    <option value="">Назначить на...</option>
                    {allUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                  <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                  <button onClick={addTask} style={{ padding: "10px 22px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap" }}>+ Добавить</button>
                </div>

                {/* Колонки */}
                <div className="kanban-board">
                  {(["TODO", "IN_PROGRESS", "DONE"] as TaskStatus[]).map((status) => {
                    const col = COL_CFG[status];
                    const colTasks = filtered.filter((t) => t.status === status);
                    return (
                      <div key={status} className="kanban-col">
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: col.color, display: "flex", alignItems: "center", gap: 6 }}>
                          {col.icon} {col.label}
                          <span style={{ marginLeft: "auto", background: "white", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 900, color: col.color }}>{colTasks.length}</span>
                        </div>
                        {colTasks.map((task) => (
                          <div key={task.id} className="kanban-card">
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "var(--primary-dark)" }}>{task.title}</div>
                            {task.assigned_to_name && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>👤 {task.assigned_to_name}</div>}
                            {task.due_date && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>📅 {task.due_date}</div>}
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {status === "TODO" && (
                                <button onClick={() => moveTask(task.id, "IN_PROGRESS")} style={{ padding: "4px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#d97706" }}>🔧 Взять в работу</button>
                              )}
                              {status === "IN_PROGRESS" && (
                                <>
                                  <button onClick={() => moveTask(task.id, "DONE")} style={{ padding: "4px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#16a34a" }}>✅ Выполнено</button>
                                  <button onClick={() => moveTask(task.id, "TODO")} style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid var(--border)", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#64748b" }}>← Вернуть</button>
                                </>
                              )}
                              {status === "DONE" && (
                                <button onClick={() => moveTask(task.id, "IN_PROGRESS")} style={{ padding: "4px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#d97706" }}>🔄 Вернуть в работу</button>
                              )}
                              <button onClick={() => delTask(task.id)} style={{ padding: "4px 8px", background: "#fff1f1", border: "1px solid #fecaca", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#ef4444", marginLeft: "auto" }}>✕</button>
                            </div>
                          </div>
                        ))}
                        {colTasks.length === 0 && (
                          <div style={{ textAlign: "center", padding: 24, color: "#ccc", fontSize: 13, fontWeight: 600 }}>
                            {status === "TODO" ? "Добавьте задачу выше ↑" : "Пусто"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ TAB: КАЛЕНДАРЬ ═══ */}
            {tab === "calendar" && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>📅 Календарь</h1>
                <CalendarView events={events} tasks={tasks} />
              </div>
            )}

            {/* ═══ TAB: МЕССЕНДЖЕР ═══ */}
            {tab === "chat" && <ChatView user={user} demoMode={demoMode} />}

            {/* ═══ TAB: НАСТРОЙКИ ═══ */}
            {tab === "settings" && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>Настройки профиля</h1>
                <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 440, boxShadow: "0 2px 10px rgba(74,89,138,0.07)" }}>
                  {[
                    { l: "Имя", v: user.full_name },
                    { l: "Email", v: user.email },
                    { l: "Роль", v: user.global_role },
                    ...(user.organization ? [{ l: "Организация", v: user.organization }] : []),
                  ].map((f) => (
                    <div key={f.l} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{f.l}</div>
                      <div style={{ padding: "9px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{f.v}</div>
                    </div>
                  ))}
                  {demoMode && <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠️ Demo — изменения не сохраняются</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. UNIFIED DASHBOARD — участник / куратор / спикер
//    Все неорганизаторы попадают сюда. Роль определяется по memberships.
//    Канбан доступен ВСЕМ.
// ═══════════════════════════════════════════════════════════════
function ParticipantDashboard({
  user,
  onLogout,
  demoMode,
  memberships,
  setMemberships,
  sharedEvents,
  sharedRegs,
  setSharedRegs,
}: {
  user: User;
  onLogout: () => void;
  demoMode: boolean;
  memberships: DemoMembership[];
  setMemberships: React.Dispatch<React.SetStateAction<DemoMembership[]>>;
  sharedEvents: EventData[];
  sharedRegs: Set<string>;
  setSharedRegs: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"program" | "sections" | "my_report" | "kanban" | "schedule" | "questions" | "final_report" | "chat" | "settings">("program");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selEv, setSelEv] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [allUsers, setAllUsers] = useState<User[]>(demoMode ? DEMO_ALL_USERS : []);

  // Определяем лучшую роль пользователя из РЕАКТИВНЫХ memberships
  const bestRole = getBestRole(user.id, memberships, user.global_role);
  const isCurator = bestRole === "CURATOR";
  const isSpeaker = bestRole === "SPEAKER";

  // Мероприятия где пользователь куратор
  const curatorEventIds = memberships.filter((m) => m.user_id === user.id && m.context_role === "CURATOR").map((m) => m.event_id);

  // Events: куратор видит свои + опубликованные, остальные — только опубликованные
  const events = isCurator
    ? sharedEvents.filter((e) => curatorEventIds.includes(e.id) || e.status === "PUBLISHED")
    : sharedEvents.filter((e) => e.status === "PUBLISHED");

  // Regs from shared state
  const regs = sharedRegs;

  useEffect(() => {
    setLoading(true);
    if (demoMode) {
      const myTasks = isCurator
        ? DEMO_TASKS.filter((t) => curatorEventIds.includes(t.event_id))
        : DEMO_TASKS.filter((t) => t.assigned_to === user.id);
      setTasks([...myTasks]);
      if (events.length) setSelEv(events[0].id);
      setLoading(false);
    } else {
      (async () => {
        try {
          // Load users for name resolution
          try { const users = await apiFetch<User[]>("GET", "/api/users/search?q="); setAllUsers(users || []); } catch {}
          // Load tasks
          const all: Task[] = [];
          for (const ev of events) {
            try {
              const ts = await apiFetch<any[]>("GET", `/api/tasks/?event_id=${ev.id}`);
              all.push(...(ts || []).map((t: any) => ({ ...t, assigned_to_name: "" })));
            } catch {}
          }
          // Resolve names
          const resolvedUsers = allUsers.length ? allUsers : DEMO_ALL_USERS;
          const withNames = all.map((t) => ({ ...t, assigned_to_name: resolvedUsers.find((u) => u.id === t.assigned_to)?.full_name || "" }));
          setTasks(isCurator ? withNames : withNames.filter((t) => t.assigned_to === user.id));
          if (events.length) setSelEv(events[0].id);
        } catch {}
        finally { setLoading(false); }
      })();
    }
  }, [demoMode, memberships]);

  const register = async (id: string) => {
    if (regs.has(id)) return;
    if (!demoMode) try { await apiFetch("POST", `/api/events/${id}/register`); } catch {}
    setSharedRegs((prev) => new Set(prev).add(id));
  };

  const filtered = useMemo(() => tasks.filter((t) => t.event_id === selEv), [tasks, selEv]);
  const selEvent = events.find((e) => e.id === selEv);

  const pct = useCallback(
    (eid: string) => {
      const ts = tasks.filter((t) => t.event_id === eid);
      if (!ts.length) return 0;
      return Math.round((ts.filter((t) => t.status === "DONE").length / ts.length) * 100);
    },
    [tasks]
  );

  const moveTask = async (id: string, s: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: s } : t)));
    if (!demoMode) try { await apiFetch("PATCH", `/api/tasks/${id}/status`, { status: s }); } catch {}
  };

  const addTask = async () => {
    if (!newTitle.trim() || !selEv) return;
    // Куратор может назначать задачи другим, спикер/участник — только себе
    const assigneeId = (isCurator && newAssignee) ? newAssignee : user.id;
    const assignee = allUsers.find((u) => u.id === assigneeId) || { id: user.id, full_name: user.full_name };
    const newTask: Task = {
      id: `t-${Date.now()}`,
      event_id: selEv,
      title: newTitle.trim(),
      assigned_to: assignee.id,
      assigned_to_name: assignee.full_name,
      created_by: user.id,
      status: "TODO",
      due_date: newDue || null,
    };
    if (demoMode) {
      setTasks((prev) => [...prev, newTask]);
      // Также добавить в глобальный DEMO_TASKS чтобы другие видели
      DEMO_TASKS.push(newTask);
    } else {
      try {
        const res = await apiFetch<Task>("POST", "/api/tasks/", { event_id: selEv, title: newTitle.trim(), assigned_to: assigneeId, due_date: newDue || undefined });
        setTasks((prev) => [...prev, res]);
      } catch { setTasks((prev) => [...prev, newTask]); }
    }
    setNewTitle(""); setNewDue(""); setNewAssignee("");
  };

  const delTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (!demoMode) try { await apiFetch("DELETE", `/api/tasks/${id}`); } catch {}
  };

  // Пользователи для назначения (куратор может назначать спикерам своих мероприятий)
  const assignableUsers = isCurator ? allUsers.filter((u) => u.id !== user.id) : [];

  // Загружаем список пользователей для dropdown если ещё не загружен
  useEffect(() => {
    if (!isCurator || demoMode || allUsers.length > 0) return;
    apiFetch<User[]>("GET", "/api/users/search?q=")
      .then(users => { if (users?.length) setAllUsers(users); })
      .catch(() => {});
  }, [isCurator, demoMode, allUsers.length]);

  // ═══ СЕКЦИИ КУРАТОРА ═══
  const [curSections, setCurSections] = useState<any[]>([]);
  const [curReports, setCurReports] = useState<Record<string, any[]>>({});
  const [secLoading, setSecLoading] = useState(false);
  const [secError, setSecError] = useState("");
  const [secModal, setSecModal] = useState<{ open: boolean; section?: any; eventId: string }>({ open: false, eventId: "" });
  const [repModal, setRepModal] = useState<{ open: boolean; report?: any; sectionId: string }>({ open: false, sectionId: "" });
  const [delSecTarget, setDelSecTarget] = useState<any>(null);
  const [delRepTarget, setDelRepTarget] = useState<any>(null);
  const [secAssignSpeaker, setSecAssignSpeaker] = useState<any>(null);
  const [secAssignSearch, setSecAssignSearch] = useState("");
  const [secAssignResults, setSecAssignResults] = useState<User[]>([]);
  const [myEventIdForSec, setMyEventIdForSec] = useState("");
  const myEventIdRef = useRef("");

  const loadCuratorSections = async () => {
    if (demoMode) {
      const demoSecs: any[] = [];
      for (const eid of curatorEventIds) {
        const prog = (DEMO_SECTIONS_PROGRAM as any)[eid] || [];
        prog.forEach((s: any) => demoSecs.push({ ...s, event_id: eid }));
      }
      if (curatorEventIds[0]) { setMyEventIdForSec(curatorEventIds[0]); myEventIdRef.current = curatorEventIds[0]; }
      setCurSections(demoSecs);
      const recs: Record<string, any[]> = {};
      demoSecs.forEach((s: any) => { recs[s.id] = s.reports || []; });
      setCurReports(recs);
      return;
    }
    setSecLoading(true); setSecError("");
    try {
      const evRes = await apiFetch<any[]>("GET", "/api/events/");
      const myEvents = evRes || [];
      if (myEvents.length > 0 && !myEventIdRef.current) { myEventIdRef.current = myEvents[0].id; setMyEventIdForSec(myEvents[0].id); }
      let curatorEvIds: Set<string> = new Set(curatorEventIds);
      if (curatorEvIds.size === 0) {
        const token = localStorage.getItem("access_token") || "";
        await Promise.all(myEvents.map(async (ev: any) => {
          try {
            const r = await fetch(`http://localhost:8000/api/events/${ev.id}/curators`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
            if (r.ok) { const ms: any[] = await r.json(); if (ms.some((m: any) => m.user_id === user.id)) curatorEvIds.add(ev.id); }
          } catch {}
        }));
      }
      const filteredEvents = curatorEvIds.size > 0 ? myEvents.filter((ev: any) => curatorEvIds.has(ev.id)) : myEvents;
      if (filteredEvents.length > 0) { myEventIdRef.current = filteredEvents[0].id; setMyEventIdForSec(filteredEvents[0].id); }
      const allSecs: any[] = [];
      for (const ev of filteredEvents) {
        myEventIdRef.current = ev.id; setMyEventIdForSec(ev.id);
        try {
          const secsRes = await apiFetch<any[]>("GET", `/api/events/${ev.id}/sections`);
          for (const sec of secsRes || []) allSecs.push({ ...sec, event_id: sec.event_id || ev.id });
        } catch {}
      }
      setCurSections(allSecs);
      const recs: Record<string, any[]> = {};
      await Promise.all(allSecs.map(async (sec: any) => {
        try {
          const token = localStorage.getItem("access_token") || "";
          const r = await fetch(`http://localhost:8000/api/sections/${sec.id}/reports`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
          recs[sec.id] = r.ok ? await r.json() : [];
        } catch { recs[sec.id] = []; }
      }));
      setCurReports(recs);
    } catch (e: any) { setSecError(e?.message || "Не удалось загрузить секции"); }
    finally { setSecLoading(false); }
  };

  useEffect(() => {
    if (tab === "sections" && isCurator) loadCuratorSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isCurator, demoMode]);

  const saveSec = async (form: any) => {
    const eid = secModal.section?.event_id || secModal.eventId || myEventIdRef.current || myEventIdForSec;
    if (!eid) { alert("Не удалось определить мероприятие. Попробуйте перезайти на вкладку."); return; }
    if (demoMode) {
      const fake = { id: secModal.section?.id || `ds-${Date.now()}`, event_id: eid, curator_id: user.id, readiness_percent: 0, ...form };
      setCurSections(prev => secModal.section ? prev.map(s => s.id === fake.id ? fake : s) : [...prev, fake]);
      if (!secModal.section) setCurReports(prev => ({ ...prev, [fake.id]: [] }));
      setSecModal({ open: false, eventId: "" }); return;
    }
    const token = localStorage.getItem("access_token") || "";
    const url = secModal.section ? `http://localhost:8000/api/sections/${secModal.section.id}` : `http://localhost:8000/api/events/${eid}/sections`;
    const method = secModal.section ? "PATCH" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    if (!r.ok) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
    const created = await r.json();
    setCurSections(prev => secModal.section ? prev.map(s => s.id === created.id ? created : s) : [...prev, created]);
    if (!secModal.section) setCurReports(prev => ({ ...prev, [created.id]: [] }));
    setSecModal({ open: false, eventId: "" });
  };

  const deleteSec = async (sec: any) => {
    if (demoMode) { setCurSections(prev => prev.filter(s => s.id !== sec.id)); setDelSecTarget(null); return; }
    const token = localStorage.getItem("access_token") || "";
    const r = await fetch(`http://localhost:8000/api/sections/${sec.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok && r.status !== 204) { alert("Ошибка удаления"); return; }
    setCurSections(prev => prev.filter(s => s.id !== sec.id)); setDelSecTarget(null);
  };

  const saveRep = async (form: any) => {
    const sid = repModal.report?.section_id || repModal.sectionId;
    if (demoMode) {
      const fake = { id: repModal.report?.id || `dr-${Date.now()}`, section_id: sid, speaker_id: null, speaker_confirmed: false, ...form };
      setCurReports(prev => ({ ...prev, [sid]: repModal.report ? (prev[sid]||[]).map((r: any) => r.id === fake.id ? fake : r) : [...(prev[sid]||[]), fake] }));
      setRepModal({ open: false, sectionId: "" }); return;
    }
    const token = localStorage.getItem("access_token") || "";
    const url = repModal.report ? `http://localhost:8000/api/reports/${repModal.report.id}` : `http://localhost:8000/api/sections/${sid}/reports`;
    const method = repModal.report ? "PATCH" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    if (!r.ok) { const err = await r.json().catch(() => ({})); alert(err?.detail || `Ошибка ${r.status}`); return; }
    const saved = await r.json();
    setCurReports(prev => ({ ...prev, [sid]: repModal.report ? (prev[sid]||[]).map((r: any) => r.id === saved.id ? saved : r) : [...(prev[sid]||[]), saved] }));
    setRepModal({ open: false, sectionId: "" });
  };

  const deleteRep = async (rep: any) => {
    if (demoMode) { setCurReports(prev => ({ ...prev, [rep.section_id]: (prev[rep.section_id]||[]).filter((r: any) => r.id !== rep.id) })); setDelRepTarget(null); return; }
    const token = localStorage.getItem("access_token") || "";
    const r = await fetch(`http://localhost:8000/api/reports/${rep.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok && r.status !== 204) { alert("Ошибка удаления"); return; }
    setCurReports(prev => ({ ...prev, [rep.section_id]: (prev[rep.section_id]||[]).filter((r: any) => r.id !== rep.id) })); setDelRepTarget(null);
  };

  const searchSecSpeakers = async (q: string) => {
    setSecAssignSearch(q);
    if (q.length < 2) { setSecAssignResults([]); return; }
    if (demoMode) { setSecAssignResults(DEMO_ALL_USERS.filter(u => u.full_name.toLowerCase().includes(q.toLowerCase()))); return; }
    try { const r = await apiFetch<User[]>("GET", `/api/users/search?q=${encodeURIComponent(q)}`); setSecAssignResults(r || []); } catch {}
  };

  const assignSecSpeaker = async (speakerUser: User) => {
    if (!secAssignSpeaker) return;
    if (demoMode) {
      setCurReports(prev => ({ ...prev, [secAssignSpeaker.section_id]: (prev[secAssignSpeaker.section_id]||[]).map((r: any) => r.id === secAssignSpeaker.id ? { ...r, speaker_id: speakerUser.id, speaker_name: speakerUser.full_name } : r) }));
      setSecAssignSpeaker(null); setSecAssignSearch(""); setSecAssignResults([]); return;
    }
    const token = localStorage.getItem("access_token") || "";
    const r = await fetch(`http://localhost:8000/api/reports/${secAssignSpeaker.id}/speaker`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: speakerUser.id }) });
    if (!r.ok) { const err = await r.json().catch(() => ({})); alert(err?.detail || "Ошибка"); return; }
    setCurReports(prev => ({ ...prev, [secAssignSpeaker.section_id]: (prev[secAssignSpeaker.section_id]||[]).map((r: any) => r.id === secAssignSpeaker.id ? { ...r, speaker_id: speakerUser.id, speaker_name: speakerUser.full_name } : r) }));
    setSecAssignSpeaker(null); setSecAssignSearch(""); setSecAssignResults([]);
  };

  // Назначить спикера (для куратора)
  const [showAssignSpeaker, setShowAssignSpeaker] = useState("");
  const [speakerSearch, setSpeakerSearch] = useState("");
  const [speakerResults, setSpeakerResults] = useState<User[]>([]);
  const searchSpeakers = async (q: string) => {
    setSpeakerSearch(q);
    if (q.length < 2) { setSpeakerResults([]); return; }
    if (demoMode) {
      setSpeakerResults(DEMO_ALL_USERS.filter((u) => u.id !== user.id && u.full_name.toLowerCase().includes(q.toLowerCase())));
    } else {
      try {
        const res = await apiFetch<User[]>("GET", `/api/users/search?q=${encodeURIComponent(q)}`);
        setSpeakerResults((res || []).filter((u) => u.id !== user.id));
      } catch {
        setSpeakerResults(DEMO_ALL_USERS.filter((u) => u.id !== user.id && u.full_name.toLowerCase().includes(q.toLowerCase())));
      }
    }
  };
  const assignSpeaker = async (userId: string, eventId: string) => {
    setMemberships((prev) => [...prev, { user_id: userId, event_id: eventId, context_role: "SPEAKER" as const }]);
    if (!demoMode) {
      try { await apiFetch("POST", `/api/events/${eventId}/curators`, { user_id: userId }); } catch (e: any) { console.warn("API speaker assign:", e?.message); }
    }
    setShowAssignSpeaker("");
    setSpeakerSearch("");
    setSpeakerResults([]);
  };

  // ═══ МОЙ ДОКЛАД (спикер) ═══
  // Список всех докладов спикера (может быть несколько мероприятий)
  const [myReports, setMyReports] = useState<any[]>([]);
  const [myReportLoading, setMyReportLoading] = useState(false);
  // Текущий выбранный доклад
  const [myReport, setMyReport] = useState<any>(null);
  const [myReportConfirmed, setMyReportConfirmed] = useState(false);
  const [myReportFormat, setMyReportFormat] = useState<string>("");
  const [myReportSaving, setMyReportSaving] = useState(false);
  const [myReportSaved, setMyReportSaved] = useState(false);
  // Комментарии и оценки — per report id
  const [myReportComments, setMyReportComments] = useState<Record<string, any[]>>({});
  const [myReportFeedback, setMyReportFeedback] = useState<Record<string, { average: number; count: number }>>({});
  const [myReportAnswerText, setMyReportAnswerText] = useState<Record<string, string>>({});
  const [myReportAnswering, setMyReportAnswering] = useState<string>("");

  const selectMyReport = (r: any) => {
    setMyReport(r);
    setMyReportConfirmed(r.speaker_confirmed ?? false);
    setMyReportFormat(r.presentation_format || "");
    setMyReportSaved(false);
  };

  useEffect(() => {
    if (tab !== "my_report" || !isSpeaker) return;
    setMyReportLoading(true);
    if (demoMode) {
      const demoReps = [
        { id: "r1", title: "Угрозы безопасности 2026", section_id: "s1", speaker_confirmed: true, presentation_format: "OFFLINE", description: "Обзор актуальных угроз", start_time: "2026-03-19T10:00:00Z" },
        { id: "r2", title: "ML в продакшне", section_id: "s2", speaker_confirmed: false, presentation_format: "ONLINE", description: "Практические кейсы", start_time: "2026-03-19T14:00:00Z" },
      ];
      setMyReports(demoReps);
      selectMyReport(demoReps[0]);
      setMyReportComments({
        r1: [
          { id: "c1", author_name: "Иван Участников", text: "Будут ли слайды после доклада?", created_at: new Date().toISOString() },
          { id: "c2", author_name: "Анна Петрова", text: "Планируете ли демо?", created_at: new Date().toISOString() },
        ],
        r2: [],
      });
      setMyReportFeedback({ r1: { average: 4.2, count: 8 }, r2: { average: 0, count: 0 } });
      setMyReportLoading(false);
      return;
    }
    (async () => {
      try {
        const token = localStorage.getItem("access_token") || "";
        const reports = await apiFetch<any[]>("GET", "/api/reports/my");
        const reps = reports || [];
        setMyReports(reps);
        if (reps.length) selectMyReport(reps[0]);

        // Load comments + feedback for all reports in parallel
        const comsMap: Record<string, any[]> = {};
        const fbMap: Record<string, { average: number; count: number }> = {};
        await Promise.all(reps.map(async (r: any) => {
          try {
            const cr = await fetch(`http://localhost:8000/api/reports/${r.id}/comments`, {
              headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
            });
            comsMap[r.id] = cr.ok ? await cr.json() : [];
          } catch { comsMap[r.id] = []; }
          try {
            const fr = await fetch(`http://localhost:8000/api/reports/${r.id}/feedback`, {
              headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
            });
            if (fr.ok) { const d = await fr.json(); fbMap[r.id] = { average: d.average || 0, count: d.count || 0 }; }
            else fbMap[r.id] = { average: 0, count: 0 };
          } catch { fbMap[r.id] = { average: 0, count: 0 }; }
        }));
        setMyReportComments(comsMap);
        setMyReportFeedback(fbMap);
      } catch {}
      finally { setMyReportLoading(false); }
    })();
  }, [tab, isSpeaker, demoMode]);

  const saveMyReport = async () => {
    if (!myReport) return;
    setMyReportSaving(true); setMyReportSaved(false);
    if (demoMode) {
      setMyReport((prev: any) => ({ ...prev, speaker_confirmed: myReportConfirmed, presentation_format: myReportFormat }));
      setMyReportSaving(false); setMyReportSaved(true);
      setTimeout(() => setMyReportSaved(false), 3000);
      return;
    }
    try {
      await apiFetch("PATCH", `/api/reports/${myReport.id}`, { speaker_confirmed: myReportConfirmed, presentation_format: myReportFormat || null });
      setMyReportSaved(true); setTimeout(() => setMyReportSaved(false), 3000);
    } catch (e: any) { alert(e?.message || "Ошибка"); }
    finally { setMyReportSaving(false); }
  };

  const answerMyReportComment = async (commentId: string, reportId: string) => {
    const text = (myReportAnswerText[commentId] || "").trim();
    if (!text) return;
    setMyReportAnswering(commentId);
    const updateComs = (prev: Record<string, any[]>) => ({
      ...prev,
      [reportId]: (prev[reportId] || []).map((c: any) =>
        c.id === commentId ? { ...c, answer_text: text, answer_by_name: user.full_name } : c
      )
    });
    if (demoMode) {
      setMyReportComments(updateComs);
      setMyReportAnswerText(prev => ({ ...prev, [commentId]: "" }));
      setMyReportAnswering("");
      return;
    }
    try {
      const saved = await apiFetch<any>("PUT", `/api/comments/${commentId}/answer`, { text });
      setMyReportComments(prev => ({ ...prev, [reportId]: (prev[reportId] || []).map((c: any) => c.id === commentId ? saved : c) }));
      setMyReportAnswerText(prev => ({ ...prev, [commentId]: "" }));
    } catch (e: any) { alert(e?.message || "Ошибка"); }
    finally { setMyReportAnswering(""); }
  };

  // ═══ ВОПРОСЫ КУРАТОРА ═══
  const [qSections, setQSections] = useState<any[]>([]);
  const [qReports, setQReports] = useState<Record<string, any[]>>({});
  const [qComments, setQComments] = useState<Record<string, any[]>>({});
  const [qExpanded, setQExpanded] = useState<Set<string>>(new Set());
  const [qAnswerText, setQAnswerText] = useState<Record<string, string>>({});
  const [qAnswering, setQAnswering] = useState<string>("");
  const [qLoading, setQLoading] = useState(false);

  const loadQuestions = async () => {
    if (demoMode) {
      // Demo: показываем демо комментарии
      setQSections([{ id: "s1", title: "Секция ИнфоБез", event_id: "e1" }]);
      setQReports({ s1: [{ id: "r1", title: "Угрозы безопасности 2026", section_id: "s1" }] });
      setQComments({ r1: [
        { id: "c1", report_id: "r1", author_name: "Иван Участников", text: "Как защититься от MITM?", created_at: new Date().toISOString() },
        { id: "c2", report_id: "r1", author_name: "Анна Петрова", text: "Будут ли слайды доступны?", created_at: new Date().toISOString(), answer_text: "Выложим вечером", answer_by_name: "Куратор" },
      ]});
      return;
    }
    setQLoading(true);
    try {
      // Загружаем секции куратора
      const token = localStorage.getItem("access_token") || "";
      const evRes = await apiFetch<any[]>("GET", "/api/events/");
      const allSecs: any[] = [];
      for (const ev of evRes || []) {
        try {
          const secsRes = await apiFetch<any[]>("GET", `/api/events/${ev.id}/sections`);
          for (const sec of secsRes || []) {
            if (sec.curator_id === user.id || curatorEventIds.includes(ev.id)) allSecs.push(sec);
          }
        } catch {}
      }
      setQSections(allSecs);
      // Загружаем доклады и комментарии
      const repsMap: Record<string, any[]> = {};
      const cmmMap: Record<string, any[]> = {};
      for (const sec of allSecs) {
        try {
          const r = await fetch(`http://localhost:8000/api/sections/${sec.id}/reports`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
          const reps = r.ok ? await r.json() : [];
          repsMap[sec.id] = reps;
          for (const rep of reps) {
            try {
              const cr = await fetch(`http://localhost:8000/api/reports/${rep.id}/comments`, { cache: "no-store" });
              cmmMap[rep.id] = cr.ok ? await cr.json() : [];
            } catch { cmmMap[rep.id] = []; }
          }
        } catch { repsMap[sec.id] = []; }
      }
      setQReports(repsMap);
      setQComments(cmmMap);
    } catch {}
    finally { setQLoading(false); }
  };

  const submitAnswer = async (commentId: string, reportId: string) => {
    const text = (qAnswerText[commentId] || "").trim();
    if (!text) return;
    setQAnswering(commentId);
    if (demoMode) {
      setQComments(prev => ({ ...prev, [reportId]: (prev[reportId]||[]).map(c => c.id === commentId ? { ...c, answer_text: text, answer_by_name: user.full_name } : c) }));
      setQAnswerText(prev => ({ ...prev, [commentId]: "" }));
      setQAnswering("");
      return;
    }
    try {
      const saved = await apiFetch<any>("PUT", `/api/comments/${commentId}/answer`, { text });
      setQComments(prev => ({ ...prev, [reportId]: (prev[reportId]||[]).map(c => c.id === commentId ? saved : c) }));
      setQAnswerText(prev => ({ ...prev, [commentId]: "" }));
    } catch (e: any) { alert(e?.message || "Ошибка"); }
    setQAnswering("");
  };

  useEffect(() => {
    if (tab === "questions" && isCurator) loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isCurator, demoMode]);

  // ═══ ИТОГОВЫЙ ОТЧЁТ ═══
  const [frSectionId, setFrSectionId] = useState("");
  const [frText, setFrText] = useState("");
  const [frSaving, setFrSaving] = useState(false);
  const [frSaved, setFrSaved] = useState(false);
  const [frSections, setFrSections] = useState<any[]>([]);

  useEffect(() => {
    if (tab !== "final_report" || !isCurator) return;
    if (demoMode) { setFrSections(DEMO_SECTIONS_PROGRAM["e1"] || []); return; }
    (async () => {
      try {
        const evRes = await apiFetch<any[]>("GET", "/api/events/");
        const secs: any[] = [];
        for (const ev of evRes || []) {
          try {
            const token = localStorage.getItem("access_token") || "";
            const r = await fetch(`http://localhost:8000/api/events/${ev.id}/curators`, { headers: { Authorization: `Bearer ${token}` } });
            if (r.ok) {
              const ms: any[] = await r.json();
              if (ms.some((m: any) => m.user_id === user.id)) {
                const sr = await apiFetch<any[]>("GET", `/api/events/${ev.id}/sections`);
                (sr || []).forEach(s => secs.push(s));
              }
            }
          } catch {}
        }
        setFrSections(secs);
        if (secs.length > 0 && !frSectionId) setFrSectionId(secs[0].id);
      } catch {}
    })();
  }, [tab, isCurator, demoMode]);

  const saveFinalReport = async () => {
    if (!frText.trim() || !frSectionId) return;
    setFrSaving(true); setFrSaved(false);
    if (demoMode) { setFrSaving(false); setFrSaved(true); setTimeout(() => setFrSaved(false), 3000); return; }
    try {
      await apiFetch("POST", `/api/sections/${frSectionId}/curator-report`, { text: frText.trim() });
      setFrSaved(true); setTimeout(() => setFrSaved(false), 3000);
    } catch (e: any) { alert(e?.message || "Ошибка сохранения"); }
    finally { setFrSaving(false); }
  };

  const roleLabel = isCurator ? "КУРАТОР СЕКЦИИ" : isSpeaker ? "СПИКЕР" : "УЧАСТНИК";
  const roleColor = isCurator ? "#6b7280" : isSpeaker ? "#d97706" : "#16a34a";
  const roleBg = isCurator ? "#f3f4f6" : isSpeaker ? "#fffbeb" : "#f0fdf4";

  const navItems: { id: string; icon: string; label: string }[] = [
    { id: "program", icon: "📋", label: "Программа" },
    ...(isCurator ? [{ id: "sections", icon: "🗂️", label: "Мои секции" }] : []),
    ...(isSpeaker ? [{ id: "my_report", icon: "🎤", label: "Мой доклад" }] : []),
    { id: "kanban", icon: "📌", label: "Канбан задач" },
    { id: "schedule", icon: "📅", label: "Моё расписание" },
    ...(isCurator ? [{ id: "questions", icon: "💬", label: "Вопросы" }] : []),
    ...(isCurator ? [{ id: "final_report", icon: "📝", label: "Итоговый отчёт" }] : []),
    { id: "chat", icon: "💬", label: "Чат" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ];

  return (
    <div>
      <TopBar user={user} onLogout={onLogout} />
      <div className="dashboard-wrapper">
      <aside className="dashboard-sidebar">
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: roleColor, color: "white", fontSize: 26, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
            {user.full_name[0]}
          </div>
          <h5 style={{ marginTop: 10, marginBottom: 4, fontWeight: 800, fontSize: 15 }}>{user.full_name}</h5>
          <span style={{ display: "inline-block", padding: "3px 10px", background: roleBg, color: roleColor, borderRadius: 100, fontSize: 11, fontWeight: 800 }}>{roleLabel}</span>
          {user.organization && <p style={{ fontSize: 11, color: "#777", marginTop: 5 }}>{user.organization}</p>}
          {demoMode && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginTop: 3 }}>DEMO</div>}
        </div>
        <nav className="sidebar-nav-list">
          {navItems.map((i) => (
            <button key={i.id} className="nav-link" style={{ background: tab === i.id ? roleBg : "#f1f5f9", color: tab === i.id ? roleColor : "#475569" }} onClick={() => setTab(i.id as any)}>
              <span style={{ marginRight: 8 }}>{i.icon}</span>{i.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="dashboard-main-content">
        {loading ? <Spinner /> : (
          <>
            {tab === "program" && (
              <ProgramTab
                events={events}
                regs={regs}
                onRegister={register}
                demoMode={demoMode}
                userId={user.id}
              />
            )}

            {/* ═══ TAB: МОИ СЕКЦИИ (только куратор) ═══ */}
            {tab === "sections" && isCurator && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", margin: 0 }}>🗂️ Мои секции</h1>
                  <button onClick={() => setSecModal({ open: true, eventId: myEventIdRef.current || myEventIdForSec })}
                    style={{ padding: "9px 20px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                    ✚ Новая секция
                  </button>
                </div>

                {secLoading && <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Загрузка секций...</div>}
                {secError && <div style={{ background: "#fef2f2", color: "#dc2626", padding: 14, borderRadius: 10, marginBottom: 16 }}>{secError}</div>}

                {!secLoading && curSections.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "var(--primary-dark)", marginBottom: 8 }}>Секций пока нет</div>
                    <div style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>Создайте первую секцию или дождитесь назначения от организатора</div>
                    <button onClick={() => setSecModal({ open: true, eventId: myEventIdRef.current || myEventIdForSec })}
                      style={{ padding: "12px 28px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                      ✚ Создать первую секцию
                    </button>
                  </div>
                )}

                {curSections.map((sec: any) => {
                  const reps: any[] = curReports[sec.id] || [];
                  return (
                    <div key={sec.id} style={{ background: "white", borderRadius: 16, border: "1.5px solid var(--border)", marginBottom: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(74,89,138,0.07)" }}>
                      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#f8fbff" }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16, color: "var(--primary-dark)" }}>📌 {sec.title}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {sec.location && <span>📍 {sec.location}</span>}
                            {sec.format && <span>📌 {sec.format}</span>}
                            {sec.section_start && <span>🕐 {new Date(sec.section_start).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setSecModal({ open: true, section: sec, eventId: sec.event_id })}
                            style={{ padding: "5px 12px", background: "var(--bg-medium)", color: "var(--primary)", border: "1px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>✏️ Изменить</button>
                          <button onClick={() => setDelSecTarget(sec)}
                            style={{ padding: "5px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>🗑</button>
                        </div>
                      </div>
                      <div style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#475569" }}>Доклады ({reps.length})</span>
                          <button onClick={() => setRepModal({ open: true, sectionId: sec.id })}
                            style={{ padding: "5px 12px", background: "#ecfdf5", color: "#10b981", border: "1px solid #a7f3d0", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ Добавить доклад</button>
                        </div>
                        {reps.length === 0 ? (
                          <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Докладов нет</div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {reps.map((r: any) => (
                              <div key={r.id} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)" }}>{r.title}</div>
                                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                                    {r.start_time && <span>🕐 {new Date(r.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>}
                                    {r.presentation_format && <span style={{ padding: "1px 7px", borderRadius: 100, background: "#e8f0fe", color: "var(--primary)", fontSize: 10, fontWeight: 800 }}>{r.presentation_format}</span>}
                                    {r.speaker_id ? <span style={{ color: r.speaker_confirmed ? "#16a34a" : "#92400e" }}>🎤 {r.speaker_name || "Спикер"} {r.speaker_confirmed ? "✅" : "⏳"}</span> : <span style={{ color: "#dc2626" }}>🎤 Спикер не назначен</span>}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => setSecAssignSpeaker(r)}
                                    style={{ padding: "4px 10px", background: "var(--bg-medium)", color: "var(--primary)", border: "1px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 10, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                    🎤 {r.speaker_id ? "Сменить" : "Спикер"}</button>
                                  <button onClick={() => setRepModal({ open: true, report: r, sectionId: sec.id })}
                                    style={{ padding: "4px 8px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 10, cursor: "pointer" }}>✏️</button>
                                  <button onClick={() => setDelRepTarget(r)}
                                    style={{ padding: "4px 8px", background: "#fef2f2", color: "#dc2626", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 10, cursor: "pointer" }}>🗑</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* ── МОДАЛКИ ── */}
                {secModal.open && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
                    <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)", maxHeight: "90vh", overflowY: "auto" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                        <h3 style={{ fontWeight: 900, margin: 0, fontSize: 16 }}>{secModal.section ? "Редактировать секцию" : "Новая секция"}</h3>
                        <button onClick={() => setSecModal({ open: false, eventId: "" })} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button>
                      </div>
                      {(() => {
                        const s = secModal.section;
                        const iStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box", outline: "none", marginBottom: 10 };
                        const lStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 };
                        return (
                          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const form: any = {}; ["title","format","location","section_start","section_end","tech_notes"].forEach(k => { const v = fd.get(k); if (v) form[k] = String(v); }); saveSec(form); }}>
                            <label style={lStyle}>Название *</label>
                            <input name="title" required defaultValue={s?.title || ""} autoFocus style={iStyle} placeholder="Название секции" />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <div><label style={lStyle}>Формат</label>
                                <select name="format" defaultValue={s?.format || ""} style={iStyle}>
                                  <option value="">Не выбран</option><option value="SEQUENTIAL">Последовательный</option><option value="ROUNDTABLE">Круглый стол</option><option value="PANEL">Панельная дискуссия</option><option value="WORKSHOP">Воркшоп</option>
                                </select></div>
                              <div><label style={lStyle}>Локация</label><input name="location" defaultValue={s?.location || ""} style={iStyle} placeholder="Зал A..." /></div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <div><label style={lStyle}>Начало</label><input type="datetime-local" name="section_start" defaultValue={s?.section_start ? String(s.section_start).slice(0,16) : ""} style={iStyle} /></div>
                              <div><label style={lStyle}>Конец</label><input type="datetime-local" name="section_end" defaultValue={s?.section_end ? String(s.section_end).slice(0,16) : ""} style={iStyle} /></div>
                            </div>
                            <label style={lStyle}>Технические заметки</label>
                            <textarea name="tech_notes" defaultValue={s?.tech_notes || ""} rows={3} style={{ ...iStyle, resize: "vertical" }} />
                            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                              <button type="submit" style={{ flex: 1, padding: 11, background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>{secModal.section ? "Сохранить" : "Создать секцию"}</button>
                              <button type="button" onClick={() => setSecModal({ open: false, eventId: "" })} style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Отмена</button>
                            </div>
                          </form>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {repModal.open && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
                    <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #10b981", maxHeight: "90vh", overflowY: "auto" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                        <h3 style={{ fontWeight: 900, margin: 0, fontSize: 16 }}>{repModal.report ? "Редактировать доклад" : "Новый доклад"}</h3>
                        <button onClick={() => setRepModal({ open: false, sectionId: "" })} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button>
                      </div>
                      {(() => {
                        const r = repModal.report;
                        const iStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box", outline: "none", marginBottom: 10 };
                        const lStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3 };
                        return (
                          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const form: any = {}; ["title","description","presentation_format","start_time","end_time"].forEach(k => { const v = fd.get(k); if (v) form[k] = String(v); }); saveRep(form); }}>
                            <label style={lStyle}>Название *</label>
                            <input name="title" required defaultValue={r?.title || ""} autoFocus style={iStyle} placeholder="Название доклада" />
                            <label style={lStyle}>Описание</label>
                            <textarea name="description" defaultValue={r?.description || ""} rows={3} style={{ ...iStyle, resize: "vertical" }} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <div><label style={lStyle}>Начало</label><input type="datetime-local" name="start_time" defaultValue={r?.start_time ? String(r.start_time).slice(0,16) : ""} style={iStyle} /></div>
                              <div><label style={lStyle}>Конец</label><input type="datetime-local" name="end_time" defaultValue={r?.end_time ? String(r.end_time).slice(0,16) : ""} style={iStyle} /></div>
                            </div>
                            <label style={lStyle}>Формат</label>
                            <select name="presentation_format" defaultValue={r?.presentation_format || ""} style={iStyle}>
                              <option value="">Не выбран</option><option value="OFFLINE">Офлайн</option><option value="ONLINE">Онлайн</option>
                            </select>
                            <div style={{ display: "flex", gap: 10 }}>
                              <button type="submit" style={{ flex: 1, padding: 11, background: "#10b981", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>{repModal.report ? "Сохранить" : "Создать доклад"}</button>
                              <button type="button" onClick={() => setRepModal({ open: false, sectionId: "" })} style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Отмена</button>
                            </div>
                          </form>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {delSecTarget && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100 }}>
                    <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #ef4444" }}>
                      <h3 style={{ fontWeight: 900, margin: "0 0 10px", color: "#991b1b" }}>🗑 Удалить секцию?</h3>
                      <p style={{ fontSize: 14, color: "#475569", marginBottom: 22 }}>«{delSecTarget.title}» и все её доклады будут удалены.</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => deleteSec(delSecTarget)} style={{ flex: 1, padding: 11, background: "#ef4444", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Удалить</button>
                        <button onClick={() => setDelSecTarget(null)} style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Отмена</button>
                      </div>
                    </div>
                  </div>
                )}

                {delRepTarget && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100 }}>
                    <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid #ef4444" }}>
                      <h3 style={{ fontWeight: 900, margin: "0 0 10px", color: "#991b1b" }}>🗑 Удалить доклад?</h3>
                      <p style={{ fontSize: 14, color: "#475569", marginBottom: 22 }}>«{delRepTarget.title}» будет удалён.</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => deleteRep(delRepTarget)} style={{ flex: 1, padding: 11, background: "#ef4444", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Удалить</button>
                        <button onClick={() => setDelRepTarget(null)} style={{ flex: 1, padding: 11, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Отмена</button>
                      </div>
                    </div>
                  </div>
                )}

                {secAssignSpeaker && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
                    <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 900, margin: 0, fontSize: 16 }}>🎤 Назначить спикера</h3>
                        <button onClick={() => { setSecAssignSpeaker(null); setSecAssignSearch(""); setSecAssignResults([]); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button>
                      </div>
                      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>Доклад: «{secAssignSpeaker.title}»</p>
                      <input type="text" placeholder="Поиск по ФИО (мин. 2 символа)..." value={secAssignSearch} onChange={e => searchSecSpeakers(e.target.value)} autoFocus
                        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box", fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 12 }} />
                      {secAssignResults.length > 0 && (
                        <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                          {secAssignResults.map((u: User) => (
                            <div key={u.id} onClick={() => assignSecSpeaker(u)}
                              style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}
                              onMouseOver={e => (e.currentTarget.style.background = "#f0f7ff")} onMouseOut={e => (e.currentTarget.style.background = "white")}>
                              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{u.full_name[0]}</div>
                              <div><div style={{ fontWeight: 700, fontSize: 14 }}>{u.full_name}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email}</div></div>
                            </div>
                          ))}
                        </div>
                      )}
                      {secAssignSearch.length >= 2 && secAssignResults.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Никого не найдено</div>}
                    </div>
                  </div>
                )}
              </div>
            )}

                        {/* ═══ МОЙ ДОКЛАД (спикер) ═══ */}
            {tab === "my_report" && isSpeaker && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>🎤 Мой доклад</h1>

                {myReportLoading && <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Загрузка...</div>}

                {!myReportLoading && myReports.length === 0 && (
                  <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🎤</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>Вам пока не назначен доклад</div>
                    <div style={{ fontSize: 13, marginTop: 8 }}>Свяжитесь с куратором секции</div>
                  </div>
                )}

                {!myReportLoading && myReports.length > 0 && (
                  <div style={{ display: "grid", gap: 20 }}>

                    {/* ── Переключатель докладов (если несколько) ── */}
                    {myReports.length > 1 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {myReports.map((r: any) => (
                          <button key={r.id} onClick={() => selectMyReport(r)}
                            style={{ padding: "8px 18px", borderRadius: 100, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", border: "2px solid", transition: "all 0.15s",
                              borderColor: myReport?.id === r.id ? "var(--primary)" : "var(--border)",
                              background: myReport?.id === r.id ? "#e8f0fe" : "white",
                              color: myReport?.id === r.id ? "var(--primary)" : "#64748b" }}>
                            {r.title.length > 30 ? r.title.slice(0, 30) + "…" : r.title}
                            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>{r.speaker_confirmed ? "✅" : "⏳"}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {myReport && (<>
                    {/* ── Карточка доклада ── */}
                    <div style={{ background: "white", borderRadius: 16, border: "1.5px solid var(--border)", overflow: "hidden", boxShadow: "0 2px 12px rgba(74,89,138,0.08)" }}>
                      <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #f0f7ff 0%, #e8f0fe 100%)", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Ваш доклад</div>
                        <div style={{ fontWeight: 900, fontSize: 20, color: "var(--primary-dark)", marginBottom: 8 }}>{myReport.title}</div>
                        {myReport.description && <div style={{ fontSize: 14, color: "#475569" }}>{myReport.description}</div>}
                        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                          {myReport.start_time && (
                            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                              🕐 {new Date(myReport.start_time).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              {myReport.end_time && ` — ${new Date(myReport.end_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`}
                            </span>
                          )}
                          <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 100, fontWeight: 800, background: myReport.speaker_confirmed ? "#f0fdf4" : "#fffbeb", color: myReport.speaker_confirmed ? "#16a34a" : "#d97706" }}>
                            {myReport.speaker_confirmed ? "✅ Подтверждён" : "⏳ Ожидает подтверждения"}
                          </span>
                          {/* Средняя оценка */}
                          {myReportFeedback[myReport.id]?.count > 0 && (
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b" }}>
                              ★ {myReportFeedback[myReport.id].average.toFixed(1)}
                              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginLeft: 4 }}>
                                ({myReportFeedback[myReport.id].count} оценок)
                              </span>
                            </span>
                          )}
                          {myReportFeedback[myReport.id]?.count === 0 && (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>Оценок пока нет</span>
                          )}
                        </div>
                      </div>

                      {/* ── Форма подтверждения ── */}
                      <div style={{ padding: "20px 24px" }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)", marginBottom: 14 }}>Статус участия</div>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 8 }}>Вы подтверждаете участие?</label>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setMyReportConfirmed(true)}
                              style={{ padding: "9px 20px", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", border: "2px solid", borderColor: myReportConfirmed ? "#16a34a" : "var(--border)", background: myReportConfirmed ? "#f0fdf4" : "white", color: myReportConfirmed ? "#16a34a" : "#64748b" }}>
                              ✅ Подтверждаю
                            </button>
                            <button onClick={() => setMyReportConfirmed(false)}
                              style={{ padding: "9px 20px", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", border: "2px solid", borderColor: !myReportConfirmed ? "#dc2626" : "var(--border)", background: !myReportConfirmed ? "#fef2f2" : "white", color: !myReportConfirmed ? "#dc2626" : "#64748b" }}>
                              ❌ Не смогу
                            </button>
                          </div>
                        </div>
                        <div style={{ marginBottom: 20 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 8 }}>Формат участия</label>
                          <div style={{ display: "flex", gap: 10 }}>
                            {(["OFFLINE", "ONLINE"] as const).map(fmt => (
                              <button key={fmt} onClick={() => setMyReportFormat(fmt)}
                                style={{ padding: "9px 20px", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", border: "2px solid", borderColor: myReportFormat === fmt ? "var(--primary)" : "var(--border)", background: myReportFormat === fmt ? "#e8f0fe" : "white", color: myReportFormat === fmt ? "var(--primary)" : "#64748b" }}>
                                {fmt === "OFFLINE" ? "🏛 Офлайн" : "💻 Онлайн"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {myReportSaved && (
                          <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontWeight: 700, fontSize: 13 }}>
                            Изменения сохранены!
                          </div>
                        )}
                        <button onClick={saveMyReport} disabled={myReportSaving}
                          style={{ padding: "11px 28px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: myReportSaving ? "not-allowed" : "pointer", opacity: myReportSaving ? 0.7 : 1, fontFamily: "Nunito, sans-serif" }}>
                          {myReportSaving ? "Сохранение..." : "💾 Сохранить"}
                        </button>
                      </div>
                    </div>

                    {/* ── Вопросы участников ── */}
                    <div style={{ background: "white", borderRadius: 16, border: "1.5px solid var(--border)", overflow: "hidden", boxShadow: "0 2px 12px rgba(74,89,138,0.08)" }}>
                      <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "#fafbfc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "var(--primary-dark)" }}>
                          💬 Вопросы участников
                          <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, color: "#64748b" }}>({(myReportComments[myReport.id] || []).length})</span>
                          {(myReportComments[myReport.id] || []).filter((c: any) => !c.answer_text).length > 0 && (
                            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: "#dc2626" }}>
                              · {(myReportComments[myReport.id] || []).filter((c: any) => !c.answer_text).length} без ответа
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: "16px 24px" }}>
                        {(myReportComments[myReport.id] || []).length === 0 ? (
                          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                            Вопросов пока нет — они появятся здесь когда участники начнут задавать
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 14 }}>
                            {(myReportComments[myReport.id] || []).map((c: any) => (
                              <div key={c.id} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--primary-dark)" }}>{c.author_name || "Участник"}</span>
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(c.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                                <div style={{ fontSize: 14, color: "#334155", padding: "8px 12px", background: "#f8fafc", borderRadius: 8, marginBottom: 10 }}>{c.text}</div>
                                {c.answer_text && (
                                  <div style={{ padding: "10px 14px", background: "#eef6ff", borderRadius: 10, borderLeft: "3px solid var(--primary)", marginBottom: 8 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", marginBottom: 4 }}>Ваш ответ</div>
                                    <div style={{ fontSize: 13, color: "#334155" }}>{c.answer_text}</div>
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 8 }}>
                                  <input type="text"
                                    placeholder={c.answer_text ? "Изменить ответ..." : "Ответить на вопрос..."}
                                    value={myReportAnswerText[c.id] || ""}
                                    onChange={e => setMyReportAnswerText(prev => ({ ...prev, [c.id]: e.target.value }))}
                                    onKeyDown={e => e.key === "Enter" && answerMyReportComment(c.id, myReport.id)}
                                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                                  <button onClick={() => answerMyReportComment(c.id, myReport.id)}
                                    disabled={myReportAnswering === c.id || !(myReportAnswerText[c.id]||"").trim()}
                                    style={{ padding: "8px 14px", background: c.answer_text ? "#f59e0b" : "var(--primary)", color: "white", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif", opacity: (myReportAnswering === c.id || !(myReportAnswerText[c.id]||"").trim()) ? 0.5 : 1, whiteSpace: "nowrap" }}>
                                    {myReportAnswering === c.id ? "..." : c.answer_text ? "Обновить" : "Ответить"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    </>)}

                  </div>
                )}
              </div>
            )}


            {/* ═══ TAB: КАНБАН ═══ */}
            {tab === "kanban" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)" }}>📌 Канбан задач</h1>
                  <select value={selEv} onChange={(e) => setSelEv(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", fontWeight: 700, outline: "none", minWidth: 200 }}>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>

                {selEvent && (
                  <div style={{ background: "white", borderRadius: 12, padding: "12px 18px", marginBottom: 16, border: "1.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)" }}>{selEvent.title}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: pct(selEv) >= 75 ? "#16a34a" : "#d97706" }}>
                      Готовность: {pct(selEv)}% · Задач: {filtered.length}
                    </span>
                  </div>
                )}

                {/* Добавить задачу */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <input type="text" placeholder="Новая задача..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} style={{ flex: 2, minWidth: 180, padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                  {isCurator && (
                    <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", minWidth: 160 }}>
                      <option value="">Назначить на...</option>
                      {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  )}
                  <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                  <button onClick={addTask} style={{ padding: "10px 22px", background: roleColor, color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap" }}>+ Добавить</button>
                </div>

                <div className="kanban-board">
                  {(["TODO", "IN_PROGRESS", "DONE"] as TaskStatus[]).map((status) => {
                    const col = COL_CFG[status];
                    const colTasks = filtered.filter((t) => t.status === status);
                    return (
                      <div key={status} className="kanban-col">
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: col.color, display: "flex", alignItems: "center", gap: 6 }}>
                          {col.icon} {col.label}
                          <span style={{ marginLeft: "auto", background: "white", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 900, color: col.color }}>{colTasks.length}</span>
                        </div>
                        {colTasks.map((task) => (
                          <div key={task.id} className="kanban-card">
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "var(--primary-dark)" }}>{task.title}</div>
                            {task.assigned_to_name && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>👤 {task.assigned_to_name}</div>}
                            {task.due_date && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>📅 {task.due_date}</div>}
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {status === "TODO" && <button onClick={() => moveTask(task.id, "IN_PROGRESS")} style={{ padding: "4px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#d97706" }}>🔧 В работу</button>}
                              {status === "IN_PROGRESS" && (
                                <>
                                  <button onClick={() => moveTask(task.id, "DONE")} style={{ padding: "4px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#16a34a" }}>✅ Готово</button>
                                  <button onClick={() => moveTask(task.id, "TODO")} style={{ padding: "4px 10px", background: "#f1f5f9", border: "1px solid var(--border)", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#64748b" }}>← Назад</button>
                                </>
                              )}
                              {status === "DONE" && <button onClick={() => moveTask(task.id, "IN_PROGRESS")} style={{ padding: "4px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#d97706" }}>🔄 Вернуть</button>}
                              {(isCurator || task.created_by === user.id) && <button onClick={() => delTask(task.id)} style={{ padding: "4px 8px", background: "#fff1f1", border: "1px solid #fecaca", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#ef4444", marginLeft: "auto" }}>✕</button>}
                            </div>
                          </div>
                        ))}
                        {colTasks.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#ccc", fontSize: 13, fontWeight: 600 }}>Пусто</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "schedule" && (
              <ScheduleTab demoMode={demoMode} regs={regs} events={events} />
            )}

                        {/* ═══ ВОПРОСЫ УЧАСТНИКОВ (только куратор) ═══ */}
            {tab === "questions" && isCurator && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", margin: 0 }}>💬 Вопросы участников</h1>
                  <button onClick={loadQuestions} style={{ padding: "8px 16px", background: "var(--bg-medium)", color: "var(--primary)", border: "1px solid var(--border)", borderRadius: 100, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>🔄 Обновить</button>
                </div>
                {qLoading && <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Загрузка...</div>}
                {!qLoading && qSections.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                    <div style={{ fontWeight: 700 }}>Вопросов пока нет</div>
                  </div>
                )}
                {qSections.map((sec: any) => {
                  const reps = qReports[sec.id] || [];
                  return (
                    <div key={sec.id} style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--primary)", marginBottom: 10 }}>📌 {sec.title}</div>
                      {reps.map((rep: any) => {
                        const coms = qComments[rep.id] || [];
                        const unanswered = coms.filter((c: any) => !c.answer_text).length;
                        const isExp = qExpanded.has(rep.id);
                        return (
                          <div key={rep.id} style={{ background: "white", borderRadius: 14, border: "1.5px solid var(--border)", marginBottom: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(74,89,138,0.06)" }}>
                            <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fbff", borderBottom: "1px solid var(--border)" }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)" }}>🎤 {rep.title}</div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                                  {coms.length} вопрос{coms.length === 1 ? "" : coms.length < 5 ? "а" : "ов"}
                                  {unanswered > 0 && <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 700 }}>· {unanswered} без ответа</span>}
                                </div>
                              </div>
                              <button onClick={() => setQExpanded(prev => { const n = new Set(prev); isExp ? n.delete(rep.id) : n.add(rep.id); return n; })}
                                style={{ padding: "6px 14px", background: isExp ? "#e8f0fe" : "var(--primary)", color: isExp ? "var(--primary)" : "white", border: "none", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                {isExp ? "Скрыть ↑" : `Показать (${coms.length}) ↓`}
                              </button>
                            </div>
                            {isExp && (
                              <div style={{ padding: "14px 18px" }}>
                                {coms.length === 0 ? (
                                  <div style={{ color: "#94a3b8", fontSize: 13 }}>Вопросов нет</div>
                                ) : coms.map((c: any) => (
                                  <div key={c.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--primary-dark)" }}>{c.author_name || "Участник"}</span>
                                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(c.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                    <div style={{ fontSize: 14, color: "#334155", marginBottom: 10, padding: "8px 12px", background: "#f8fafc", borderRadius: 8 }}>{c.text}</div>
                                    {c.answer_text && (
                                      <div style={{ padding: "10px 14px", background: "#eef6ff", borderRadius: 10, borderLeft: "3px solid var(--primary)", marginBottom: 8 }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)", marginBottom: 4 }}>Ответ {c.answer_by_name ? `· ${c.answer_by_name}` : ""}</div>
                                        <div style={{ fontSize: 13, color: "#334155" }}>{c.answer_text}</div>
                                      </div>
                                    )}
                                    <div style={{ display: "flex", gap: 8 }}>
                                      <input type="text"
                                        placeholder={c.answer_text ? "Изменить ответ..." : "Написать ответ..."}
                                        value={qAnswerText[c.id] || ""}
                                        onChange={e => setQAnswerText(prev => ({ ...prev, [c.id]: e.target.value }))}
                                        onKeyDown={e => e.key === "Enter" && submitAnswer(c.id, rep.id)}
                                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                                      <button onClick={() => submitAnswer(c.id, rep.id)}
                                        disabled={qAnswering === c.id || !(qAnswerText[c.id]||"").trim()}
                                        style={{ padding: "8px 14px", background: c.answer_text ? "#f59e0b" : "var(--primary)", color: "white", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif", opacity: (qAnswering === c.id || !(qAnswerText[c.id]||"").trim()) ? 0.5 : 1, whiteSpace: "nowrap" }}>
                                        {qAnswering === c.id ? "..." : c.answer_text ? "Обновить" : "Ответить"}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {reps.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Докладов в секции нет</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ ИТОГОВЫЙ ОТЧЁТ (только куратор) ═══ */}
            {tab === "final_report" && isCurator && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 8 }}>📝 Итоговый отчёт секции</h1>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>Напишите итоговый отчёт о проведении секции.</p>
                {frSections.length > 1 && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>Секция</label>
                    <select value={frSectionId} onChange={e => setFrSectionId(e.target.value)}
                      style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", minWidth: 240 }}>
                      {frSections.map((s: any) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                )}
                {frSaved && (
                  <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontWeight: 700 }}>
                    Отчёт успешно сохранён!
                  </div>
                )}
                <textarea value={frText} onChange={e => setFrText(e.target.value)} rows={14}
                  placeholder="Опишите как прошла секция: количество участников, основные обсуждения, выводы, проблемы..."
                  style={{ width: "100%", padding: "16px 18px", borderRadius: 14, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "Nunito, sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7, marginBottom: 16 }} />
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button onClick={saveFinalReport} disabled={frSaving || !frText.trim() || !frSectionId}
                    style={{ padding: "12px 32px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: frSaving ? "not-allowed" : "pointer", opacity: (frSaving || !frText.trim()) ? 0.6 : 1, fontFamily: "Nunito, sans-serif" }}>
                    {frSaving ? "Сохранение..." : "Сохранить отчёт"}
                  </button>
                  {frText.trim() && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{frText.length} символов</span>}
                </div>
              </div>
            )}

            {tab === "chat" && <ChatView user={user} demoMode={demoMode} />}

            {tab === "settings" && (
              <div>
                <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>Настройки</h1>
                <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 440, boxShadow: "0 2px 10px rgba(74,89,138,0.07)" }}>
                  {[
                    { l: "Имя", v: user.full_name },
                    { l: "Email", v: user.email },
                    { l: "Роль", v: roleLabel },
                    ...(user.organization ? [{ l: "Организация", v: user.organization }] : []),
                  ].map((f) => (
                    <div key={f.l} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{f.l}</div>
                      <div style={{ padding: "9px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{f.v}</div>
                    </div>
                  ))}
                  {demoMode && <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠️ Demo</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROGRAM TAB — мероприятия + секции + доклады + кнопка в расписание
// ═══════════════════════════════════════════════════════════════
const DEMO_SECTIONS_PROGRAM: Record<string, any[]> = {
  "e1": [
    {
      id: "s1", title: "Секция ИнфоБез", location: "Зал А", format: "SEQUENTIAL",
      reports: [
        { id: "r1", title: "Угрозы безопасности 2026", speaker_name: "А. Иванов", start_time: "2026-03-19T10:00:00Z", end_time: "2026-03-19T10:30:00Z" },
        { id: "r2", title: "Защита данных в облаке", speaker_name: "М. Петрова", start_time: "2026-03-19T10:30:00Z", end_time: "2026-03-19T11:00:00Z" },
      ],
    },
    {
      id: "s2", title: "Секция ML", location: "Зал Б", format: "SEQUENTIAL",
      reports: [
        { id: "r3", title: "Нейросети на производстве", speaker_name: "Д. Сидоров", start_time: "2026-03-19T11:00:00Z", end_time: "2026-03-19T11:30:00Z" },
      ],
    },
  ],
  "e2": [
    {
      id: "s3", title: "Кейс 3 — EventHub", location: "Ауд. 201", format: "SEQUENTIAL",
      reports: [
        { id: "r4", title: "Презентация EventHub", speaker_name: "Команда 3", start_time: "2026-03-19T18:00:00Z", end_time: "2026-03-19T18:20:00Z" },
      ],
    },
  ],
};

function ProgramTab({
  events, regs, onRegister, demoMode, userId,
}: {
  events: EventData[];
  regs: Set<string>;
  onRegister: (id: string) => void;
  demoMode: boolean;
  userId: string;
}) {
  const [expandedEv, setExpandedEv] = useState<string>("");
  const [sections, setSections] = useState<Record<string, any[]>>({});
  const [loadingSections, setLoadingSections] = useState<Record<string, boolean>>({});
  const [scheduleReports, setScheduleReports] = useState<Set<string>>(new Set());
  const [addingReport, setAddingReport] = useState<string>("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string>("");
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());

  const loadSections = async (evId: string) => {
    if (sections[evId]) { setExpandedEv(evId === expandedEv ? "" : evId); return; }
    setExpandedEv(evId);
    setLoadingSections((p) => ({ ...p, [evId]: true }));
    if (demoMode) {
      setSections((p) => ({ ...p, [evId]: DEMO_SECTIONS_PROGRAM[evId] || [] }));
      setLoadingSections((p) => ({ ...p, [evId]: false }));
      return;
    }
    try {
      const data = await apiFetch<any>("GET", `/api/events/${evId}/program`);
      setSections((p) => ({ ...p, [evId]: data.sections || [] }));
    } catch {
      setSections((p) => ({ ...p, [evId]: [] }));
    } finally {
      setLoadingSections((p) => ({ ...p, [evId]: false }));
    }
  };

  const addToSchedule = async (reportId: string) => {
    setAddingReport(reportId);
    if (demoMode) {
      setScheduleReports((p) => new Set(p).add(reportId));
      setAddingReport("");
      return;
    }
    try {
      await apiFetch("POST", `/api/schedule/reports/${reportId}`);
      setScheduleReports((p) => new Set(p).add(reportId));
    } catch {}
    finally { setAddingReport(""); }
  };

  const removeFromSchedule = async (reportId: string) => {
    if (demoMode) { setScheduleReports((p) => { const n = new Set(p); n.delete(reportId); return n; }); return; }
    try {
      await apiFetch("DELETE", `/api/schedule/reports/${reportId}`);
      setScheduleReports((p) => { const n = new Set(p); n.delete(reportId); return n; });
    } catch {}
  };

  const submitRating = async (reportId: string, rating: number) => {
    setRatings(prev => ({ ...prev, [reportId]: rating }));
    if (!demoMode) { try { await apiFetch("POST", `/api/reports/${reportId}/feedback`, { rating }); } catch {} }
  };

  const loadComments = async (reportId: string) => {
    const isExp = expandedComments.has(reportId);
    if (isExp) { setExpandedComments(prev => { const n = new Set(prev); n.delete(reportId); return n; }); return; }
    setExpandedComments(prev => new Set(prev).add(reportId));
    if (comments[reportId] !== undefined) return;
    setLoadingComments(prev => new Set(prev).add(reportId));
    if (!demoMode) {
      try { const d = await apiFetch<any[]>("GET", `/api/reports/${reportId}/comments`); setComments(prev => ({ ...prev, [reportId]: d || [] })); }
      catch { setComments(prev => ({ ...prev, [reportId]: [] })); }
    } else { setComments(prev => ({ ...prev, [reportId]: [] })); }
    setLoadingComments(prev => { const n = new Set(prev); n.delete(reportId); return n; });
  };

  const submitComment = async (reportId: string) => {
    const text = (commentText[reportId] || "").trim();
    if (!text) return;
    setSubmittingComment(reportId);
    const tmp = { id: `tmp-${Date.now()}`, report_id: reportId, author_id: userId, author_name: "Вы", text, created_at: new Date().toISOString() };
    setComments(prev => ({ ...prev, [reportId]: [...(prev[reportId] || []), tmp] }));
    setCommentText(prev => ({ ...prev, [reportId]: "" }));
    if (!demoMode) {
      try {
        const saved = await apiFetch<any>("POST", `/api/reports/${reportId}/comments`, { text });
        setComments(prev => ({ ...prev, [reportId]: [...(prev[reportId] || []).filter((c: any) => c.id !== tmp.id), saved] }));
      } catch {}
    }
    setSubmittingComment("");
  };

  const fmtTime = (iso?: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>Программа мероприятий</h1>
      <div style={{ display: "grid", gap: 14 }}>
        {events.map((ev) => (
          <div key={ev.id} style={{ background: "white", borderRadius: 16, border: "1.5px solid var(--border)", overflow: "hidden", boxShadow: "0 2px 12px rgba(74,89,138,0.07)" }}>
            {/* Шапка мероприятия */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 800, fontSize: 16, color: "var(--primary-dark)", marginBottom: 4 }}>{ev.title}</h3>
                  {ev.description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>{ev.description}</p>}
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>📅 {ev.start_date} — {ev.end_date}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                  <button
                    onClick={() => onRegister(ev.id)}
                    style={{ padding: "8px 18px", background: regs.has(ev.id) ? "#f0fdf4" : "#16a34a", color: regs.has(ev.id) ? "#16a34a" : "white", border: regs.has(ev.id) ? "1.5px solid #bbf7d0" : "none", borderRadius: 100, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                  >
                    {regs.has(ev.id) ? "✅ Зарегистрированы" : "Зарегистрироваться"}
                  </button>
                  <button
                    onClick={() => loadSections(ev.id)}
                    style={{ padding: "8px 18px", background: "var(--bg-medium)", color: "var(--primary)", border: "1.5px solid var(--border)", borderRadius: 100, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                  >
                    {expandedEv === ev.id ? "Скрыть программу ↑" : "Смотреть программу ↓"}
                  </button>
                </div>
              </div>
            </div>

            {/* Секции и доклады */}
            {expandedEv === ev.id && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "16px 24px", background: "#fafbfc" }}>
                {loadingSections[ev.id] ? (
                  <Spinner label="Загружаем программу..." />
                ) : !sections[ev.id]?.length ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 600, textAlign: "center", padding: 16 }}>
                    Программа пока не опубликована
                  </div>
                ) : (
                  sections[ev.id].map((sec: any) => (
                    <div key={sec.id} style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--primary)", marginBottom: 8 }}>
                        📌 {sec.title}
                        {sec.location && <span style={{ color: "var(--text-muted)", fontWeight: 600, marginLeft: 8 }}>· 📍 {sec.location}</span>}
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {(sec.reports || []).map((r: any) => {
                          const isExp = expandedComments.has(r.id);
                          const repComments = comments[r.id] || [];
                          const myRating = ratings[r.id] || 0;
                          return (
                          <div key={r.id} style={{ background: "white", borderRadius: 12, border: "1.5px solid var(--border)", overflow: "hidden" }}>
                            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {r.start_time && <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 800, marginBottom: 2 }}>{fmtTime(r.start_time)}{r.end_time ? ` – ${fmtTime(r.end_time)}` : ""}</div>}
                                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--primary-dark)" }}>{r.title}</div>
                                {r.speaker_name && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>🎤 {r.speaker_name}</div>}
                                {r.description && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{r.description}</div>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                                <button onClick={() => scheduleReports.has(r.id) ? removeFromSchedule(r.id) : addToSchedule(r.id)} disabled={addingReport === r.id}
                                  style={{ padding: "6px 12px", borderRadius: 100, fontWeight: 800, fontSize: 11, cursor: addingReport === r.id ? "wait" : "pointer", fontFamily: "Nunito, sans-serif", border: "none", background: scheduleReports.has(r.id) ? "#f0fdf4" : "var(--primary)", color: scheduleReports.has(r.id) ? "#16a34a" : "white", opacity: addingReport === r.id ? 0.6 : 1 }}>
                                  {addingReport === r.id ? "..." : scheduleReports.has(r.id) ? "✓ В расписании" : "+ В расписание"}
                                </button>
                                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginRight: 3 }}>Оценка:</span>
                                  {[1,2,3,4,5].map(star => (
                                    <span key={star} onClick={() => submitRating(r.id, star)} style={{ cursor: "pointer", fontSize: 16, color: star <= myRating ? "#f59e0b" : "#e2e8f0", transition: "color 0.1s", userSelect: "none" }}>★</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div style={{ borderTop: "1px solid #f1f5f9", padding: "6px 16px" }}>
                              <button onClick={() => loadComments(r.id)} style={{ background: "none", border: "none", fontSize: 12, color: "var(--primary)", fontWeight: 700, cursor: "pointer", padding: "3px 0", fontFamily: "Nunito, sans-serif" }}>
                                {loadingComments.has(r.id) ? "Загрузка..." : isExp ? `💬 Скрыть вопросы (${repComments.length})` : `💬 Вопросы${repComments.length > 0 ? ` (${repComments.length})` : ""}`}
                              </button>
                            </div>
                            {isExp && (
                              <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 16px", background: "#fafbfc" }}>
                                {repComments.map((c: any) => (
                                  <div key={c.id} style={{ background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)", marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                      <span style={{ fontWeight: 700, fontSize: 12, color: "var(--primary-dark)" }}>{c.author_name || "Участник"}</span>
                                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(c.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#334155" }}>{c.text}</div>
                                    {c.answer_text && (
                                      <div style={{ marginTop: 8, padding: "8px 10px", background: "#eef6ff", borderRadius: 6, borderLeft: "3px solid var(--primary)" }}>
                                        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--primary)", marginBottom: 2 }}>Ответ {c.answer_by_name ? `· ${c.answer_by_name}` : ""}</div>
                                        <div style={{ fontSize: 12, color: "#334155" }}>{c.answer_text}</div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                <div style={{ display: "flex", gap: 8 }}>
                                  <input type="text" placeholder="Задать вопрос по докладу..." value={commentText[r.id] || ""} onChange={e => setCommentText(prev => ({ ...prev, [r.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && submitComment(r.id)}
                                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", outline: "none" }} />
                                  <button onClick={() => submitComment(r.id)} disabled={submittingComment === r.id || !(commentText[r.id]||"").trim()}
                                    style={{ padding: "8px 14px", background: "var(--primary)", color: "white", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif", opacity: (submittingComment === r.id || !(commentText[r.id]||"").trim()) ? 0.5 : 1 }}>
                                    Отправить
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
        {events.length === 0 && <EmptyState icon="📋" title="Нет мероприятий" description="Скоро здесь появятся новые мероприятия." />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULE TAB — моё расписание (зарегистрированные + добавленные доклады)
// ═══════════════════════════════════════════════════════════════
function ScheduleTab({
  demoMode, regs, events,
}: {
  demoMode: boolean;
  regs: Set<string>;
  events: EventData[];
}) {
  const [reportItems, setReportItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demoMode) {
      // Demo: показываем доклады из расписания
      setReportItems([
        { report: { id: "r1", title: "Угрозы безопасности 2026", start_time: "2026-03-19T10:00:00Z", end_time: "2026-03-19T10:30:00Z", speaker_name: "А. Иванов" }, section: { title: "Секция ИнфоБез", location: "Зал А" }, event_id: "e1" },
        { report: { id: "r3", title: "Нейросети на производстве", start_time: "2026-03-19T11:00:00Z", end_time: "2026-03-19T11:30:00Z", speaker_name: "Д. Сидоров" }, section: { title: "Секция ML", location: "Зал Б" }, event_id: "e1" },
      ]);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await apiFetch<any[]>("GET", "/api/schedule/my");
        setReportItems(data || []);
      } catch { setReportItems([]); }
      finally { setLoading(false); }
    })();
  }, [demoMode]);

  const removeReport = async (reportId: string) => {
    if (demoMode) { setReportItems((p) => p.filter((i) => i.report.id !== reportId)); return; }
    try {
      await apiFetch("DELETE", `/api/schedule/reports/${reportId}`);
      setReportItems((p) => p.filter((i) => i.report.id !== reportId));
    } catch {}
  };

  const fmtTime = (iso?: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return <Spinner label="Загружаем расписание..." />;

  // Зарегистрированные мероприятия
  const registeredEvents = events.filter((e) => regs.has(e.id));

  return (
    <div>
      <h1 style={{ fontWeight: 900, fontSize: 22, color: "var(--primary-dark)", marginBottom: 20 }}>Моё расписание</h1>

      {/* Зарегистрированные мероприятия */}
      {registeredEvents.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
            Мероприятия ({registeredEvents.length})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {registeredEvents.map((ev) => (
              <div key={ev.id} style={{ background: "white", borderRadius: 12, padding: "12px 18px", border: "1.5px solid #bbf7d0", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)" }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>📅 {ev.start_date} — {ev.end_date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Добавленные доклады */}
      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
        Доклады в расписании ({reportItems.length})
      </div>
      {reportItems.length === 0 ? (
        <EmptyState icon="📅" title="Докладов в расписании нет" description="Перейдите в Программу, раскройте мероприятие и нажмите «+ В расписание» рядом с докладом." />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {reportItems
            .sort((a, b) => (a.report.start_time || "").localeCompare(b.report.start_time || ""))
            .map((item: any) => {
              const r = item.report; const s = item.section;
              return (
                <div key={r.id} style={{ background: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 10px rgba(74,89,138,0.07)", border: "1.5px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {r.start_time && (
                      <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 800, marginBottom: 2 }}>
                        {fmtTime(r.start_time)}{r.end_time ? ` – ${fmtTime(r.end_time)}` : ""}
                      </div>
                    )}
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--primary-dark)" }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      📍 {s?.location || "—"} · {s?.title}
                      {r.speaker_name && ` · 🎤 ${r.speaker_name}`}
                    </div>
                  </div>
                  <button
                    onClick={() => removeReport(r.id)}
                    style={{ padding: "6px 12px", background: "#fff1f1", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 100, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif", flexShrink: 0 }}
                  >
                    Убрать
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP ROOT — роутинг
// ═══════════════════════════════════════════════════════════════
function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [initLoading, setInitLoading] = useState(true);
  const [memberships, setMemberships] = useState<DemoMembership[]>(() => {
    try { const s = localStorage.getItem("eh_memberships"); return s ? JSON.parse(s) : [...DEMO_MEMBERSHIPS_INIT]; } catch { return [...DEMO_MEMBERSHIPS_INIT]; }
  });
  // Shared events state — publishes persist across dashboards
  const [sharedEvents, setSharedEvents] = useState<EventData[]>(() => {
    try { const s = localStorage.getItem("eh_events"); return s ? JSON.parse(s) : [...DEMO_EVENTS]; } catch { return [...DEMO_EVENTS]; }
  });
  // Shared registrations — persist across navigation
  const [sharedRegs, setSharedRegs] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem("eh_regs"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });

  // Persist to localStorage on change
  useEffect(() => { localStorage.setItem("eh_memberships", JSON.stringify(memberships)); }, [memberships]);
  useEffect(() => { localStorage.setItem("eh_events", JSON.stringify(sharedEvents)); }, [sharedEvents]);
  useEffect(() => { localStorage.setItem("eh_regs", JSON.stringify([...sharedRegs])); }, [sharedRegs]);

  useEffect(() => {
    injectGlobalCSS();
    const token = localStorage.getItem("access_token");
    const du = localStorage.getItem("demo_user");

    if (du) {
      try {
        setUser(JSON.parse(du));
        setDemoMode(true);
      } catch {}
      setInitLoading(false);
      return;
    }

    if (token) {
      apiFetch<User>("GET", "/api/auth/me")
        .then((u) => {
          setUser(u);
          // Load real events from API
          apiFetch<EventData[]>("GET", "/api/events/").then((evs) => {
            if (evs?.length) setSharedEvents(evs);
          }).catch(() => {});
          // Also load public events
          apiFetch<EventData[]>("GET", "/api/events/public").then((evs) => {
            if (evs?.length) {
              setSharedEvents((prev) => {
                const ids = new Set(prev.map((e) => e.id));
                return [...prev, ...(evs || []).filter((e) => !ids.has(e.id))];
              });
            }
          }).catch(() => {});
        })
        .catch(() => localStorage.removeItem("access_token"))
        .finally(() => setInitLoading(false));
    } else {
      setInitLoading(false);
    }
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError("");

    // Demo
    const du = DEMO_USERS[email];
    if (du && du.password === password) {
      const { password: _, ...userData } = du;
      setUser(userData);
      setDemoMode(true);
      localStorage.setItem("demo_user", JSON.stringify(userData));
      setAuthLoading(false);
      return;
    }

    // Real backend: POST /api/auth/login → { access_token, token_type, user }
    try {
      const res = await apiFetch<{ access_token: string; user: User }>("POST", "/api/auth/login", { email, password });
      localStorage.setItem("access_token", res.access_token);
      setUser(res.user);
      setDemoMode(false);
      // Load real events
      try { const evs = await apiFetch<EventData[]>("GET", "/api/events/"); if (evs?.length) setSharedEvents(evs); } catch {}
      try { const pubEvs = await apiFetch<EventData[]>("GET", "/api/events/public"); if (pubEvs?.length) setSharedEvents((prev) => { const ids = new Set(prev.map((e) => e.id)); return [...prev, ...pubEvs.filter((e) => !ids.has(e.id))]; }); } catch {}
    } catch (e: any) {
      setAuthError(e?.message || "Неверный email или пароль");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string, full_name: string) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      // POST /api/auth/register → UserOut (без токена!) → затем login
      await apiFetch("POST", "/api/auth/register", { email, password, full_name });
      const res = await apiFetch<{ access_token: string; user: User }>("POST", "/api/auth/login", { email, password });
      localStorage.setItem("access_token", res.access_token);
      setUser(res.user);
      setDemoMode(false);
    } catch (e: any) {
      setAuthError(e?.message || "Ошибка регистрации");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setDemoMode(false);
    localStorage.removeItem("access_token");
    localStorage.removeItem("demo_user");
  };

  if (initLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--bg-light)",
        }}
      >
        <Spinner label="Загрузка EventHub..." />
      </div>
    );
  }

  return (
    <Routes>
      {/* Главная — всегда лендинг */}
      <Route path="/" element={<LandingPage user={user} onLogout={handleLogout} />} />

      {/* Публичный список мероприятий */}
      <Route path="/events" element={<EventsListPage user={user} onLogout={handleLogout} demoMode={demoMode} sharedEvents={sharedEvents} />} />

      {/* Страница мероприятия — секции, доклады, комментарии, регистрация */}
      <Route path="/events/:id" element={<EventDetailPage user={user} onLogout={handleLogout} demoMode={demoMode} sharedEvents={sharedEvents} sharedRegs={sharedRegs} setSharedRegs={setSharedRegs} />} />

      <Route
        path="/login"
        element={
          user ? <Navigate to="/dashboard" /> : <AuthPage onLogin={handleLogin} onRegister={handleRegister} loading={authLoading} error={authError} />
        }
      />

      <Route
        path="/create-event"
        element={
          user?.global_role === "ORGANIZER" ? <CreateEventPage demoMode={demoMode} /> : <Navigate to="/dashboard" />
        }
      />

      <Route
        path="/reports/:id"
        element={
          user ? <ReportPage user={user} demoMode={demoMode} /> : <Navigate to="/login" />
        }
      />

      <Route
        path="/manage/events/:id"
        element={
          user ? <EventManagePage demoMode={demoMode} /> : <Navigate to="/login" />
        }
      />

      <Route
        path="/dashboard"
        element={
          user ? (
            user.global_role === "ORGANIZER" ? (
              <OrganizerDashboard user={user} onLogout={handleLogout} demoMode={demoMode} memberships={memberships} setMemberships={setMemberships} sharedEvents={sharedEvents} setSharedEvents={setSharedEvents} />
            ) : (
              <ParticipantDashboard user={user} onLogout={handleLogout} demoMode={demoMode} memberships={memberships} setMemberships={setMemberships} sharedEvents={sharedEvents} sharedRegs={sharedRegs} setSharedRegs={setSharedRegs} />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
