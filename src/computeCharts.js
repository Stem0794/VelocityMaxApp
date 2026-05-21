// Pure computation functions for chart data — no React dependencies.

function getISOWeekLabel(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getFullYear() + '-W' + (weekNo < 10 ? '0' : '') + weekNo;
}

/**
 * Same as the velocityData useMemo in App.jsx but adds `rollingAvgCount`
 * (rolling 4-week average of ticket count) to each week object.
 */
export function computeVelocityWithTrend(filteredIssues) {
  const completed = filteredIssues.filter(i => i.completedAt);
  const weekMap = {};
  completed.forEach(p => {
    const week = getISOWeekLabel(p.completedAt);
    if (!weekMap[week]) weekMap[week] = { week, points: 0, count: 0 };
    weekMap[week].points += p.points || 0;
    weekMap[week].count += 1;
  });
  const sorted = Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
  return sorted.map((entry, idx) => {
    const window = sorted.slice(Math.max(0, idx - 3), idx + 1);
    const rollingAvgCount = Math.round(
      (window.reduce((s, w) => s + w.count, 0) / window.length) * 10
    ) / 10;
    return { ...entry, rollingAvgCount };
  });
}

/**
 * Bucket completed issues (leadTimeDays != null) into named ranges.
 * Returns array of { label, count }.
 */
export function computeLeadTimeHistogram(filteredIssues) {
  const buckets = [
    { label: '≤3d', min: 0, max: 3 },
    { label: '3–7d', min: 3, max: 7 },
    { label: '1–2w', min: 7, max: 14 },
    { label: '2–4w', min: 14, max: 30 },
    { label: '>30d', min: 30, max: Infinity },
  ];
  const counts = buckets.map(b => ({ label: b.label, count: 0 }));
  filteredIssues.forEach(i => {
    if (i.leadTimeDays == null) return;
    const days = i.leadTimeDays;
    const idx = buckets.findIndex(b => days >= b.min && days < b.max);
    if (idx !== -1) counts[idx].count++;
  });
  return counts;
}

/**
 * Build a daily burndown array for a given cycle.
 * Returns array of { date, remaining, ideal } or [] if no matching issues.
 */
export function computeSprintBurndown(allIssues, cycleNumber) {
  if (!cycleNumber) return [];
  const sprintIssues = allIssues.filter(i => String(i.cycleNumber) === String(cycleNumber));
  if (!sprintIssues.length) return [];

  // Determine sprint window from cycleStartsAt / cycleEndsAt on issues
  const starts = sprintIssues.map(i => i.cycleStartsAt).filter(Boolean);
  const ends = sprintIssues.map(i => i.cycleEndsAt).filter(Boolean);
  if (!starts.length || !ends.length) return [];

  const sprintStart = new Date(starts.reduce((a, b) => a < b ? a : b));
  const sprintEnd = new Date(ends.reduce((a, b) => a > b ? a : b));

  const totalPoints = sprintIssues.reduce((s, i) => s + (i.points || 0), 0);
  if (totalPoints === 0) return [];

  const msPerDay = 86400000;
  const days = Math.ceil((sprintEnd - sprintStart) / msPerDay) + 1;
  const result = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(sprintStart.getTime() + d * msPerDay);
    const dateStr = date.toISOString().split('T')[0];
    const completedByDay = sprintIssues.reduce((s, i) => {
      if (i.completedAt && new Date(i.completedAt) <= date) return s + (i.points || 0);
      return s;
    }, 0);
    const remaining = Math.max(0, totalPoints - completedByDay);
    const ideal = Math.round(totalPoints * (1 - d / (days - 1)) * 10) / 10;
    result.push({ date: dateStr, remaining, ideal });
  }

  return result;
}

/**
 * Weekly sample of issues in each simplified phase.
 * Returns array of { date, Backlog, 'In Progress', Done, Cancelled }.
 */
export function computeCumulativeFlow(filteredIssues) {
  if (!filteredIssues.length) return [];

  const dates = filteredIssues.map(i => new Date(i.createdAt));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date();

  // Snap to Monday of that week
  const startDate = new Date(minDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

  const result = [];
  const msPerWeek = 7 * 86400000;
  let cursor = new Date(startDate);

  while (cursor <= maxDate) {
    const snap = new Date(cursor);
    let Backlog = 0, InProgress = 0, Done = 0, Cancelled = 0;

    filteredIssues.forEach(i => {
      const created = new Date(i.createdAt);
      if (created > snap) return; // not yet created

      const completed = i.completedAt ? new Date(i.completedAt) : null;
      const cancelled = i.canceledAt ? new Date(i.canceledAt) : null;
      const started = i.startedAt ? new Date(i.startedAt) : null;

      if (completed && completed <= snap) {
        Done++;
      } else if (cancelled && cancelled <= snap) {
        Cancelled++;
      } else if (started && started <= snap) {
        InProgress++;
      } else {
        Backlog++;
      }
    });

    result.push({
      date: snap.toISOString().split('T')[0],
      Backlog,
      'In Progress': InProgress,
      Done,
      Cancelled,
    });

    cursor = new Date(cursor.getTime() + msPerWeek);
  }

  return result;
}

/**
 * Flow efficiency for completed issues.
 * Returns { avg, distribution } or null if no data.
 */
export function computeFlowEfficiency(filteredIssues) {
  const eligible = filteredIssues.filter(
    i => i.completedAt && i.cycleTimeDays > 0 && i.leadTimeDays > 0
  );
  if (!eligible.length) return null;

  const efficiencies = eligible.map(i =>
    Math.round((i.cycleTimeDays / i.leadTimeDays) * 100)
  );

  const avg = Math.round(efficiencies.reduce((s, e) => s + e, 0) / efficiencies.length);

  const bucketDefs = [
    { label: '0–20%', min: 0, max: 20 },
    { label: '20–40%', min: 20, max: 40 },
    { label: '40–60%', min: 40, max: 60 },
    { label: '60–80%', min: 60, max: 80 },
    { label: '80–100%', min: 80, max: 101 },
  ];
  const distribution = bucketDefs.map(b => ({
    label: b.label,
    count: efficiencies.filter(e => e >= b.min && e < b.max).length,
  }));

  return { avg, distribution };
}

/**
 * Scope prediction based on velocity.
 * Returns { chartData, remaining, completionDates } or null.
 */
export function computePrediction(filteredIssues, velocityData) {
  if (!filteredIssues.length || !velocityData.length) return null;

  const totalPoints = filteredIssues.reduce((s, i) => s + (i.points || 0), 0);
  const completedPoints = filteredIssues
    .filter(i => i.completedAt)
    .reduce((s, i) => s + (i.points || 0), 0);
  const remaining = totalPoints - completedPoints;

  const last4 = velocityData.slice(-4).map(w => w.points);
  if (!last4.length) return null;

  const avgVelocity = Math.max(0.1, last4.reduce((s, v) => s + v, 0) / last4.length);
  const optimisticVelocity = Math.max(0.1, Math.max(...last4));
  const pessimisticVelocity = Math.max(0.1, Math.min(...last4));

  // Build historical remaining scope (daily)
  const sorted = [...filteredIssues].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const dailyMap = {};
  sorted.forEach(issue => {
    const cd = new Date(issue.createdAt).toISOString().split('T')[0];
    if (!dailyMap[cd]) dailyMap[cd] = { created: 0, completed: 0 };
    dailyMap[cd].created += issue.points || 0;
    if (issue.completedAt) {
      const dd = new Date(issue.completedAt).toISOString().split('T')[0];
      if (!dailyMap[dd]) dailyMap[dd] = { created: 0, completed: 0 };
      dailyMap[dd].completed += issue.points || 0;
    }
  });

  let cumCreated = 0, cumCompleted = 0;
  const historical = Object.keys(dailyMap).sort().map(d => {
    cumCreated += dailyMap[d].created;
    cumCompleted += dailyMap[d].completed;
    return { date: d, actual: cumCreated - cumCompleted };
  });

  const today = new Date().toISOString().split('T')[0];

  // Build forecast
  const msPerWeek = 7 * 86400000;
  const forecast = [];
  let remAvg = remaining;
  let remOpt = remaining;
  let remPes = remaining;

  for (let week = 0; week <= 52; week++) {
    const d = new Date(new Date(today).getTime() + week * msPerWeek);
    const dateStr = d.toISOString().split('T')[0];
    forecast.push({
      date: dateStr,
      avg: Math.max(0, Math.round(remAvg * 10) / 10),
      optimistic: Math.max(0, Math.round(remOpt * 10) / 10),
      pessimistic: Math.max(0, Math.round(remPes * 10) / 10),
    });
    remAvg -= avgVelocity;
    remOpt -= optimisticVelocity;
    remPes -= pessimisticVelocity;
    if (remAvg <= 0 && remOpt <= 0 && remPes <= 0) break;
  }

  // Find completion dates
  const findCompletionDate = (scenario) => {
    const entry = forecast.find(f => f[scenario] <= 0);
    return entry ? new Date(entry.date).toLocaleDateString() : 'Beyond 52 weeks';
  };

  const completionDates = {
    avg: findCompletionDate('avg'),
    optimistic: findCompletionDate('optimistic'),
    pessimistic: findCompletionDate('pessimistic'),
  };

  // Merge historical and forecast — today's entry gets all 4 fields
  const chartMap = {};
  historical.forEach(h => { chartMap[h.date] = { date: h.date, actual: h.actual }; });
  forecast.forEach(f => {
    if (chartMap[f.date]) {
      chartMap[f.date] = { ...chartMap[f.date], ...f };
    } else {
      chartMap[f.date] = { ...f };
    }
  });

  const chartData = Object.values(chartMap).sort((a, b) => a.date.localeCompare(b.date));

  return { chartData, remaining, completionDates };
}
