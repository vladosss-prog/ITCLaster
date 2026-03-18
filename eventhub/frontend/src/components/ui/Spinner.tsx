import React from "react";

export function Spinner({
  size = 40,
  label = "Загрузка...",
  className = "",
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`ui-spinner ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <div className="ui-spinner__ring" style={{ width: size, height: size }} />
      {label ? <div className="ui-spinner__label">{label}</div> : null}
    </div>
  );
}

