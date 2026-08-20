import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps } from './chartConfig';
import { ChartGrid, ChartTooltip, EmptyChart } from './ChartPrimitives';

export default function BurndownChart({ data }) {
  if (!data.length) return <EmptyChart>No point data for this cycle.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
        <ChartGrid />
        <XAxis dataKey="date" tickFormatter={value => new Date(`${value}T12:00:00Z`).toLocaleDateString()} {...axisProps} />
        <YAxis {...axisProps} width={34} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line dataKey="remaining" name="Remaining" stroke="var(--chart-purple)" strokeWidth={2} dot={false} />
        <Line dataKey="ideal" name="Ideal" stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
