export default function BarChart({ items, valueFormatter = (value) => value }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  return (
    <div className="bar-chart">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <div className="bar-meta">
            <span>{item.label}</span>
            <strong>{valueFormatter(item.value)}</strong>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max(2, (Number(item.value || 0) / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
