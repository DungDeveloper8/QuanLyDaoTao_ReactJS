export function LoadingState({ text = 'Đang tải dữ liệu...' }) {
  return (
    <div className="page-state loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="page-state error-state">
      <strong>Không thể tải dữ liệu</strong>
      <span>{message}</span>
      {onRetry ? (
        <button className="btn btn-primary btn-sm" type="button" onClick={onRetry}>
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ text = 'Chưa có dữ liệu.' }) {
  return <div className="empty-state">{text}</div>;
}
