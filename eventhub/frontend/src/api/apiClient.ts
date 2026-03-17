import axios from "axios";

// -----------------------------------------------------------
// БАЗОВАЯ КОНФИГУРАЦИЯ
// -----------------------------------------------------------
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Автоматически добавляем JWT-токен в каждый запрос
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Если токен протух — разлогиниваем
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// -----------------------------------------------------------
// ТИПЫ (соответствуют БД v2.0)
// -----------------------------------------------------------
export type GlobalRole = "PARTICIPANT" | "ORGANIZER";
export type ContextRole = "PARTICIPANT" | "CURATOR" | "SPEAKER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type EventStatus = "DRAFT" | "PUBLISHED" | "FINISHED";
export type SectionFormat = "SEQUENTIAL" | "ROUNDTABLE" | "GAME" | "OTHER";
export type PresentationFormat = "OFFLINE" | "ONLINE";

export interface User {
  id: string;
  email: string;
  full_name: string;
  global_role: GlobalRole;
  bio?: string;
  photo_url?: string;
  organization?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  owner_id: string;
  status: EventStatus;
  readiness_percent?: number;
}

export interface Section {
  id: string;
  event_id: string;
  title: string;
  curator_id?: string;
  format?: SectionFormat;
  location?: string;
  section_start?: string;
  section_end?: string;
  moderator_id?: string;
  tech_notes?: string;
  readiness_percent: number;
}

export interface Report {
  id: string;
  section_id: string;
  title: string;
  speaker_id: string;
  speaker_confirmed: boolean;
  presentation_format: PresentationFormat;
  start_time: string;
  end_time: string;
  description: string;
}

export interface Task {
  id: string;
  event_id: string;
  title: string;
  assigned_to: string;
  created_by: string;
  status: TaskStatus;
  due_date: string;
}

export interface Comment {
  id: string;
  report_id: string;
  user_id: string;
  text: string;
  answer?: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  report_id: string;
  user_id: string;
  rating: number; // 1–5
  comment?: string;
}

export interface ChatRoom {
  id: string;
  event_id?: string;
  type: "GROUP" | "DIRECT";
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

// -----------------------------------------------------------
// БЕК 1 — AUTH
// routers/auth.py
// -----------------------------------------------------------
export const authAPI = {
  // POST /api/auth/register
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post<{ access_token: string; token_type: string }>("/api/auth/register", data),

  // POST /api/auth/login
  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; token_type: string }>("/api/auth/login", data),

  // GET /api/auth/me
  me: () => api.get<User>("/api/auth/me"),
};

// -----------------------------------------------------------
// БЕК 1 — EVENTS + SECTIONS + REPORTS
// routers/events.py
// -----------------------------------------------------------
export const eventsAPI = {
  // POST /api/events/
  create: (data: Partial<Event>) =>
    api.post<Event>("/api/events/", data),

  // GET /api/events/
  getAll: () =>
    api.get<Event[]>("/api/events/"),

  // GET /api/events/{id}
  getOne: (id: string) =>
    api.get<Event>(`/api/events/${id}`),

  // POST /api/events/{id}/sections
  createSection: (eventId: string, data: Partial<Section>) =>
    api.post<Section>(`/api/events/${eventId}/sections`, data),

  // POST /api/events/{id}/curators
  assignCurator: (eventId: string, data: { user_id: string; section_id: string }) =>
    api.post(`/api/events/${eventId}/curators`, data),
};

export const sectionsAPI = {
  // POST /api/sections/{id}/reports
  createReport: (sectionId: string, data: Partial<Report>) =>
    api.post<Report>(`/api/sections/${sectionId}/reports`, data),
};

export const reportsAPI = {
  // POST /api/reports/{id}/speaker
  assignSpeaker: (reportId: string, data: { speaker_id: string }) =>
    api.post(`/api/reports/${reportId}/speaker`, data),

  // PATCH /api/reports/{id} — спикер обновляет свои данные
  update: (id: string, data: Partial<Report>) =>
    api.patch<Report>(`/api/reports/${id}`, data),
};

export const usersAPI = {
  // GET /api/users/search?q=ФИО
  search: (q: string) =>
    api.get<User[]>("/api/users/search", { params: { q } }),
};

// -----------------------------------------------------------
// БЕК 4 — ЗАДАЧИ + КАНБАН
// routers/tasks.py
// -----------------------------------------------------------
export const tasksAPI = {
  // POST /api/tasks/
  create: (data: Partial<Task>) =>
    api.post<Task>("/api/tasks/", data),

  // GET /api/tasks/?event_id=
  getByEvent: (eventId: string) =>
    api.get<Task[]>("/api/tasks/", { params: { event_id: eventId } }),

  // PATCH /api/tasks/{id}/status
  updateStatus: (id: string, status: TaskStatus) =>
    api.patch<Task>(`/api/tasks/${id}/status`, { status }),

  // DELETE /api/tasks/{id}
  delete: (id: string) =>
    api.delete(`/api/tasks/${id}`),

  // GET /api/events/{id}/progress
  getProgress: (eventId: string) =>
    api.get<{ percent: number }>(`/api/events/${eventId}/progress`),

  // GET /api/events/calendar
  getCalendar: () =>
    api.get("/api/events/calendar"),
};

// -----------------------------------------------------------
// БЕК 5 — УЧАСТНИК + ПРОГРАММА
// routers/participants.py
// -----------------------------------------------------------
export const participantsAPI = {
  // POST /api/events/{id}/register
  registerToEvent: (eventId: string) =>
    api.post(`/api/events/${eventId}/register`),

  // GET /api/events/{id}/program  (публичный, без токена)
  getProgram: (eventId: string) =>
    api.get(`/api/events/${eventId}/program`),

  // GET /api/schedule/my
  getMySchedule: () =>
    api.get<Report[]>("/api/schedule/my"),

  // POST /api/schedule/reports/{id}
  addToSchedule: (reportId: string) =>
    api.post(`/api/schedule/reports/${reportId}`),

  // DELETE /api/schedule/reports/{id}
  removeFromSchedule: (reportId: string) =>
    api.delete(`/api/schedule/reports/${reportId}`),

  // POST /api/reports/{id}/comments
  addComment: (reportId: string, data: { text: string }) =>
    api.post<Comment>(`/api/reports/${reportId}/comments`, data),

  // PUT /api/comments/{id}/answer
  answerComment: (commentId: string, data: { answer: string }) =>
    api.put(`/api/comments/${commentId}/answer`, data),

  // POST /api/reports/{id}/feedback
  addFeedback: (reportId: string, data: { rating: number; comment?: string }) =>
    api.post<Feedback>(`/api/reports/${reportId}/feedback`, data),

  // GET /api/reports/{id}/feedback
  getFeedback: (reportId: string) =>
    api.get(`/api/reports/${reportId}/feedback`),
};

// -----------------------------------------------------------
// БЕК 6 — МЕССЕНДЖЕР + WEBSOCKET
// routers/chat.py
// -----------------------------------------------------------
export const chatAPI = {
  // GET /api/chat/my
  getMy: () =>
    api.get<ChatRoom[]>("/api/chat/my"),

  // POST /api/chat/direct
  createDirect: (data: { user_id: string }) =>
    api.post<ChatRoom>("/api/chat/direct", data),

  // GET /api/chat/{room_id}/messages
  getMessages: (roomId: string, params?: { limit?: number; offset?: number }) =>
    api.get<ChatMessage[]>(`/api/chat/${roomId}/messages`, { params }),
};

// -----------------------------------------------------------
// WEBSOCKET — утилита подключения к чату
// Использование: const ws = createChatSocket(roomId, onMessage)
// -----------------------------------------------------------
export const createChatSocket = (
  roomId: string,
  onMessage: (msg: ChatMessage) => void
): WebSocket => {
  const token = localStorage.getItem("access_token");
  const wsBase = BASE_URL.replace("http", "ws");
  const ws = new WebSocket(`${wsBase}/ws/chat/${roomId}?token=${token}`);

  ws.onmessage = (event) => {
    try {
      const msg: ChatMessage = JSON.parse(event.data);
      onMessage(msg);
    } catch {
      console.error("WS parse error", event.data);
    }
  };

  ws.onerror = (e) => console.error("WS error", e);

  return ws;
};
