import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { participantsAPI, reportsAPI } from "../api/apiClient";
import type { Comment, FeedbackAggregate, MyScheduleItem } from "../api/apiClient";
import { ErrorBlock } from "../components/ui/ErrorBlock";
import { Spinner } from "../components/ui/Spinner";

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ReportPage({ demoMode }: { demoMode: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [scheduleItem, setScheduleItem] = useState<MyScheduleItem | null>(null);
  const [feedback, setFeedback] = useState<FeedbackAggregate | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  const [myRating, setMyRating] = useState<number>(0);
  const [savingRating, setSavingRating] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");

    const load = async () => {
      try {
        if (demoMode) {
          setScheduleItem({
            event_id: "e2",
            section: {
              id: "s1",
              title: "Пленарная секция",
              format: "SEQUENTIAL",
              location: "Зал А",
              section_start: "2026-03-17T09:00:00Z",
              section_end: "2026-03-17T12:00:00Z",
              reports: [],
            },
            report: {
              id,
              title: "Открытие хакатона",
              start_time: "2026-03-17T09:00:00Z",
              end_time: "2026-03-17T09:30:00Z",
              speaker_name: "Оргкомитет",
              description: "Брифинг команд и вводная часть",
            },
          });
          setFeedback({ report_id: id, average: 4.6, count: 19, distribution: { 1: 0, 2: 1, 3: 2, 4: 6, 5: 10 } });
          setComments([
            {
              id: "c1",
              report_id: id,
              author_id: "u2",
              text: "Спасибо за доклад!",
              created_at: new Date().toISOString(),
              answer_text: "Рады помочь",
              answer_by_id: "u1",
              answer_created_at: new Date().toISOString(),
            },
          ]);
          return;
        }

        // Загружаем расписание, фидбэк и комментарии параллельно
        const [schedRes, fbRes, commentsRes] = await Promise.all([
          participantsAPI.getMySchedule(),
          participantsAPI.getFeedback(id),
          reportsAPI.getComments(id),
        ]);
        const found = (schedRes.data || []).find((x) => x.report.id === id) || null;
        setScheduleItem(found);
        setFeedback(fbRes.data);
        setComments(commentsRes.data || []);
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Не удалось загрузить доклад");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [demoMode, id]);

  const headerTitle = scheduleItem?.report.title || "Доклад";

  const canRenderInfo = Boolean(scheduleItem);
  const timeLine = canRenderInfo
    ? `${formatDateTime(scheduleItem!.report.start_time)} – ${formatDateTime(scheduleItem!.report.end_time)}`
    : "Добавьте доклад в расписание, чтобы увидеть детали времени/секции.";

  const avgLine = feedback ? `${feedback.average.toFixed(1)} / 5 · (${feedback.count})` : "—";

  const distribution = useMemo(() => {
    const dist = feedback?.distribution || {};
    const out: { rating: number; count: number }[] = [];
    for (let r = 5; r >= 1; r -= 1) out.push({ rating: r, count: Number((dist as any)[r] || 0) });
    return out;
  }, [feedback]);

  const submitComment = async () => {
    if (!id) return;
    const text = commentText.trim();
    if (!text) return;

    if (demoMode) {
      setComments((prev) => [
        ...prev,
        { id: `demo-${Date.now()}`, report_id: id, author_id: "me", text, created_at: new Date().toISOString() },
      ]);
      setCommentText("");
      return;
    }

    try {
      const res = await participantsAPI.addComment(id, { text });
      setComments((prev) => [...prev, res.data]);
      setCommentText("");
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось отправить комментарий");
    }
  };

  const setRating = async (rating: number) => {
    if (!id) return;
    setMyRating(rating);

    if (demoMode) return;

    setSavingRating(true);
    try {
      await participantsAPI.addFeedback(id, { rating });
      const fb = await participantsAPI.getFeedback(id);
      setFeedback(fb.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Не удалось отправить оценку");
    } finally {
      setSavingRating(false);
    }
  };

  if (loading) return <Spinner label="Загружаем доклад..." />;
  if (error) return <ErrorBlock message={error} onRetry={() => navigate(0)} />;

  return (
    <div style={{ padding: "28px 0 40px" }}>
      <div className="container">
        <div style={{ marginBottom: 16 }}>
          <Link to="/dashboard" style={{ color: "var(--primary)", fontWeight: 800, fontSize: 14 }}>
            ← Назад в дашборд
          </Link>
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <h1 style={{ fontWeight: 900, marginBottom: 10 }}>{headerTitle}</h1>
          <div style={{ color: "#64748b", fontWeight: 800, marginBottom: 6 }}>{timeLine}</div>
          {scheduleItem?.section ? (
            <div style={{ color: "#64748b", fontWeight: 700 }}>
              Секция: {scheduleItem.section.title} {scheduleItem.section.location ? `· ${scheduleItem.section.location}` : ""}
            </div>
          ) : null}
          {scheduleItem?.report?.description ? (
            <p style={{ marginTop: 14, color: "#334155", fontWeight: 600, lineHeight: 1.7 }}>{scheduleItem.report.description}</p>
          ) : (
            <p style={{ marginTop: 14, color: "#64748b", fontWeight: 700 }}>
              Описание недоступно (на текущем бэке нет отдельного `GET /api/reports/{id}`).
            </p>
          )}
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          {/* Feedback */}
          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: 18 }}>Оценка</h2>
              <div style={{ fontWeight: 900, color: "var(--primary)" }}>{avgLine}</div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => void setRating(r)}
                  disabled={savingRating}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: myRating === r ? "linear-gradient(135deg, #007bff, #0056b3)" : "#f8fafc",
                    color: myRating === r ? "white" : "#334155",
                    fontWeight: 900,
                    cursor: savingRating ? "not-allowed" : "pointer",
                  }}
                >
                  {r}★
                </button>
              ))}
              {savingRating ? <span style={{ marginLeft: 8, color: "#64748b", fontWeight: 800 }}>Сохраняем...</span> : null}
            </div>

            {feedback ? (
              <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
                {distribution.map((d) => (
                  <div key={d.rating} style={{ display: "grid", gridTemplateColumns: "40px 1fr 36px", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900, color: "#334155" }}>{d.rating}★</div>
                    <div style={{ background: "#e2e8f0", borderRadius: 6, height: 8 }}>
                      <div
                        style={{
                          width: feedback.count ? `${Math.round((d.count / feedback.count) * 100)}%` : "0%",
                          background: "var(--primary)",
                          height: "100%",
                          borderRadius: 6,
                        }}
                      />
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 900, color: "#64748b" }}>{d.count}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Comments */}
          <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h2 style={{ margin: 0, fontWeight: 900, fontSize: 18 }}>Комментарии</h2>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ваш комментарий…"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  fontWeight: 700,
                }}
              />
              <button
                type="button"
                onClick={() => void submitComment()}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #007bff, #0056b3)",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Отправить
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {comments.length === 0 ? (
                <div style={{ color: "#94a3b8", fontWeight: 800 }}>Комментариев пока нет.</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} style={{ background: "#f8fafc", borderRadius: 14, padding: 12, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900, color: "#334155" }}>Пользователь</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{formatDateTime(c.created_at)}</div>
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 700, color: "#334155" }}>{c.text}</div>
                    {c.answer_text ? (
                      <div style={{ marginTop: 10, background: "white", borderRadius: 12, padding: 10, border: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 900, color: "var(--primary)" }}>Ответ</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: "#334155" }}>{c.answer_text}</div>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

