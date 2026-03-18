import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  Navigate,
} from "react-router-dom";
import "./App.css";
import { authAPI, eventsAPI, tasksAPI, participantsAPI } from "./api/apiClient";
import type { User, Task, TaskStatus, CalendarItem } from "./api/apiClient";
import { ScheduleTab } from "./components/dashboard/ScheduleTab";
import { MyReportTab } from "./components/dashboard/MyReportTab";
import { ReportPage } from "./pages/ReportPage";
import { Messenger } from "./components/messenger/Messenger";
import { EventManagePage } from "./pages/EventManagePage";

// -----------------------------------------------------------
// ТИПЫ
// -----------------------------------------------------------
interface EventItem {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  owner_id: string;
  status: string;
  readiness_percent?: number;
}

// -----------------------------------------------------------
// DEMO DATA
// -----------------------------------------------------------
const DEMO_USERS: Record<string, User & { password: string }> = {
  "admin@it.ru": {
    id: "u1", email: "admin@it.ru", password: "admin",
    full_name: "Михаил Полунин", global_role: "ORGANIZER",
    organization: "ИТ-Кластер Сибири",
  },
  "user@it.ru": {
    id: "u2", email: "user@it.ru", password: "user",
    full_name: "Иван Участников", global_role: "PARTICIPANT",
    organization: "ОмГТУ",
  },
};

const DEMO_EVENTS: EventItem[] = [
  {
    id: "e1", title: "ИТ-Форум 2026", status: "PUBLISHED", owner_id: "u1",
    description: "Главное событие цифровой индустрии Сибири.",
    start_date: "2026-03-19", end_date: "2026-03-20", readiness_percent: 72,
  },
  {
    id: "e2", title: "Хакатон EventHub", status: "PUBLISHED", owner_id: "u1",
    description: "48-часовой хакатон по разработке платформы EventHub.",
    start_date: "2026-03-16", end_date: "2026-03-18", readiness_percent: 95,
  },
  {
    id: "e3", title: "Робофест Омск 2026", status: "DRAFT", owner_id: "u1",
    description: "Городской чемпионат по робототехнике.",
    start_date: "2026-04-10", end_date: "2026-04-11", readiness_percent: 30,
  },
];

// Для календаря — задачи/события с датой day/month/year
interface CalendarEntry {
  id: string;
  title: string;
  type: "EVENT" | "TASK";
  day: number;
  month: number; // 0-indexed
  year: number;
  time?: string;
  status?: TaskStatus;
}

const DEMO_CALENDAR: CalendarEntry[] = [
  { id: "c1", title: "ИТ-Форум 2026 — открытие", type: "EVENT", day: 19, month: 2, year: 2026, time: "10:00" },
  { id: "c2", title: "Секция ИнфоБез", type: "EVENT", day: 19, month: 2, year: 2026, time: "12:00" },
  { id: "c3", title: "Хакатон — финал", type: "EVENT", day: 18, month: 2, year: 2026, time: "18:00" },
  { id: "c4", title: "Хакатон — старт", type: "EVENT", day: 16, month: 2, year: 2026, time: "09:00" },
  { id: "c5", title: "Подготовить презентацию", type: "TASK", day: 17, month: 2, year: 2026, status: "TODO" },
  { id: "c6", title: "Воркшоп по ML", type: "EVENT", day: 20, month: 2, year: 2026, time: "14:00" },
];

// Задачи участника (только его)
const DEMO_MY_TASKS: Task[] = [
  { id: "mt1", event_id: "e2", title: "Подготовить презентацию", status: "TODO", assigned_to: "u2", created_by: "u1", due_date: "2026-03-17" },
  { id: "mt2", event_id: "e2", title: "Изучить документацию FastAPI", status: "IN_PROGRESS", assigned_to: "u2", created_by: "u1", due_date: "2026-03-16" },
  { id: "mt3", event_id: "e1", title: "Зарегистрироваться на секцию", status: "DONE", assigned_to: "u2", created_by: "u1", due_date: "2026-03-15" },
];

// Задачи организатора (все задачи)
const DEMO_ALL_TASKS: Task[] = [
  { id: "t1", event_id: "e1", title: "Подготовить бейджи", status: "DONE", assigned_to: "u1", created_by: "u1", due_date: "2026-03-18" },
  { id: "t2", event_id: "e1", title: "Настроить проектор в зале А", status: "IN_PROGRESS", assigned_to: "u1", created_by: "u1", due_date: "2026-03-19" },
  { id: "t3", event_id: "e1", title: "Согласовать кейтеринг", status: "IN_PROGRESS", assigned_to: "u1", created_by: "u1", due_date: "2026-03-17" },
  { id: "t4", event_id: "e1", title: "Разослать программу участникам", status: "TODO", assigned_to: "u1", created_by: "u1", due_date: "2026-03-18" },
  { id: "t5", event_id: "e1", title: "Подготовить сертификаты", status: "TODO", assigned_to: "u1", created_by: "u1", due_date: "2026-03-20" },
];

const DEMO_PROGRAM: Record<string, any[]> = {
  "e1": [
    { id: "r1", title: "Открытие: Будущее ИИ", start_time: "10:00", description: "Зал Сибирь" },
    { id: "r2", title: "Секция ИнфоБез", start_time: "12:00", description: "Зал А" },
    { id: "r3", title: "Воркшоп по ML", start_time: "14:00", description: "Зал Б" },
  ],
  "e2": [
    { id: "r4", title: "Открытие хакатона", start_time: "09:00", description: "Брифинг команд" },
    { id: "r5", title: "Презентация проектов", start_time: "18:00", description: "Финальная защита" },
  ],
  "e3": [],
};

// -----------------------------------------------------------
// ХУК АВТОРИЗАЦИИ
// -----------------------------------------------------------
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const demoUser = sessionStorage.getItem("demo_user");
    if (demoUser) {
      setUser(JSON.parse(demoUser));
      setDemoMode(true);
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    authAPI.me()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("access_token"))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("demo_user");
    setDemoMode(false);
    setUser(null);
  };

  return { user, setUser, loading, logout, demoMode, setDemoMode };
}

// -----------------------------------------------------------
// ШАПКА
// -----------------------------------------------------------
const SiteHeader = ({ user, onLogout, demoMode }: { user: User | null; onLogout: () => void; demoMode: boolean }) => (
  <>
    <div className="top-line" />
    {demoMode && (
      <div style={{
        position: "fixed", top: 5, left: 0, right: 0, zIndex: 2003,
        background: "#f59e0b", color: "white", textAlign: "center",
        padding: "6px", fontSize: "13px", fontWeight: 700,
      }}>
        🔧 DEMO РЕЖИМ — бэкенд недоступен, тестовые данные
      </div>
    )}
    <header className="site-header" style={{ top: demoMode ? "37px" : "5px" }}>
      <div className="container d-flex justify-content-between align-items-center">
        <Link to="/" className="logo-group text-decoration-none">
          <span className="logo-main">ИТ-КЛАСТЕР</span>
          <span className="logo-sub">СИБИРИ</span>
        </Link>
        <nav className="main-nav">
          <Link to="/about">О КЛАСТЕРЕ</Link>
          <Link to="/events">МЕРОПРИЯТИЯ</Link>
          <Link to="/news">НОВОСТИ</Link>
          <Link to="/contacts">КОНТАКТЫ</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="nav-highlight">МОЯ ПАНЕЛЬ</Link>
              <button className="btn-lk-gold" onClick={onLogout}
                style={{ cursor: "pointer", border: "2px solid var(--gold)", background: "transparent" }}>
                {user.full_name.split(" ")[0].toUpperCase()} · ВЫЙТИ
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-lk-gold text-decoration-none">ЛИЧНЫЙ КАБИНЕТ</Link>
          )}
        </nav>
      </div>
    </header>
  </>
);

const SiteFooter = () => (
  <footer className="site-footer">
    <div className="container text-center">
      <p>© 2026 Ассоциация «ИТ-Кластер Сибири»</p>
      <div className="footer-links">
        <Link to="/contacts">Контакты</Link> | <a href="#">Политика конфиденциальности</a>
      </div>
    </div>
  </footer>
);

// -----------------------------------------------------------
// УТИЛИТЫ
// -----------------------------------------------------------
const LoadingScreen = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTop: "4px solid #007bff", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
      <p style={{ color: "#777", fontWeight: 600 }}>Загрузка...</p>
    </div>
  </div>
);

const PlaceholderPage = ({ title, icon }: { title: string; icon: string }) => (
  <div style={{ padding: "60px 40px", textAlign: "center" }}>
    <div style={{ fontSize: 64, marginBottom: 24 }}>{icon}</div>
    <h1 style={{ fontWeight: 800, fontSize: "2rem", marginBottom: 12 }}>{title}</h1>
    <p style={{ color: "#777" }}>Раздел в разработке — контент появится скоро.</p>
    <Link to="/" style={{ display: "inline-block", marginTop: 24, padding: "12px 28px", background: "var(--primary)", color: "white", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>
      ← На главную
    </Link>
  </div>
);

// -----------------------------------------------------------
// КОМПОНЕНТ КАЛЕНДАРЯ (для участника и организатора)
// -----------------------------------------------------------
const CalendarView = ({
  entries, isAdmin, onOpenModal, viewDate, setViewDate,
}: {
  entries: CalendarEntry[];
  isAdmin: boolean;
  onOpenModal?: () => void;
  viewDate: Date;
  setViewDate: (d: Date) => void;
}) => {
  const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const today = new Date();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const changeMonth = (dir: number) => setViewDate(new Date(currentYear, currentMonth + dir, 1));

  return (
    <div className="calendar-wrapper glass-card p-4 bg-white shadow-sm border-0">
      <div className="calendar-header d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-3">
          <h2 className="calendar-title m-0">
            {monthNames[currentMonth]} <span>{currentYear}</span>
          </h2>
          <div className="btn-group">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => changeMonth(-1)}>←</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setViewDate(new Date())}>Сегодня</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => changeMonth(1)}>→</button>
          </div>
        </div>
        {isAdmin && onOpenModal && (
          <button className="btn btn-primary px-4 fw-bold" onClick={onOpenModal}>+ СОЗДАТЬ</button>
        )}
      </div>

      <div className="calendar-grid">
        {["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"].map(d => (
          <div key={d} className="weekday-label">{d}</div>
        ))}
        {Array(offset).fill(null).map((_, i) => <div key={`e${i}`} className="cell empty" />)}
        {days.map(day => {
          const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
          const dayEntries = entries.filter(e => e.day === day && e.month === currentMonth && e.year === currentYear);
          return (
            <div key={day} className={`cell ${isToday ? "today-cell" : ""}`}>
              <div className="cell-header">
                <span className="day-num">{day}</span>
              </div>
              <div className="cell-content">
                {dayEntries.map(entry => (
                  <div key={entry.id} className={`mini-badge ${entry.type.toLowerCase()}`}>
                    {entry.time && <b>{entry.time} </b>}{entry.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// КОМПОНЕНТ КАНБАНА
// -----------------------------------------------------------
const KanbanView = ({
  tasks, onUpdateStatus, showProgress = false,
}: {
  tasks: Task[];
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  showProgress?: boolean; // только для организатора
}) => {
  const columns: { id: TaskStatus; label: string; color: string }[] = [
    { id: "TODO", label: "Нужно сделать", color: "#e2e8f0" },
    { id: "IN_PROGRESS", label: "В работе", color: "#f59e0b" },
    { id: "DONE", label: "Готово", color: "#16a34a" },
  ];

  const donePercent = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === "DONE").length / tasks.length) * 100)
    : 0;

  return (
    <div>
      {/* Прогресс — только для организатора */}
      {showProgress && tasks.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Общий прогресс задач</span>
            <span style={{ fontWeight: 800, color: "var(--primary)" }}>{donePercent}%</span>
          </div>
          <div style={{ background: "#e2e8f0", borderRadius: 4, height: 8 }}>
            <div style={{ width: `${donePercent}%`, background: "var(--primary)", height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      <div className="kanban-container">
        {columns.map(col => (
          <div key={col.id} className="kanban-col">
            <h5 style={{ fontWeight: 800, borderBottom: "2px solid #e2e8f0", paddingBottom: 10, marginBottom: 16 }}>
              {col.label}
              <span style={{ marginLeft: 8, background: "#e2e8f0", borderRadius: 12, padding: "2px 8px", fontSize: 12 }}>
                {tasks.filter(t => t.status === col.id).length}
              </span>
            </h5>
            {tasks.filter(t => t.status === col.id).map(task => (
              <div key={task.id} style={{
                background: "white", borderRadius: 8, padding: 14, marginBottom: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid ${col.color}`,
              }}>
                <h6 style={{ margin: "0 0 8px", fontWeight: 700 }}>{task.title}</h6>
                <div style={{ fontSize: 12, color: "#777", marginBottom: 10 }}>📅 {task.due_date || "—"}</div>
                <select value={task.status}
                  onChange={(e) => onUpdateStatus(task.id, e.target.value as TaskStatus)}
                  style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #e0e6ed", fontSize: 13 }}>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            ))}
            {tasks.filter(t => t.status === col.id).length === 0 && (
              <div style={{ color: "#bbb", fontSize: 13, textAlign: "center", padding: "30px 0" }}>Пусто</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// ЛЕНДИНГ
// -----------------------------------------------------------
const LandingPage = ({ demoMode }: { demoMode: boolean }) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demoMode) { setEvents(DEMO_EVENTS); setLoading(false); return; }
    eventsAPI.getPublic()
      .then(res => setEvents(res.data as EventItem[]))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [demoMode]);

  return (
    <div className="landing-content">
      <section className="hero-section">
        <div className="hero-bg-overlay" />
        <div className="container h-100 d-flex align-items-center justify-content-center">
          <div className="hero-content-wrapper text-center">
            <h1 className="hero-title">ИТ-ФОРУМ 2026</h1>
            <div className="hero-divider mx-auto" />
            <p className="hero-description">
              Главное событие цифровой индустрии Сибири.<br />
              Крупнейшая площадка для нетворкинга.
            </p>
            <button onClick={() => navigate("/login")} className="btn-main-action">
              СТАТЬ УЧАСТНИКОМ
            </button>
          </div>
        </div>
      </section>
      <section className="program-section py-5">
        <div className="container">
          <div className="content-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Ближайшие мероприятия</h2>
              <Link to="/events" style={{ color: "var(--primary)", fontWeight: 700, fontSize: 14 }}>Все мероприятия →</Link>
            </div>
            {loading ? <LoadingScreen /> : (
              <div className="row g-3">
                {events.slice(0, 3).map(e => (
                  <div key={e.id} className="col-lg-4 col-md-6">
                    <div className="event-card-compact" style={{ cursor: "pointer" }} onClick={() => navigate(`/events/${e.id}`)}>
                      <div className="date-badge">{e.start_date}</div>
                      <h5 className="event-title">{e.title}</h5>
                      <div className="event-info">{e.description}</div>
                      <div style={{ marginTop: 12, color: "var(--primary)", fontSize: 13, fontWeight: 700 }}>Подробнее →</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

// -----------------------------------------------------------
// СПИСОК МЕРОПРИЯТИЙ
// -----------------------------------------------------------
const EventsPage = ({ demoMode }: { demoMode: boolean }) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demoMode) { setEvents(DEMO_EVENTS); setLoading(false); return; }
    eventsAPI.getPublic()
      .then(res => setEvents(res.data as EventItem[]))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [demoMode]);

  return (
    <div style={{ padding: "40px 0" }}>
      <div className="container">
        <h1 style={{ fontWeight: 800, marginBottom: 32 }}>Мероприятия</h1>
        {loading ? <LoadingScreen /> : (
          <div className="row g-3">
            {events.map(e => (
              <div key={e.id} className="col-lg-4 col-md-6">
                <div className="event-card-compact" style={{ cursor: "pointer" }} onClick={() => navigate(`/events/${e.id}`)}>
                  <div className="date-badge">{e.start_date} — {e.end_date}</div>
                  <h5 className="event-title">{e.title}</h5>
                  <div className="event-info">{e.description}</div>
                  <div style={{ marginTop: 12, color: "var(--primary)", fontSize: 13, fontWeight: 700 }}>Подробнее →</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// СТРАНИЦА МЕРОПРИЯТИЯ
// -----------------------------------------------------------
const EventPage = ({ user, demoMode }: { user: User | null; demoMode: boolean }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [addLoadingId, setAddLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    if (demoMode) {
      setEvent(DEMO_EVENTS.find(e => e.id === id) || null);
      setProgram(DEMO_PROGRAM[id] || []);
      setLoading(false);
      return;
    }
    Promise.all([eventsAPI.getOne(id), participantsAPI.getProgram(id)])
      .then(([eRes, pRes]) => {
        setEvent(eRes.data as EventItem);
        setProgram(pRes.data || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, demoMode]);

  if (loading) return <LoadingScreen />;
  if (!event) return <PlaceholderPage title="Мероприятие не найдено" icon="🔍" />;

  const handleAddToSchedule = async (reportId: string) => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (demoMode) {
      // В demo режиме не ходим на бэкенд.
      return;
    }
    setAddLoadingId(reportId);
    setError("");
    try {
      await participantsAPI.addToSchedule(reportId);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось добавить в расписание");
    } finally {
      setAddLoadingId(null);
    }
  };

  return (
    <div style={{ padding: "40px 0" }}>
      <div className="container">
        <Link to="/events" style={{ color: "var(--primary)", fontWeight: 700, fontSize: 14 }}>← Все мероприятия</Link>
        <div style={{ marginTop: 24, background: "white", borderRadius: 16, padding: 40, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div className="date-badge" style={{ marginBottom: 12 }}>{event.start_date} — {event.end_date}</div>
          <h1 style={{ fontWeight: 800, marginBottom: 16 }}>{event.title}</h1>
          <p style={{ color: "#555", fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>{event.description}</p>
          {registered ? (
            <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "16px 24px", borderRadius: 10, fontWeight: 700, fontSize: 15, border: "1px solid #bbf7d0", display: "inline-block" }}>
              ✅ Вы зарегистрированы!
            </div>
          ) : (
            <button onClick={async () => {
              if (!user) { navigate("/login"); return; }
              if (demoMode) { setRegistered(true); return; }
              try { await participantsAPI.registerToEvent(id!); setRegistered(true); }
              catch { alert("Ошибка при регистрации"); }
            }} style={{ padding: "14px 36px", background: "var(--gold)", color: "white", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              СТАТЬ УЧАСТНИКОМ
            </button>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 16 }}>
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: 10, borderRadius: 6, fontSize: 14 }}>
              {error}
            </div>
          </div>
        )}

        {Array.isArray(program) ? program.length > 0 : (program?.sections?.length || 0) > 0 ? (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontWeight: 800, marginBottom: 24 }}>Программа</h2>
            <div style={{ display: "grid", gap: 14 }}>
              {Array.isArray(program)
                ? program.map((item: any) => (
                    <div
                      key={item.id}
                      style={{
                        background: "white",
                        borderRadius: 12,
                        padding: 20,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                        borderLeft: "4px solid var(--primary)",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700, marginBottom: 6 }}>{item.start_time}</div>
                      <h5 style={{ margin: "0 0 6px", fontWeight: 700 }}>{item.title}</h5>
                      <p style={{ color: "#777", fontSize: 13, margin: 0 }}>{item.description}</p>
                      <button
                        type="button"
                        onClick={() => handleAddToSchedule(item.id)}
                        style={{
                          marginTop: 10,
                          padding: "8px 14px",
                          borderRadius: 999,
                          border: "none",
                          background: "var(--primary)",
                          color: "white",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Добавить в расписание
                      </button>
                    </div>
                  ))
                : (program?.sections || []).map((section: any) => (
                    <div key={section.id} style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>{section.title}</div>
                      <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                        {section.location ? `📍 ${section.location}` : "📍 —"}
                        {section.format ? ` · ${section.format}` : ""}
                      </div>
                      <div className="row g-3">
                        {(section.reports || []).map((r: any) => (
                          <div key={r.id} className="col-md-6">
                            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, border: "1px solid var(--border)" }}>
                              <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 800, marginBottom: 6 }}>
                                {r.start_time ? new Date(r.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                {r.end_time ? `–${new Date(r.end_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : ""}
                              </div>
                              <div style={{ fontWeight: 900, marginBottom: 6 }}>{r.title}</div>
                              <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>
                                {r.speaker_name ? `🎤 ${r.speaker_name}` : "🎤 —"}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddToSchedule(r.id)}
                                style={{
                                  marginTop: 10,
                                  padding: "8px 14px",
                                  borderRadius: 999,
                                  border: "none",
                                  background: "var(--primary)",
                                  color: "white",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: addLoadingId === r.id ? "wait" : "pointer",
                                  opacity: addLoadingId === r.id ? 0.7 : 1,
                                }}
                              >
                                {addLoadingId === r.id ? "Добавляем..." : "Добавить в расписание"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// АВТОРИЗАЦИЯ
// -----------------------------------------------------------
const AuthPage = ({ onLogin }: { onLogin: (u: User, demo: boolean) => void }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 6,
    border: "1px solid #e0e6ed", marginBottom: 12, fontSize: 14, boxSizing: "border-box",
  };

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !fullName)) { setError("Заполните все поля"); return; }
    setLoading(true); setError("");
    try {
      let user: User; let isDemo = false;
      try {
        if (isLogin) {
          const res = await authAPI.login({ email, password });
          localStorage.setItem("access_token", res.data.access_token);
        } else {
          await authAPI.register({ email, password, full_name: fullName });
          const res = await authAPI.login({ email, password });
          localStorage.setItem("access_token", res.data.access_token);
        }
        user = (await authAPI.me()).data;
      } catch {
        const demoUser = DEMO_USERS[email];
        if (!demoUser || demoUser.password !== password) throw new Error("Неверный email или пароль");
        const { password: _p, ...u } = demoUser;
        user = u; isDemo = true;
      }
      onLogin(user, isDemo);
      navigate("/dashboard");
    } catch (e: any) {
      setError(e.message || "Ошибка входа");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
      <div style={{ maxWidth: 420, width: "100%", background: "white", borderRadius: 16, padding: 40, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>

        {/* Demo кнопки */}
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 24, fontSize: 13 }}>
          <div style={{ fontWeight: 800, color: "#92400e", marginBottom: 8 }}>🔧 Быстрый вход (Demo)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setEmail("admin@it.ru"); setPassword("admin"); }}
              style={{ flex: 1, padding: 7, background: "#007bff", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              Организатор
            </button>
            <button onClick={() => { setEmail("user@it.ru"); setPassword("user"); }}
              style={{ flex: 1, padding: 7, background: "#6b7280", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              Участник
            </button>
          </div>
        </div>

        <div style={{ display: "flex", marginBottom: 28, background: "#f1f5f9", borderRadius: 8, padding: 4 }}>
          {["Вход", "Регистрация"].map((label, i) => (
            <button key={label} onClick={() => { setIsLogin(i === 0); setError(""); }}
              style={{ flex: 1, padding: 8, border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", background: (isLogin ? i === 0 : i === 1) ? "white" : "transparent", color: (isLogin ? i === 0 : i === 1) ? "var(--primary)" : "#777", boxShadow: (isLogin ? i === 0 : i === 1) ? "0 2px 6px rgba(0,0,0,0.08)" : "none" }}>
              {label}
            </button>
          ))}
        </div>

        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>{error}</div>}
        {!isLogin && <input type="text" placeholder="Полное имя" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} style={{ ...inputStyle, marginBottom: 20 }} />

        <button onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", padding: 12, background: "linear-gradient(135deg, #007bff, #0056b3)", color: "white", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Загрузка..." : isLogin ? "ВОЙТИ" : "ЗАРЕГИСТРИРОВАТЬСЯ"}
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// ДАШБОРД УЧАСТНИКА
// -----------------------------------------------------------
const ParticipantDashboard = ({ user, onLogout, demoMode }: { user: User; onLogout: () => void; demoMode: boolean }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"calendar" | "schedule" | "myReport" | "messenger" | "kanban" | "settings">("calendar");
  const [viewDate, setViewDate] = useState(new Date(2026, 2, 17));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demoMode) {
      setCalendarEntries(DEMO_CALENDAR);
      setTasks(DEMO_MY_TASKS);
      setLoading(false);
      return;
    }
    // Бек 4: GET /api/events/calendar
    Promise.all([
      tasksAPI.getCalendar(),
    ])
      .then(([calRes]) => {
        const mapped: CalendarEntry[] = ((calRes.data || []) as CalendarItem[]).map(item => {
          const d = new Date(item.start);
          return {
            id: item.id,
            title: item.title,
            type: item.type === "event" ? "EVENT" as const : "TASK" as const,
            day: d.getDate(),
            month: d.getMonth(),
            year: d.getFullYear(),
            status: item.type === "task" ? "TODO" as TaskStatus : undefined,
          };
        });
        setCalendarEntries(mapped);
        setTasks([]);
      })
      .catch(() => { setCalendarEntries([]); setTasks([]); })
      .finally(() => setLoading(false));
  }, [demoMode]);

  const handleUpdateStatus = async (id: string, status: TaskStatus) => {
    if (demoMode) { setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t)); return; }
    try {
      await tasksAPI.updateStatus(id, status);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch { alert("Не удалось обновить статус"); }
  };

  const navItems = [
    { id: "calendar", icon: "📅", label: "Календарь" },
    { id: "schedule", icon: "🗓️", label: "Расписание" },
    { id: "myReport", icon: "🎤", label: "Мой доклад" },
    { id: "messenger", icon: "💬", label: "Чаты" },
    { id: "kanban", icon: "📋", label: "Мои задачи" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ];

  return (
    <div className="dashboard-wrapper">
      <aside className="dashboard-sidebar">
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--primary)", color: "white", fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
            {user.full_name[0]}
          </div>
          <h5 style={{ marginTop: 12, marginBottom: 4, fontWeight: 800 }}>{user.full_name}</h5>
          <span style={{ display: "inline-block", padding: "4px 12px", background: "#eef6ff", color: "var(--primary)", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
            {user.global_role}
          </span>
          {user.organization && <p style={{ fontSize: 12, color: "#777", marginTop: 6 }}>{user.organization}</p>}
          {demoMode && <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginTop: 4 }}>DEMO</div>}
        </div>
        <nav className="sidebar-nav-list">
          {navItems.map(item => (
            <button key={item.id} className="nav-link border-0 w-100 text-start"
              style={{ background: activeTab === item.id ? "#eef6ff" : "#f1f5f9", color: activeTab === item.id ? "var(--primary)" : "#475569" }}
              onClick={() => setActiveTab(item.id as any)}>
              <span style={{ marginRight: 10 }}>{item.icon}</span>{item.label}
            </button>
          ))}
          <button className="nav-link border-0 w-100 text-start"
            style={{ marginTop: 20, background: "#fff1f1", color: "#ef4444" }} onClick={onLogout}>
            <span style={{ marginRight: 10 }}>🚪</span>Выйти
          </button>
        </nav>
      </aside>

      <main className="dashboard-main-content">
        {loading ? <LoadingScreen /> : (
          <>
            {activeTab === "calendar" && (
              <CalendarView
                entries={calendarEntries}
                isAdmin={false}
                viewDate={viewDate}
                setViewDate={setViewDate}
              />
            )}
            {activeTab === "kanban" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 24 }}>Мои задачи</h2>
                {/* НЕТ процента готовности — это только для организатора */}
                <KanbanView tasks={tasks} onUpdateStatus={handleUpdateStatus} showProgress={false} />
              </div>
            )}
            {activeTab === "schedule" && <ScheduleTab demoMode={demoMode} />}
            {activeTab === "myReport" && <MyReportTab user={user} demoMode={demoMode} />}
            {activeTab === "messenger" && <Messenger demoMode={demoMode} myUserId={user.id} />}
            {activeTab === "settings" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 24 }}>Настройки профиля</h2>
                <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 480, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                  {[{ label: "Имя", value: user.full_name }, { label: "Email", value: user.email }, { label: "Роль", value: user.global_role }, ...(user.organization ? [{ label: "Организация", value: user.organization }] : [])].map(field => (
                    <div key={field.label} style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "#777", textTransform: "uppercase", display: "block", marginBottom: 6 }}>{field.label}</label>
                      <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>{field.value}</div>
                    </div>
                  ))}
                  {demoMode && <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>⚠️ Demo — изменения не сохраняются</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// -----------------------------------------------------------
// ДАШБОРД ОРГАНИЗАТОРА
// -----------------------------------------------------------
const OrganizerDashboard = ({ user, onLogout, demoMode }: { user: User; onLogout: () => void; demoMode: boolean }) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"calendar" | "messenger" | "events" | "kanban" | "settings">("calendar");
  const [viewDate, setViewDate] = useState(new Date(2026, 2, 17));
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const reloadEvents = () => {
    Promise.all([
      eventsAPI.getAll(),
      tasksAPI.getCalendar(),
    ])
      .then(async ([evRes, calRes]) => {
        const eventsData = evRes.data as EventItem[];
        setEvents(eventsData);
        const mapped: CalendarEntry[] = ((calRes.data || []) as CalendarItem[]).map(item => {
          const d = new Date(item.start);
          return {
            id: item.id,
            title: item.title,
            type: item.type === "event" ? "EVENT" as const : "TASK" as const,
            day: d.getDate(),
            month: d.getMonth(),
            year: d.getFullYear(),
            status: item.type === "task" ? "TODO" as TaskStatus : undefined,
          };
        });
        setCalendarEntries(mapped);
        if (eventsData.length > 0) {
          const taskRes = await tasksAPI.getByEvent(eventsData[0].id);
          setTasks(taskRes.data);
        }
      })
      .catch(() => { setEvents([]); setTasks([]); setCalendarEntries([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (demoMode) {
      setEvents(DEMO_EVENTS);
      setTasks(DEMO_ALL_TASKS);
      setCalendarEntries(DEMO_CALENDAR);
      setLoading(false);
      return;
    }
    reloadEvents();
  }, [demoMode]);

  const handleUpdateStatus = async (id: string, status: TaskStatus) => {
    if (demoMode) { setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t)); return; }
    try {
      await tasksAPI.updateStatus(id, status);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch { alert("Не удалось обновить статус"); }
  };

  const navItems = [
    { id: "calendar", icon: "📅", label: "Календарь" },
    { id: "messenger", icon: "💬", label: "Чаты" },
    { id: "events", icon: "🗂️", label: "Мероприятия" },
    { id: "kanban", icon: "📋", label: "Канбан задач" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ];

  return (
    <div className="dashboard-wrapper">
      <aside className="dashboard-sidebar">
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--primary)", color: "white", fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
            {user.full_name[0]}
          </div>
          <h5 style={{ marginTop: 12, marginBottom: 4, fontWeight: 800 }}>{user.full_name}</h5>
          <span style={{ display: "inline-block", padding: "4px 12px", background: "#eef6ff", color: "var(--primary)", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
            {user.global_role}
          </span>
          {user.organization && <p style={{ fontSize: 12, color: "#777", marginTop: 6 }}>{user.organization}</p>}
          {demoMode && <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginTop: 4 }}>DEMO</div>}
        </div>
        <nav className="sidebar-nav-list">
          {navItems.map(item => (
            <button key={item.id} className="nav-link border-0 w-100 text-start"
              style={{ background: activeTab === item.id ? "#eef6ff" : "#f1f5f9", color: activeTab === item.id ? "var(--primary)" : "#475569" }}
              onClick={() => setActiveTab(item.id as any)}>
              <span style={{ marginRight: 10 }}>{item.icon}</span>{item.label}
            </button>
          ))}
          <button className="nav-link border-0 w-100 text-start"
            style={{ marginTop: 20, background: "#fff1f1", color: "#ef4444" }} onClick={onLogout}>
            <span style={{ marginRight: 10 }}>🚪</span>Выйти
          </button>
        </nav>
      </aside>

      <main className="dashboard-main-content">
        {loading ? <LoadingScreen /> : (
          <>
            {/* КАЛЕНДАРЬ — кнопка ведёт на вкладку мероприятий */}
            {activeTab === "calendar" && (
              <CalendarView
                entries={calendarEntries}
                isAdmin={true}
                onOpenModal={() => setActiveTab("events")}
                viewDate={viewDate}
                setViewDate={setViewDate}
              />
            )}

            {/* МЕРОПРИЯТИЯ с кнопкой создания */}
            {activeTab === "events" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <h2 style={{ fontWeight: 800, margin: 0 }}>Управление мероприятиями</h2>
                  <button onClick={() => setShowCreateEvent(true)}
                    style={{ padding: "10px 24px", background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                    + Создать мероприятие
                  </button>
                </div>
                <div className="row g-3">
                  {events.map(e => (
                    <div key={e.id} className="col-lg-4 col-md-6">
                      <div className="event-card-compact">
                        <div className="date-badge">{e.start_date} — {e.end_date}</div>
                        <h5 className="event-title">{e.title}</h5>
                        <div className="event-info">{e.description}</div>
                        {/* ПРОЦЕНТ ГОТОВНОСТИ — только у организатора */}
                        {e.readiness_percent !== undefined && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#777", marginBottom: 4 }}>
                              <span>Готовность</span>
                              <span style={{ fontWeight: 700 }}>{e.readiness_percent}%</span>
                            </div>
                            <div style={{ background: "#e2e8f0", borderRadius: 4, height: 6 }}>
                              <div style={{ width: `${e.readiness_percent}%`, background: e.readiness_percent > 80 ? "#16a34a" : "var(--primary)", height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                          <button onClick={() => navigate(`/events/${e.id}`)}
                            style={{ flex: 1, padding: 8, background: "#eef6ff", color: "var(--primary)", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                            Открыть
                          </button>
                          <button style={{ flex: 1, padding: 8, background: "#fff1f1", color: "#ef4444", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                            {demoMode ? "Удалить (demo)" : "Удалить"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "messenger" && <Messenger demoMode={demoMode} myUserId={user.id} />}

            {/* КАНБАН с прогрессом */}
            {activeTab === "kanban" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 24 }}>Канбан задач</h2>
                <KanbanView tasks={tasks} onUpdateStatus={handleUpdateStatus} showProgress={true} />
              </div>
            )}

            {/* НАСТРОЙКИ */}
            {activeTab === "settings" && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: 24 }}>Настройки профиля</h2>
                <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 480, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                  {[{ label: "Имя", value: user.full_name }, { label: "Email", value: user.email }, { label: "Роль", value: user.global_role }, ...(user.organization ? [{ label: "Организация", value: user.organization }] : [])].map(field => (
                    <div key={field.label} style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "#777", textTransform: "uppercase", display: "block", marginBottom: 6 }}>{field.label}</label>
                      <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>{field.value}</div>
                    </div>
                  ))}
                  {demoMode && <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>⚠️ Demo — изменения не сохраняются</p>}
                </div>
              </div>
            )}
          </>
        )}

        {/* МОДАЛКА СОЗДАНИЯ МЕРОПРИЯТИЯ */}
        {showCreateEvent && (
          <CreateEventModal
            onClose={() => setShowCreateEvent(false)}
            onCreated={() => { setShowCreateEvent(false); if (!demoMode) reloadEvents(); }}
            demoMode={demoMode}
          />
        )}
      </main>
    </div>
  );
};

// -----------------------------------------------------------
// МОДАЛКА СОЗДАНИЯ МЕРОПРИЯТИЯ
// -----------------------------------------------------------
const CreateEventModal = ({
  onClose, onCreated, demoMode,
}: { onClose: () => void; onCreated: () => void; demoMode: boolean }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) { setError("Введите название"); return; }
    setSaving(true); setError("");
    if (demoMode) { onCreated(); return; }
    try {
      const res = await eventsAPI.create({ title: title.trim(), description: description || undefined, start_date: startDate || undefined, end_date: endDate || undefined } as any);
      // Если выбрано "Опубликовать" — сразу меняем статус
      if (publishNow && res.data?.id) {
        await eventsAPI.update(res.data.id, { status: "PUBLISHED" } as any);
      }
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось создать мероприятие");
    } finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1.5px solid var(--border)", fontSize: 14, boxSizing: "border-box",
    fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 16,
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
      <div style={{ background: "white", borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderTop: "5px solid var(--primary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontWeight: 900, margin: 0, color: "var(--primary-dark)" }}>Новое мероприятие</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#777" }}>×</button>
        </div>
        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600 }}>{error}</div>}
        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#777", textTransform: "uppercase", marginBottom: 6 }}>Название *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: ИТ-Форум 2026" autoFocus style={inputStyle} />
        <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#777", textTransform: "uppercase", marginBottom: 6 }}>Описание</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#777", textTransform: "uppercase", marginBottom: 6 }}>Дата начала</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#777", textTransform: "uppercase", marginBottom: 6 }}>Дата окончания</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={publishNow} onChange={e => setPublishNow(e.target.checked)} />
          Опубликовать сразу (видно на странице мероприятий)
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleCreate} disabled={saving} style={{ flex: 1, padding: 12, background: "var(--primary)", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Создание..." : "СОЗДАТЬ"}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: 12, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            ОТМЕНА
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------
// ГЛАВНЫЙ КОМПОНЕНТ
// -----------------------------------------------------------
export default function App() {
  const { user, setUser, loading, logout, demoMode, setDemoMode } = useAuth();

  const handleLogin = (u: User, demo: boolean) => {
    if (demo) {
      sessionStorage.setItem("demo_user", JSON.stringify(u));
      setDemoMode(true);
    }
    setUser(u);
  };

  const handleLogout = () => {
    logout();
  };

  const spinnerStyle = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;

  if (loading) return <LoadingScreen />;

  return (
    <Router>
      <style>{spinnerStyle}</style>
      <div className="app-root">
        <SiteHeader user={user} onLogout={handleLogout} demoMode={demoMode} />
        <div className="main-viewport" style={{ minHeight: "80vh", paddingTop: demoMode ? "142px" : "100px" }}>
          <Routes>
            <Route path="/" element={<LandingPage demoMode={demoMode} />} />
            <Route path="/about" element={<PlaceholderPage title="О кластере" icon="🏢" />} />
            <Route path="/news" element={<PlaceholderPage title="Новости" icon="📰" />} />
            <Route path="/contacts" element={<PlaceholderPage title="Контакты" icon="📞" />} />
            <Route path="/events" element={<EventsPage demoMode={demoMode} />} />
            <Route path="/events/:id" element={<EventPage user={user} demoMode={demoMode} />} />
            <Route path="/reports/:id" element={<ReportPage demoMode={demoMode} />} />
            <Route path="/login" element={
              user ? <Navigate to="/dashboard" /> : <AuthPage onLogin={handleLogin} />
            } />
            <Route path="/dashboard" element={
              user
                ? user.global_role === "ORGANIZER"
                  ? <OrganizerDashboard user={user} onLogout={handleLogout} demoMode={demoMode} />
                  : <ParticipantDashboard user={user} onLogout={handleLogout} demoMode={demoMode} />
                : <Navigate to="/login" />
            } />
            <Route path="/manage/events/:id" element={
              user?.global_role === "ORGANIZER"
                ? <EventManagePage demoMode={demoMode} />
                : <Navigate to="/dashboard" />
            } />
            <Route path="*" element={<PlaceholderPage title="Страница не найдена" icon="🔍" />} />
          </Routes>
        </div>
        <SiteFooter />
      </div>
    </Router>
  );
}
