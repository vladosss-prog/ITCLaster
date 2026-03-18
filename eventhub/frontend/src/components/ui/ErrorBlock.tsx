import React from "react";

export function ErrorBlock({
  message,
  onRetry,
  className = "",
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`ui-error ${className}`.trim()} role="alert">
      <div className="ui-error__title">Ошибка</div>
      <div className="ui-error__message">{message}</div>
      {onRetry ? (
        <button type="button" className="ui-error__retry" onClick={onRetry}>
          Повторить
        </button>
      ) : null}
    </div>
  );
}

