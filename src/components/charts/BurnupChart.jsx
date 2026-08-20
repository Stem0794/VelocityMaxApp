import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps } from './chartConfig';
import { ChartGrid, ChartTooltip, EmptyChart } from './ChartPrimitives';

export default function BurnupChart({ data }) {
  if (!data.length) return <EmptyChart>No point-based scope to chart.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
        <ChartGrid />
        <XAxis dataKey="date" tickFormatter={value => new Date(`${value}T12:00:00Z`).toLocaleDateString()} {...axisProps} />
        <YAxis {...axisProps} width={34} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="stepAfter" dataKey="totalScope" name="Scope" stroke="var(--chart-red)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="cumulativeCompleted" name="Completed" stroke="var(--chart-green)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
