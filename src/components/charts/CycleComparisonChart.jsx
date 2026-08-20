import { Bar, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps } from './chartConfig';
import { ChartGrid, ChartTooltip } from './ChartPrimitives';

export default function CycleComparisonChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
        <ChartGrid />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis yAxisId="left" {...axisProps} width={34} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={value => `${value}%`} {...axisProps} width={38} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="points" name="Points" fill="var(--chart-purple)" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="tickets" name="Tickets" fill="var(--chart-blue)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" dataKey="completionPct" name="Completion %" stroke="var(--chart-green)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
