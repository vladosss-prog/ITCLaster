import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
// ТИПЫ
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

// FIX: был EventData — теперь правильное имя Event
export interface Event {
  id: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  owner_id: string;
  status: EventStatus;
  readiness_percent?: number;
}

// Алиас для обратной совместимости (EventManagePage использовал EventData)
export type EventData = Event;

export interface Section {
  id: string;
  event_id: string;
  title: string;
  curator_id?: string | null;
  curator_name?: string | null; // доп. поле от бэка
  format?: SectionFormat | null;
  location?: string | null;
  section_start?: string | null;
  section_end?: string | null;
  moderator_id?: string | null;
  tech_notes?: string | null;
  readiness_percent: number;
}

export interface Report {
  id: string;
  section_id: string;
  title: string;
  speaker_id?: string | null;
  speaker_name?: string | null; // доп. поле от бэка
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
  assigned_to_name?: string | null; // доп. поле от бэка
  created_by: string;
  status: TaskStatus;
  due_date?: string | null;
}

export interface Comment {
  id: string;
  report_id: string;
  author_id: string;
  author_name?: string | null; // доп. поле от бэка
  text: string;
  created_at: string;
  answer_text?: string | null;
  answer_by_id?: string | null;
  answer_created_at?: string | null;
}

export interface Feedback {
  report_id: string;
  user_id: string;
  rating: number;
}

export interface FeedbackAggregate {
  report_id: string;
  average: number;
  count: number;
  distribution: Record<number, number>;
}

export interface ChatRoom {
  id: string;
  event_id?: string | null;
  type: "GROUP" | "DIRECT";
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_name?: string | null; // доп. поле от бэка
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
  presentation_format?: PresentationFormat | null;
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

// FIX: CalendarItem — был в импорте App.tsx но не объявлен
export interface CalendarItem {
  id: string;
  title: string;
  type: "EVENT" | "TASK";
  day: number;
  month: number;
  year: number;
  time?: string | null;
  status?: TaskStatus | null;
}

export interface SectionReportOut {
  id: string;
  section_id: string;
  author_id: string;
  text: string;
  created_at: string;
}

// -----------------------------------------------------------
// AUTH
// -----------------------------------------------------------
export const authAPI = {
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post<{ access_token: string; token_type: string }>("/api/auth/register", data),

  login: (data: { email: string; password: string }) =>
    api.post<{ access_token: string; token_type: string }>("/api/auth/login", data),

  me: () => api.get<User>("/api/auth/me"),
};

// -----------------------------------------------------------
// EVENTS
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

  // PATCH /api/events/{id}  — FIX: был update но метода не было
  update: (id: string, data: Partial<Event>) =>
    api.patch<Event>(`/api/events/${id}`, data),

  // DELETE /api/events/{id}  — FIX: метода не было
  delete: (id: string) =>
    api.delete(`/api/events/${id}`),

  // POST /api/events/{id}/sections
  createSection: (eventId: string, data: Partial<Section>) =>
    api.post<Section>(`/api/events/${eventId}/sections`, data),

  // GET /api/events/{id}/sections
  getSections: (eventId: string) =>
    api.get<Section[]>(`/api/events/${eventId}/sections`),

  // POST /api/events/{id}/curators
  assignCurator: (eventId: string, data: { user_id: string; section_id: string }) =>
    api.post(`/api/events/${eventId}/curators`, data),

  // GET /api/events/{id}/progress
  getProgress: (eventId: string) =>
    api.get<{ percent: number }>(`/api/events/${eventId}/progress`),

  // GET /api/events/calendar
  getCalendar: () =>
    api.get<CalendarItem[]>("/api/events/calendar"),
};

// -----------------------------------------------------------
// SECTIONS
// -----------------------------------------------------------
export const sectionsAPI = {
  // GET /api/sections/{id}
  getOne: (id: string) =>
    api.get<Section>(`/api/sections/${id}`),

  // PATCH /api/sections/{id}
  update: (id: string, data: Partial<Section>) =>
    api.patch<Section>(`/api/sections/${id}`, data),

  // POST /api/sections/{id}/reports
  createReport: (sectionId: string, data: Partial<Report>) =>
    api.post<Report>(`/api/sections/${sectionId}/reports`, data),

  // GET /api/sections/{id}/reports
  getReports: (sectionId: string) =>
    api.get<Report[]>(`/api/sections/${sectionId}/reports`),

  // POST /api/sections/{id}/section-report  — итоговый отчёт куратора
  createSectionReport: (sectionId: string, data: { text: string }) =>
    api.post<SectionReportOut>(`/api/sections/${sectionId}/section-report`, data),

  // GET /api/sections/{id}/section-report
  getSectionReport: (sectionId: string) =>
    api.get<SectionReportOut>(`/api/sections/${sectionId}/section-report`),
};

// -----------------------------------------------------------
// REPORTS
// -----------------------------------------------------------
export const reportsAPI = {
  // POST /api/reports/{id}/speaker
  assignSpeaker: (reportId: string, data: { speaker_id: string }) =>
    api.post(`/api/reports/${reportId}/speaker`, data),

  // PATCH /api/reports/{id}
  update: (id: string, data: Partial<Report>) =>
    api.patch<Report>(`/api/reports/${id}`, data),

  // GET /api/reports/my  — FIX: метода не было, нужен MyReportTab
  getMy: () =>
    api.get<Report[]>("/api/reports/my"),

  // GET /api/reports/{id}/comments  — FIX: метода не было, нужен ReportPage
  getComments: (reportId: string) =>
    api.get<Comment[]>(`/api/reports/${reportId}/comments`),
};

// -----------------------------------------------------------
// USERS
// -----------------------------------------------------------
export const usersAPI = {
  search: (q: string) =>
    api.get<User[]>("/api/users/search", { params: { q } }),
};

// -----------------------------------------------------------
// TASKS
// -----------------------------------------------------------
export const tasksAPI = {
  create: (data: Partial<Task>) =>
    api.post<Task>("/api/tasks/", data),

  getByEvent: (eventId: string) =>
    api.get<Task[]>("/api/tasks/", { params: { event_id: eventId } }),

  updateStatus: (id: string, status: TaskStatus) =>
    api.patch<Task>(`/api/tasks/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete(`/api/tasks/${id}`),
};

// -----------------------------------------------------------
// PARTICIPANTS
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

  // PUT /api/comments/{id}/answer — ответ куратора/спикера
  answerComment: (commentId: string, data: { text: string }) =>
    api.put<Comment>(`/api/comments/${commentId}/answer`, data),

  addFeedback: (reportId: string, data: { rating: number }) =>
    api.post<Feedback>(`/api/reports/${reportId}/feedback`, data),

  getFeedback: (reportId: string) =>
    api.get<FeedbackAggregate>(`/api/reports/${reportId}/feedback`),
};

// -----------------------------------------------------------
// CHAT
// -----------------------------------------------------------
export const chatAPI = {
  getMy: () =>
    api.get<ChatRoom[]>("/api/chat/my"),

  createDirect: (data: { user_id: string }) =>
    api.post<ChatRoom>("/api/chat/direct", data),

  getMessages: (roomId: string, params?: { limit?: number; offset?: number }) =>
    api.get<ChatMessagesPage>(`/api/chat/${roomId}/messages`, { params }),
};

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
