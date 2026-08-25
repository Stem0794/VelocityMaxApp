import { Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps } from './chartConfig';
import { ChartGrid, ChartTooltip, EmptyChart } from './ChartPrimitives';

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
        <Area type="monotone" stackId="1" dataKey="Backlog" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.32} />
        <Area type="monotone" stackId="1" dataKey="In Progress" stroke="var(--chart-purple)" fill="var(--chart-purple)" fillOpacity={0.4} />
        <Area type="monotone" stackId="1" dataKey="Done" stroke="var(--chart-green)" fill="var(--chart-green)" fillOpacity={0.38} />
        <Area type="monotone" stackId="1" dataKey="Cancelled" stroke="var(--chart-red)" fill="var(--chart-red)" fillOpacity={0.24} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
