import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import type {
  User,
  Report,
  Comment,
  FeedbackAggregate,
} from "../api/apiClient";

import {
  reportsAPI,
  participantsAPI,
  sectionsAPI,
} from "../api/apiClient";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface ReportPageProps {
  user: User;
  demoMode: boolean;
}

// ═══════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════
const DEMO_REPORT: Report = {
  id: "r1",
  section_id: "s1",
  title: "Угрозы безопасности 2026",
  speaker_id: "u2",
  speaker_name: "Иван Участников",
  speaker_confirmed: true,
  presentation_format: "OFFLINE",
  start_time: "2026-03-19T10:00:00Z",
  end_time: "2026-03-19T10:30:00Z",
  description:
    "Обзор актуальных киберугроз 2026 года: атаки на цепочки поставок, AI-фишинг, уязвимости облачных сервисов. Практические рекомендации для организаций.",
};

const DEMO_COMMENTS: Comment[] = [
  {
    id: "c1",
    report_id: "r1",
    author_id: "u2",
    author_name: "Иван Участников",
    text: "Отличный доклад! Есть вопрос: какие инструменты вы рекомендуете для мониторинга цепочек поставок?",
    created_at: "2026-03-19T10:35:00Z",
    answer_text: null,
    answer_by_id: null,
    answer_created_at: null,
  },
  {
    id: "c2",
    report_id: "r1",
    author_id: "u4",
    author_name: "Анна Петрова",
    text: "Когда будут слайды доступны?",
    created_at: "2026-03-19T10:40:00Z",
    answer_text: "Слайды выложим сегодня вечером в раздел материалов.",
    answer_by_id: "u3",
    answer_created_at: "2026-03-19T11:00:00Z",
  },
  {
    id: "c3",
    report_id: "r1",
    author_id: "u5",
    author_name: "Дмитрий Кодов",
    text: "Интересно было бы услышать про zero-trust архитектуру подробнее. Планируется продолжение?",
    created_at: "2026-03-19T10:50:00Z",
    answer_text: null,
    answer_by_id: null,
    answer_created_at: null,
  },
  {
    id: "c4",
    report_id: "r1",
    author_id: "u6",
    author_name: "Мария Сетевая",
    text: "Спасибо за примеры из реальной практики, очень полезно!",
    created_at: "2026-03-19T11:05:00Z",
    answer_text: null,
    answer_by_id: null,
    answer_created_at: null,
  },
];

const DEMO_FEEDBACK: FeedbackAggregate = {
  report_id: "r1",
  average: 4.3,
  count: 12,
  distribution: { 1: 0, 2: 1, 3: 1, 4: 4, 5: 6 },
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            fontSize: 24,
            cursor: readonly ? "default" : "pointer",
            color: star <= (hover || value) ? "#f59e0b" : "#e2e8f0",
            transition: "color 0.1s, transform 0.1s",
            transform: !readonly && star <= hover ? "scale(1.15)" : "scale(1)",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export function ReportPage({ user, demoMode }: ReportPageProps) {
  const { id: reportId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // --- State ---
  const [report, setReport] = useState<Report | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [feedback, setFeedback] = useState<FeedbackAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Новый комментарий
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // Ответы на комментарии: { [commentId]: текст }
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  // Какой комментарий сейчас «открыт» для ответа
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState("");

  // Оценка
  const [myRating, setMyRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);

  // --- Загрузка данных ---
  useEffect(() => {
    if (!reportId) return;
    loadData();
  }, [reportId, demoMode]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    if (demoMode) {
      // Demo: используем захардкоженные данные
      if (reportId === "r1" || !reportId) {
        setReport(DEMO_REPORT);
        setComments([...DEMO_COMMENTS]);
        setFeedback(DEMO_FEEDBACK);
      } else {
        setReport({
          ...DEMO_REPORT,
          id: reportId,
          title: `Доклад ${reportId}`,
        });
        setComments([]);
        setFeedback(null);
      }
      setLoading(false);
      return;
    }

    try {
      // Загружаем всё параллельно
      const [commentsRes, feedbackRes] = await Promise.all([
        reportsAPI.getComments(reportId!),
        participantsAPI.getFeedback(reportId!).catch(() => null),
      ]);

      // Report данные подтянем через getMy или контекст
      // Пока загружаем комментарии — основное что нужно
      setComments(commentsRes.data || []);
      if (feedbackRes) setFeedback(feedbackRes.data);

      // Пытаемся подтянуть данные самого доклада
      try {
        const myReports = await reportsAPI.getMy();
        const found = (myReports.data || []).find(
          (r: Report) => r.id === reportId
        );
        if (found) setReport(found);
      } catch {
        // Если getMy не сработал — оставляем report = null, покажем только комментарии
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || "Не удалось загрузить данные доклада"
      );
    } finally {
      setLoading(false);
    }
  };

  // --- Добавить комментарий ---
  const handleAddComment = async () => {
    if (!newComment.trim() || !reportId) return;
    setSendingComment(true);

    if (demoMode) {
      const demoComment: Comment = {
        id: `c-${Date.now()}`,
        report_id: reportId,
        author_id: user.id,
        author_name: user.full_name,
        text: newComment.trim(),
        created_at: new Date().toISOString(),
        answer_text: null,
        answer_by_id: null,
        answer_created_at: null,
      };
      setComments((prev) => [...prev, demoComment]);
      setNewComment("");
      setSendingComment(false);
      return;
    }

    try {
      const res = await participantsAPI.addComment(reportId, {
        text: newComment.trim(),
      });
      // API возвращает созданный Comment — добавляем в список
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || "Не удалось отправить комментарий"
      );
    } finally {
      setSendingComment(false);
    }
  };

  // --- Ответить на комментарий ---
  const handleAnswer = async (commentId: string) => {
    const text = (answerInputs[commentId] || "").trim();
    if (!text) {
      setAnswerError("Введите текст ответа");
      return;
    }

    setSavingAnswer(true);
    setAnswerError("");

    if (demoMode) {
      // Demo: обновляем локально
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                answer_text: text,
                answer_by_id: user.id,
                answer_created_at: new Date().toISOString(),
              }
            : c
        )
      );
      setAnsweringId(null);
      setAnswerInputs((prev) => {
        const copy = { ...prev };
        delete copy[commentId];
        return copy;
      });
      setSavingAnswer(false);
      return;
    }

    try {
      const res = await participantsAPI.answerComment(commentId, { text });
      // API возвращает обновлённый Comment — заменяем в списке
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? res.data : c))
      );
      setAnsweringId(null);
      setAnswerInputs((prev) => {
        const copy = { ...prev };
        delete copy[commentId];
        return copy;
      });
    } catch (e: any) {
      setAnswerError(
        e?.response?.data?.detail || "Не удалось сохранить ответ"
      );
    } finally {
      setSavingAnswer(false);
    }
  };

  // --- Отправить оценку ---
  const handleRating = async (rating: number) => {
    if (!reportId) return;
    setMyRating(rating);
    setSubmittingRating(true);

    if (demoMode) {
      setRatingSubmitted(true);
      // Обновляем агрегат локально
      setFeedback((prev) => {
        if (!prev)
          return {
            report_id: reportId,
            average: rating,
            count: 1,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, [rating]: 1 },
          };
        const newCount = prev.count + 1;
        const newDist = { ...prev.distribution };
        newDist[rating] = (newDist[rating] || 0) + 1;
        return {
          ...prev,
          count: newCount,
          average:
            Math.round(
              ((prev.average * prev.count + rating) / newCount) * 10
            ) / 10,
          distribution: newDist,
        };
      });
      setSubmittingRating(false);
      return;
    }

    try {
      await participantsAPI.addFeedback(reportId, { rating });
      setRatingSubmitted(true);
      // Перезагружаем агрегат
      try {
        const res = await participantsAPI.getFeedback(reportId);
        setFeedback(res.data);
      } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось отправить оценку");
    } finally {
      setSubmittingRating(false);
    }
  };

  // Может ли текущий пользователь отвечать на комментарии?
  // Куратор (organization === CURATOR_DEMO в demo) или спикер доклада
  const canAnswer = useMemo(() => {
    if (user.global_role === "ORGANIZER") return true;
    if (demoMode && user.organization === "CURATOR_DEMO") return true;
    if (report && report.speaker_id === user.id) return true;
    return false;
  }, [user, report, demoMode]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 64,
          color: "var(--text-muted)",
        }}
      >
        <div
          style={{
            fontSize: 32,
            marginBottom: 12,
            animation: "spin 1s linear infinite",
          }}
        >
          ⏳
        </div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Загружаем доклад...
        </div>
      </div>
    );
  }

  if (error && !report && comments.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
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
            {error}
          </div>
          <button
            onClick={loadData}
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
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 80px" }}>
      {/* Кнопка назад */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          background: "white",
          border: "1.5px solid var(--border)",
          borderRadius: 8,
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "Nunito, sans-serif",
          color: "var(--text-muted)",
          marginBottom: 24,
        }}
      >
        ← Назад
      </button>

      {/* ═══ КАРТОЧКА ДОКЛАДА ═══ */}
      {report && (
        <div
          style={{
            background: "white",
            borderRadius: 20,
            padding: "28px 32px",
            boxShadow: "0 2px 16px rgba(74,89,138,0.08)",
            border: "1.5px solid var(--border)",
            marginBottom: 28,
          }}
        >
          {/* Время + формат */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--primary)",
              }}
            >
              🕐 {formatTime(report.start_time)} –{" "}
              {formatTime(report.end_time)}
            </span>
            {report.presentation_format && (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 800,
                  background:
                    report.presentation_format === "ONLINE"
                      ? "#e8f5e9"
                      : "#e8f0fe",
                  color:
                    report.presentation_format === "ONLINE"
                      ? "#2e7d32"
                      : "var(--primary)",
                }}
              >
                {report.presentation_format === "ONLINE"
                  ? "🌐 Онлайн"
                  : "🏢 Очный"}
              </span>
            )}
            {report.speaker_confirmed && (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 800,
                  background: "#f0fdf4",
                  color: "#16a34a",
                }}
              >
                ✅ Спикер подтверждён
              </span>
            )}
          </div>

          <h1
            style={{
              fontWeight: 900,
              fontSize: 22,
              color: "var(--primary-dark)",
              marginBottom: 10,
              lineHeight: 1.3,
            }}
          >
            {report.title}
          </h1>

          {report.description && (
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 14,
              }}
            >
              {report.description}
            </p>
          )}

          {report.speaker_name && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: "var(--bg-light)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {report.speaker_name[0]}
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 14,
                    color: "var(--primary-dark)",
                  }}
                >
                  {report.speaker_name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Спикер
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ОЦЕНКА ═══ */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "20px 24px",
          boxShadow: "0 2px 10px rgba(74,89,138,0.06)",
          border: "1.5px solid var(--border)",
          marginBottom: 28,
        }}
      >
        <h3
          style={{
            fontWeight: 800,
            fontSize: 15,
            color: "var(--primary-dark)",
            marginBottom: 14,
          }}
        >
          ⭐ Оценка доклада
        </h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          {/* Агрегат */}
          {feedback && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: "var(--primary)",
                }}
              >
                {feedback.average.toFixed(1)}
              </div>
              <div>
                <StarRating value={Math.round(feedback.average)} readonly />
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {feedback.count}{" "}
                  {feedback.count === 1
                    ? "оценка"
                    : feedback.count < 5
                      ? "оценки"
                      : "оценок"}
                </div>
              </div>
            </div>
          )}

          {/* Моя оценка */}
          <div
            style={{
              borderLeft: feedback ? "1.5px solid var(--border)" : "none",
              paddingLeft: feedback ? 24 : 0,
            }}
          >
            {ratingSubmitted ? (
              <div
                style={{
                  color: "#16a34a",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                ✅ Оценка {myRating}/5 принята!
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  Ваша оценка:
                </div>
                <StarRating
                  value={myRating}
                  onChange={(v) => handleRating(v)}
                />
                {submittingRating && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 4,
                    }}
                  >
                    Отправка...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Распределение */}
        {feedback && feedback.count > 0 && (
          <div style={{ marginTop: 16 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = feedback.distribution[star] || 0;
              const pct =
                feedback.count > 0
                  ? Math.round((count / feedback.count) * 100)
                  : 0;
              return (
                <div
                  key={star}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "var(--text-muted)",
                      width: 20,
                      textAlign: "right",
                    }}
                  >
                    {star}★
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      background: "var(--bg-light)",
                      borderRadius: 100,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: "#f59e0b",
                        borderRadius: 100,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      width: 28,
                    }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ КОММЕНТАРИИ ═══ */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "20px 24px",
          boxShadow: "0 2px 10px rgba(74,89,138,0.06)",
          border: "1.5px solid var(--border)",
        }}
      >
        <h3
          style={{
            fontWeight: 800,
            fontSize: 15,
            color: "var(--primary-dark)",
            marginBottom: 20,
          }}
        >
          💬 Комментарии и вопросы
          {comments.length > 0 && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 700,
              }}
            >
              ({comments.length})
            </span>
          )}
        </h3>

        {/* Ошибка ответа */}
        {answerError && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: "8px 12px",
              borderRadius: 8,
              marginBottom: 14,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {answerError}
          </div>
        )}

        {/* Список комментариев */}
        {comments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 20px",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              Пока нет комментариев
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Будьте первым — задайте вопрос или оставьте отзыв
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {comments.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--bg-light)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  border: "1.5px solid var(--border)",
                }}
              >
                {/* Шапка комментария */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background:
                          c.author_id === user.id
                            ? "var(--primary)"
                            : "#64748b",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {(c.author_name || "?")[0]}
                    </div>
                    <span
                      style={{
                        fontWeight: 800,
                        color: "var(--primary-dark)",
                        fontSize: 14,
                      }}
                    >
                      {c.author_name || "Участник"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {formatDateTime(c.created_at)}
                  </span>
                </div>

                {/* Текст комментария */}
                <div
                  style={{
                    fontSize: 14,
                    color: "#334155",
                    lineHeight: 1.6,
                    marginBottom: 10,
                  }}
                >
                  {c.text}
                </div>

                {/* ═══ ОТВЕТ (если есть) ═══ */}
                {c.answer_text && (
                  <div
                    style={{
                      background: "white",
                      borderRadius: 10,
                      padding: "12px 16px",
                      borderLeft: "3px solid var(--primary)",
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "var(--primary)",
                        marginBottom: 4,
                      }}
                    >
                      💬 Ответ куратора/спикера
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#334155",
                        lineHeight: 1.6,
                      }}
                    >
                      {c.answer_text}
                    </div>
                    {c.answer_created_at && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 6,
                        }}
                      >
                        {formatDateTime(c.answer_created_at)}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ КНОПКА «ОТВЕТИТЬ» — только если нет ответа И пользователь может отвечать ═══ */}
                {!c.answer_text && canAnswer && (
                  <>
                    {answeringId === c.id ? (
                      // Форма ответа
                      <div style={{ marginTop: 8 }}>
                        <textarea
                          value={answerInputs[c.id] || ""}
                          onChange={(e) =>
                            setAnswerInputs((prev) => ({
                              ...prev,
                              [c.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="Ваш ответ на комментарий..."
                          autoFocus
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "1.5px solid var(--border)",
                            fontSize: 13,
                            fontFamily: "Nunito, sans-serif",
                            resize: "vertical",
                            outline: "none",
                            boxSizing: "border-box",
                            lineHeight: 1.6,
                            marginBottom: 8,
                          }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => handleAnswer(c.id)}
                            disabled={
                              savingAnswer ||
                              !(answerInputs[c.id] || "").trim()
                            }
                            style={{
                              padding: "8px 20px",
                              background: "var(--primary)",
                              color: "white",
                              border: "none",
                              borderRadius: 100,
                              fontWeight: 800,
                              fontSize: 12,
                              cursor:
                                savingAnswer ||
                                !(answerInputs[c.id] || "").trim()
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                savingAnswer ||
                                !(answerInputs[c.id] || "").trim()
                                  ? 0.6
                                  : 1,
                              fontFamily: "Nunito, sans-serif",
                            }}
                          >
                            {savingAnswer ? "Сохранение..." : "Отправить ответ"}
                          </button>
                          <button
                            onClick={() => {
                              setAnsweringId(null);
                              setAnswerError("");
                            }}
                            style={{
                              padding: "8px 16px",
                              background: "#f1f5f9",
                              color: "#475569",
                              border: "none",
                              borderRadius: 100,
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: "pointer",
                              fontFamily: "Nunito, sans-serif",
                            }}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Кнопка «Ответить»
                      <button
                        onClick={() => {
                          setAnsweringId(c.id);
                          setAnswerError("");
                        }}
                        style={{
                          marginTop: 6,
                          padding: "7px 18px",
                          background: "var(--primary)",
                          color: "white",
                          border: "none",
                          borderRadius: 100,
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "Nunito, sans-serif",
                          transition: "opacity 0.15s",
                        }}
                      >
                        Ответить
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ═══ ФОРМА НОВОГО КОММЕНТАРИЯ ═══ */}
        <div
          style={{
            marginTop: 24,
            borderTop: "1.5px solid var(--border)",
            paddingTop: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "var(--primary-dark)",
              marginBottom: 10,
            }}
          >
            Оставить комментарий
          </div>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            placeholder="Задайте вопрос или оставьте отзыв..."
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1.5px solid var(--border)",
              fontSize: 14,
              fontFamily: "Nunito, sans-serif",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              lineHeight: 1.6,
              marginBottom: 10,
            }}
          />
          <button
            onClick={handleAddComment}
            disabled={sendingComment || !newComment.trim()}
            style={{
              padding: "11px 28px",
              background: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: 100,
              fontWeight: 800,
              fontSize: 14,
              cursor:
                sendingComment || !newComment.trim()
                  ? "not-allowed"
                  : "pointer",
              opacity: sendingComment || !newComment.trim() ? 0.6 : 1,
              fontFamily: "Nunito, sans-serif",
            }}
          >
            {sendingComment ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </div>

      {demoMode && (
        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 12,
            color: "#f59e0b",
            fontWeight: 600,
          }}
        >
          ⚠️ Demo режим — данные не сохраняются на сервере
        </div>
      )}
    </div>
  );
}
