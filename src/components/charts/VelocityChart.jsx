import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { axisProps, ChartGrid, ChartTooltip, EmptyChart } from './ChartPrimitives';

export default function VelocityChart({ data }) {
  if (!data.length) return <EmptyChart>No completed issues to chart yet.</EmptyChart>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
        <ChartGrid />
        <XAxis dataKey="week" {...axisProps} />
        <YAxis yAxisId="points" {...axisProps} width={34} />
        <YAxis yAxisId="tickets" orientation="right" {...axisProps} width={34} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="points" dataKey="points" name="Points" fill="var(--chart-purple)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="tickets" dataKey="count" name="Tickets" stroke="var(--chart-red)" strokeWidth={2} dot={{ r: 2 }} />
        <Line yAxisId="tickets" dataKey="rollingAvgCount" name="4-wk avg" stroke="var(--chart-green)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
