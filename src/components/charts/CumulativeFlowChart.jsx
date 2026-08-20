import { Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, ChartGrid, ChartTooltip, EmptyChart } from './ChartPrimitives';

export default function CumulativeFlowChart({ data }) {
  if (!data.length) return <EmptyChart>No cumulative-flow data available.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
        <ChartGrid />
        <XAxis dataKey="date" tickFormatter={value => new Date(`${value}T12:00:00Z`).toLocaleDateString()} {...axisProps} />
        <YAxis {...axisProps} width={34} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" stackId="1" dataKey="Backlog" stroke="var(--text-secondary)" fill="rgba(148,163,184,.32)" />
        <Area type="monotone" stackId="1" dataKey="In Progress" stroke="var(--chart-purple)" fill="rgba(139,92,246,.4)" />
        <Area type="monotone" stackId="1" dataKey="Done" stroke="var(--chart-green)" fill="rgba(16,185,129,.38)" />
        <Area type="monotone" stackId="1" dataKey="Cancelled" stroke="var(--chart-red)" fill="rgba(239,68,68,.24)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
