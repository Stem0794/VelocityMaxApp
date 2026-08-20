import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps } from './chartConfig';
import { ChartGrid, ChartTooltip } from './ChartPrimitives';

export default function LeadTimeChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
        <ChartGrid />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} width={34} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" name="Issues" fill="var(--chart-blue)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
