import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps } from './chartConfig';
import { ChartTooltip, EmptyChart } from './ChartPrimitives';

export default function CycleTimesChart({ data }) {
  if (!data.length) return <EmptyChart>No cycle-time data in the current scope.</EmptyChart>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis type="number" dataKey="completed" domain={['dataMin', 'dataMax']} tickFormatter={value => new Date(value).toLocaleDateString()} {...axisProps} />
        <YAxis type="number" dataKey="cycleTime" {...axisProps} width={34} />
        <Tooltip content={<ChartTooltip />} />
        <Scatter name="Cycle time" data={data}>
          {data.map((entry, index) => (
            <Cell key={`${entry.completed}-${index}`} fill={entry.cycleTime > 14 ? 'var(--chart-red)' : 'var(--chart-blue)'} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
