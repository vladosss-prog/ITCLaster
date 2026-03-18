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

// Если токен протух — разлогиниваем (только если не на публичной странице)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const isPublicUrl = error.config?.url?.includes("/public");
      if (!isPublicUrl) {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// -----------------------------------------------------------
// ТИПЫ (синхронизированы с бэкендом)
// -----------------------------------------------------------
export type GlobalRole = "PARTICIPANT" | "ORGANIZER";
export type ContextRole = "PARTICIPANT" | "CURATOR" | "SPEAKER" | "OWNER";
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

export interface EventData {
  id: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
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
  speaker_id?: string | null;
  speaker_confirmed: boolean;
  presentation_format?: PresentationFormat | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
}

export interface Task {
  id: string;
  event_id: string;
  title: string;
  assigned_to?: string | null;
  created_by: string;
  status: TaskStatus;
  due_date?: string | null;
}

export interface Comment {
  id: string;
  report_id: string;
  author_id: string;
  text: string;
  created_at: string;
  answer_text?: string | null;
  answer_by_id?: string | null;
  answer_created_at?: string | null;
}

export interface Feedback {
  report_id: string;
  user_id: string;
  rating: number; // 1–5
}

export interface FeedbackAggregate {
  report_id: string;
  average: number;
  count: number;
  distribution: Record<number, number>;
}

export interface ProgressOut {
  event_id: string;
  total: number;
  done: number;
  progress: number;
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

export interface ChatMessagesPage {
  items: ChatMessage[];
  offset: number;
  limit: number;
}

export type ChatSocketEvent =
  | { type: "history"; items: ChatMessage[] }
  | { type: "message"; item: ChatMessage }
  | { type: "error"; detail: string };

export interface ProgramReport {
  id: string;
  title: string;
  start_time?: string | null;
  end_time?: string | null;
  speaker_id?: string | null;
  speaker_name?: string | null;
  description?: string | null;
}

export interface ProgramSection {
  id: string;
  title: string;
  format?: string | null;
  location?: string | null;
  section_start?: string | null;
  section_end?: string | null;
  reports: ProgramReport[];
}

export interface ProgramOut {
  event_id: string;
  sections: ProgramSection[];
}

export interface MyScheduleItem {
  report: ProgramReport;
  section: Omit<ProgramSection, "reports"> & { reports: [] };
  event_id: string;
}

export interface CalendarItem {
  id: string;
  title: string;
  start: string;
  end: string | null;
  type: string;
  color: string | null;
}

// -----------------------------------------------------------
// БЕК 1 — AUTH
// -----------------------------------------------------------
export const authAPI = {
  // POST /api/auth/register → UserOut (НЕ токен)
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post<User>("/api/auth/register", data),

  // POST /api/auth/login → TokenOut
  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; token_type: string; user: User }>("/api/auth/login", data),

  // GET /api/auth/me
  me: () => api.get<User>("/api/auth/me"),

  // POST /api/auth/register-organizer
  registerOrganizer: (data: { email: string; password: string; full_name: string }) =>
    api.post<User>("/api/auth/register-organizer", data),

  // POST /api/auth/promote
  promote: (data: { user_id: string; role: string }) =>
    api.post<User>("/api/auth/promote", data),
};

// -----------------------------------------------------------
// БЕК 1 — EVENTS + SECTIONS + REPORTS
// -----------------------------------------------------------
export const eventsAPI = {
  create: (data: Partial<EventData>) =>
    api.post<EventData>("/api/events/", data),

  getAll: () =>
    api.get<EventData[]>("/api/events/"),

  // Публичный список (без JWT)
  getPublic: () =>
    api.get<EventData[]>("/api/events/public"),

  getOne: (id: string) =>
    api.get<EventData>(`/api/events/${id}`),

  // PATCH /api/events/{id}
  update: (id: string, data: Partial<EventData>) =>
    api.patch<EventData>(`/api/events/${id}`, data),

  // DELETE /api/events/{id}
  delete: (id: string) =>
    api.delete(`/api/events/${id}`),

  // GET /api/events/{id}/sections
  getSections: (eventId: string) =>
    api.get<Section[]>(`/api/events/${eventId}/sections`),

  createSection: (eventId: string, data: Partial<Section>) =>
    api.post<Section>(`/api/events/${eventId}/sections`, data),

  assignCurator: (eventId: string, data: { user_id: string; section_id: string }) =>
    api.post(`/api/events/${eventId}/curators`, data),
};

export const sectionsAPI = {
  createReport: (sectionId: string, data: Partial<Report>) =>
    api.post<Report>(`/api/sections/${sectionId}/reports`, data),
};

export const reportsAPI = {
  // POST /api/reports/{id}/speaker — бэк ожидает { user_id }, НЕ speaker_id
  assignSpeaker: (reportId: string, data: { user_id: string }) =>
    api.post(`/api/reports/${reportId}/speaker`, data),

  // PATCH /api/reports/{id}
  update: (id: string, data: Partial<Report>) =>
    api.patch<Report>(`/api/reports/${id}`, data),

  // GET /api/reports/my — доклады текущего спикера
  getMy: () =>
    api.get<Report[]>("/api/reports/my"),

  // GET /api/reports/{id}/comments
  getComments: (reportId: string) =>
    api.get<Comment[]>(`/api/reports/${reportId}/comments`),
};

export const usersAPI = {
  search: (q: string) =>
    api.get<User[]>("/api/users/search", { params: { q } }),
};

// -----------------------------------------------------------
// БЕК 4 — ЗАДАЧИ + КАНБАН
// -----------------------------------------------------------
export const tasksAPI = {
  create: (data: Partial<Task>) =>
    api.post<Task>("/api/tasks/", data),

  getByEvent: (eventId: string) =>
    api.get<Task[]>("/api/tasks/", { params: { event_id: eventId } }),

  updateStatus: (id: string, status: TaskStatus) =>
    api.patch<Task>(`/api/tasks/${id}/status`, { status }),

  // DELETE /api/tasks/{id}
  delete: (id: string) =>
    api.delete(`/api/tasks/${id}`),

  // GET /api/events/{id}/progress → ProgressOut
  getProgress: (eventId: string) =>
    api.get<ProgressOut>(`/api/events/${eventId}/progress`),

  // GET /api/events/calendar
  getCalendar: () =>
    api.get<CalendarItem[]>("/api/events/calendar"),
};

// -----------------------------------------------------------
// БЕК 5 — УЧАСТНИК + ПРОГРАММА
// -----------------------------------------------------------
export const participantsAPI = {
  registerToEvent: (eventId: string) =>
    api.post(`/api/events/${eventId}/register`),

  getProgram: (eventId: string) =>
    api.get<ProgramOut>(`/api/events/${eventId}/program`),

  getMySchedule: () =>
    api.get<MyScheduleItem[]>("/api/schedule/my"),

  addToSchedule: (reportId: string) =>
    api.post(`/api/schedule/reports/${reportId}`),

  removeFromSchedule: (reportId: string) =>
    api.delete(`/api/schedule/reports/${reportId}`),

  addComment: (reportId: string, data: { text: string }) =>
    api.post<Comment>(`/api/reports/${reportId}/comments`, data),

  getComments: (reportId: string) =>
    api.get<Comment[]>(`/api/reports/${reportId}/comments`),

  answerComment: (commentId: string, data: { text: string }) =>
    api.put<Comment>(`/api/comments/${commentId}/answer`, data),

  addFeedback: (reportId: string, data: { rating: number }) =>
    api.post<Feedback>(`/api/reports/${reportId}/feedback`, data),

  getFeedback: (reportId: string) =>
    api.get<FeedbackAggregate>(`/api/reports/${reportId}/feedback`),
};

// -----------------------------------------------------------
// БЕК 6 — МЕССЕНДЖЕР + WEBSOCKET
// -----------------------------------------------------------
export const chatAPI = {
  getMy: () =>
    api.get<ChatRoom[]>("/api/chat/my"),

  createDirect: (data: { user_id: string }) =>
    api.post<ChatRoom>("/api/chat/direct", data),

  getMessages: (roomId: string, params?: { limit?: number; offset?: number }) =>
    api.get<ChatMessagesPage>(`/api/chat/${roomId}/messages`, { params }),
};

// -----------------------------------------------------------
// WEBSOCKET — утилита подключения к чату
// -----------------------------------------------------------
export const createChatSocket = (roomId: string, onEvent: (e: ChatSocketEvent) => void): WebSocket => {
  const token = localStorage.getItem("access_token");
  const wsBase = BASE_URL.replace("http", "ws");
  const ws = new WebSocket(`${wsBase}/api/chat/ws/${roomId}?token=${token}`);

  ws.onmessage = (event) => {
    try {
      const data: ChatSocketEvent = JSON.parse(event.data);
      onEvent(data);
    } catch {
      console.error("WS parse error", event.data);
    }
  };

  ws.onerror = (e) => console.error("WS error", e);

  return ws;
};
