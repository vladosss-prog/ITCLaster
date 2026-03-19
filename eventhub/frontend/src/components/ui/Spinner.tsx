import React from "react";

export function Spinner({ label = "Загрузка..." }: { label?: string }) {
  return (
    <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>⏳</div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
