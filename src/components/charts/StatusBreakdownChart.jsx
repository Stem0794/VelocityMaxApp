import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, ChartGrid, ChartTooltip, EmptyChart } from './ChartPrimitives';

export default function StatusBreakdownChart({ data, statuses, selectedStatuses, setSelectedStatuses, loadingHistory, historyProgress }) {
  return (
    <>
      <div className="status-chip-row">
        {statuses.map(status => {
          const active = selectedStatuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              className={`status-chip-v2${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => setSelectedStatuses(previous => active ? previous.filter(value => value !== status) : [...previous, status])}
            >
              {status}
            </button>
          );
        })}
      </div>
      {loadingHistory ? <div className="chart-inline-status">Loading history {historyProgress.done}/{historyProgress.total}</div> : null}
      {data.length ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 12, right: 8, bottom: 36, left: 0 }}>
            <ChartGrid />
            <XAxis dataKey="status" angle={-24} textAnchor="end" interval={0} height={58} {...axisProps} />
            <YAxis {...axisProps} width={34} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="avg" name="Average days" fill="var(--chart-purple)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="median" name="Median days" fill="var(--chart-blue)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyChart>No status history in the current scope.</EmptyChart>}
    </>
  );
}
