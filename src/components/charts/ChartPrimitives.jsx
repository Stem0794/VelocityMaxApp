import { CartesianGrid } from 'recharts';
import { gridProps } from './chartConfig';

export const ChartGrid = () => <CartesianGrid {...gridProps} />;

export function EmptyChart({ children }) {
  return <div className="chart-empty">{children}</div>;
}

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const first = payload[0]?.payload || {};
  return (
    <div className="chart-tooltip-v2">
      <strong>{label || first.dateStr || first.status || first.label || ''}</strong>
      {payload.filter(item => item.value != null).map((item, index) => (
        <span key={`${item.dataKey}-${index}`}><i style={{ background: item.color }} />{item.name}: {item.value}</span>
      ))}
      {first.title ? <small>{first.title}</small> : null}
    </div>
  );
}
