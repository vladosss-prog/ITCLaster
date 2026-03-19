import React from "react";

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 14, padding: "20px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      <div style={{ color: "#dc2626", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ padding: "8px 20px", background: "#dc2626", color: "white", border: "none", borderRadius: 100, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
          Повторить
        </button>
      )}
    </div>
  );
}
