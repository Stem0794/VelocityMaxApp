function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getISOWeekLabel(dateValue) {
  const input = validDate(dateValue);
  if (!input) return '';
  const d = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getISOWeekStart(dateValue) {
  const input = validDate(dateValue);
  if (!input) return null;
  const d = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

export function computeVelocityWithTrend(issues, asOfDate) {
  const completed = issues.filter(issue => validDate(issue.completedAt));
  if (!completed.length) return [];
  const completedDates = completed.map(issue => new Date(issue.completedAt));
  const earliest = new Date(Math.min(...completedDates));
  const latest = new Date(Math.max(...completedDates));
  const requestedEnd = validDate(asOfDate) || latest;
  const effectiveEnd = requestedEnd < latest ? latest : requestedEnd;
  const cursor = getISOWeekStart(earliest);
  const endWeek = getISOWeekStart(effectiveEnd);
  const weekMap = {};

  while (cursor && endWeek && cursor <= endWeek) {
    const week = getISOWeekLabel(cursor);
    weekMap[week] = { week, points: 0, count: 0 };
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  completed.forEach(issue => {
    const week = getISOWeekLabel(issue.completedAt);
    if (!weekMap[week]) weekMap[week] = { week, points: 0, count: 0 };
    weekMap[week].points += Number(issue.points) || 0;
    weekMap[week].count += 1;
  });

  const sorted = Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
  return sorted.map((entry, index) => {
    const window = sorted.slice(Math.max(0, index - 3), index + 1);
    const rollingAvgCount = Math.round((window.reduce((sum, week) => sum + week.count, 0) / window.length) * 10) / 10;
    const rollingAvgPoints = Math.round((window.reduce((sum, week) => sum + week.points, 0) / window.length) * 10) / 10;
    return { ...entry, rollingAvgCount, rollingAvgPoints };
  });
}

export function computeLeadTimeHistogram(issues) {
  const buckets = [
    { label: '≤3d', test: days => days <= 3 },
    { label: '3–7d', test: days => days > 3 && days <= 7 },
    { label: '1–2w', test: days => days > 7 && days <= 14 },
    { label: '2–4w', test: days => days > 14 && days <= 30 },
    { label: '>30d', test: days => days > 30 },
  ];
  const counts = buckets.map(bucket => ({ label: bucket.label, count: 0 }));
  issues.forEach(issue => {
    const days = Number(issue.leadTimeDays);
    if (!Number.isFinite(days) || days < 0) return;
    const index = buckets.findIndex(bucket => bucket.test(days));
    if (index >= 0) counts[index].count += 1;
  });
  return counts;
}

function sprintCompletionDate(issue) {
  return validDate(issue.linearCompletedAt) || validDate(issue.completedAt);
}

export function computeSprintBurndown(issues, cycleNumber) {
  if (!cycleNumber) return [];
  const sprintIssues = issues.filter(issue => String(issue.cycleNumber) === String(cycleNumber));
  if (!sprintIssues.length) return [];
  const timestamps = values => values.map(value => validDate(value)?.getTime()).filter(Number.isFinite);
  const starts = timestamps(sprintIssues.map(issue => issue.cycleStartsAt));
  const ends = timestamps(sprintIssues.map(issue => issue.cycleEndsAt));
  const observed = timestamps(sprintIssues.flatMap(issue => [issue.createdAt, issue.startedAt, issue.linearCompletedAt, issue.completedAt, issue.canceledAt]));
  if ((!starts.length || !ends.length) && !observed.length) return [];
  const startTime = starts.length ? Math.min(...starts) : Math.min(...observed);
  const endTime = ends.length ? Math.max(...ends) : Math.max(...observed);
  const start = new Date(startTime);
  const end = new Date(Math.max(startTime, endTime));
  const sprintStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const sprintEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const totalPoints = sprintIssues.reduce((sum, issue) => sum + (Number(issue.points) || 0), 0);
  if (totalPoints <= 0) return [];

  const msPerDay = 86400000;
  const dayCount = Math.floor((sprintEnd - sprintStart) / msPerDay) + 1;
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(sprintStart.getTime() + index * msPerDay);
    const dayEnd = new Date(date.getTime() + msPerDay - 1);
    const completedPoints = sprintIssues.reduce((sum, issue) => {
      const completed = sprintCompletionDate(issue);
      return completed && completed <= dayEnd ? sum + (Number(issue.points) || 0) : sum;
    }, 0);
    return {
      date: date.toISOString().split('T')[0],
      remaining: Math.max(0, totalPoints - completedPoints),
      ideal: dayCount > 1 ? Math.round(totalPoints * (1 - index / (dayCount - 1)) * 10) / 10 : 0,
    };
  });
}

export function computeCumulativeFlow(issues, asOfDate) {
  const withCreated = issues.filter(issue => validDate(issue.createdAt));
  if (!withCreated.length) return [];
  const minDate = new Date(Math.min(...withCreated.map(issue => new Date(issue.createdAt))));
  const requestedEnd = validDate(asOfDate) || new Date();
  const latestIssueDate = new Date(Math.max(...withCreated.flatMap(issue => [issue.createdAt, issue.completedAt, issue.canceledAt]
    .map(value => validDate(value)?.getTime()).filter(Number.isFinite))));
  const maxDate = requestedEnd < latestIssueDate ? latestIssueDate : requestedEnd;
  const startDate = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), minDate.getUTCDate()));
  startDate.setUTCDate(startDate.getUTCDate() - ((startDate.getUTCDay() + 6) % 7));

  const result = [];
  for (let cursor = new Date(startDate); cursor <= maxDate; cursor = new Date(cursor.getTime() + 7 * 86400000)) {
    const snap = new Date(cursor);
    let Backlog = 0; let InProgress = 0; let Done = 0; let Cancelled = 0;
    withCreated.forEach(issue => {
      const created = validDate(issue.createdAt);
      if (!created || created > snap) return;
      const completed = validDate(issue.completedAt);
      const cancelled = validDate(issue.canceledAt);
      const started = validDate(issue.startedAt);
      if (completed && completed <= snap) Done += 1;
      else if (cancelled && cancelled <= snap) Cancelled += 1;
      else if (started && started <= snap) InProgress += 1;
      else Backlog += 1;
    });
    result.push({ date: snap.toISOString().split('T')[0], Backlog, 'In Progress': InProgress, Done, Cancelled });
  }
  return result;
}

export function computeFlowEfficiency(issues) {
  const efficiencies = issues.flatMap(issue => {
    const cycle = Number(issue.cycleTimeDays);
    const lead = Number(issue.leadTimeDays);
    if (!Number.isFinite(cycle) || !Number.isFinite(lead) || cycle < 0 || lead <= 0) return [];
    return [Math.max(0, Math.min(100, Math.round((cycle / lead) * 100)))];
  });
  if (!efficiencies.length) return null;
  const avg = Math.round(efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length);
  const bucketDefs = [
    { label: '0–20%', min: 0, max: 20 },
    { label: '20–40%', min: 20, max: 40 },
    { label: '40–60%', min: 40, max: 60 },
    { label: '60–80%', min: 60, max: 80 },
    { label: '80–100%', min: 80, max: 101 },
  ];
  const distribution = bucketDefs.map(bucket => ({
    label: bucket.label,
    count: efficiencies.filter(value => value >= bucket.min && value < bucket.max).length,
  }));
  return { avg, distribution };
}

export function computePrediction(issues, velocityData, asOfDate = new Date()) {
  if (!issues.length || !velocityData.length) return null;
  const totalPoints = issues.reduce((sum, issue) => sum + (Number(issue.points) || 0), 0);
  const completedPoints = issues.filter(issue => issue.completedAt)
    .reduce((sum, issue) => sum + (Number(issue.points) || 0), 0);
  const remaining = Math.max(0, totalPoints - completedPoints);
  const last4 = velocityData.slice(-4).map(week => Number(week.points) || 0);
  if (!last4.length) return null;

  const avgVelocity = Math.max(0.1, last4.reduce((sum, value) => sum + value, 0) / last4.length);
  const optimisticVelocity = Math.max(0.1, Math.max(...last4));
  const nonZero = last4.filter(value => value > 0);
  const pessimisticVelocity = Math.max(0.1, nonZero.length ? Math.min(...nonZero) : avgVelocity * 0.5);
  const dailyMap = {};
  issues.forEach(issue => {
    const created = validDate(issue.createdAt);
    if (!created) return;
    const createdKey = created.toISOString().split('T')[0];
    dailyMap[createdKey] ||= { created: 0, completed: 0 };
    dailyMap[createdKey].created += Number(issue.points) || 0;
    const completed = validDate(issue.completedAt);
    if (completed) {
      const completedKey = completed.toISOString().split('T')[0];
      dailyMap[completedKey] ||= { created: 0, completed: 0 };
      dailyMap[completedKey].completed += Number(issue.points) || 0;
    }
  });

  let cumulativeCreated = 0; let cumulativeCompleted = 0;
  const historical = Object.keys(dailyMap).sort().map(date => {
    cumulativeCreated += dailyMap[date].created;
    cumulativeCompleted += dailyMap[date].completed;
    return { date, actual: Math.max(0, cumulativeCreated - cumulativeCompleted) };
  });

  const baseDate = validDate(asOfDate) || new Date();
  const today = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
  const forecast = [];
  let remAvg = remaining; let remOpt = remaining; let remPes = remaining;
  for (let week = 0; week <= 52; week += 1) {
    const date = new Date(today.getTime() + week * 7 * 86400000).toISOString().split('T')[0];
    forecast.push({
      date,
      avg: Math.max(0, Math.round(remAvg * 10) / 10),
      optimistic: Math.max(0, Math.round(remOpt * 10) / 10),
      pessimistic: Math.max(0, Math.round(remPes * 10) / 10),
    });
    remAvg -= avgVelocity; remOpt -= optimisticVelocity; remPes -= pessimisticVelocity;
    if (remAvg <= 0 && remOpt <= 0 && remPes <= 0) break;
  }

  const completionDate = scenario => {
    const entry = forecast.find(point => point[scenario] <= 0);
    return entry ? new Date(`${entry.date}T12:00:00Z`).toLocaleDateString() : 'Beyond 52 weeks';
  };
  const chartMap = new Map();
  historical.forEach(point => chartMap.set(point.date, point));
  forecast.forEach(point => chartMap.set(point.date, { ...(chartMap.get(point.date) || { date: point.date }), ...point }));
  return {
    chartData: [...chartMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    remaining,
    completionDates: {
      avg: completionDate('avg'),
      optimistic: completionDate('optimistic'),
      pessimistic: completionDate('pessimistic'),
    },
  };
}
