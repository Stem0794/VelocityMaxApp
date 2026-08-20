import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps } from './chartConfig';
import { ChartGrid, ChartTooltip, EmptyChart } from './ChartPrimitives';

export default function FlowEfficiencyChart({ data }) {
  if (!data) return <EmptyChart>Not enough data to calculate flow efficiency.</EmptyChart>;
  return (
    <>
      <div className="chart-highlight"><strong>{data.avg}%</strong><span>average flow efficiency</span></div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.distribution} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <ChartGrid />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} width={34} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Issues" fill="var(--chart-purple)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
