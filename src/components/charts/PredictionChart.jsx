import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, ChartGrid, ChartTooltip } from './ChartPrimitives';

export default function PredictionChart({ data }) {
  return (
    <>
      <div className="forecast-summary">
        <span><b className="tone-good">Optimistic</b>{data.completionDates.optimistic}</span>
        <span><b>Average</b>{data.completionDates.avg}</span>
        <span><b className="tone-bad">Pessimistic</b>{data.completionDates.pessimistic}</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data.chartData} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
          <ChartGrid />
          <XAxis dataKey="date" tickFormatter={value => new Date(`${value}T12:00:00Z`).toLocaleDateString()} {...axisProps} />
          <YAxis {...axisProps} width={34} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="actual" name="Actual remaining" stroke="var(--chart-blue)" strokeWidth={2} dot={false} connectNulls={false} />
          <Line dataKey="avg" name="Average" stroke="var(--chart-purple)" strokeDasharray="5 5" dot={false} />
          <Line dataKey="optimistic" name="Optimistic" stroke="var(--chart-green)" strokeDasharray="5 5" dot={false} />
          <Line dataKey="pessimistic" name="Pessimistic" stroke="var(--chart-red)" strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}
