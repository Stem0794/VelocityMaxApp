export function sprintBurndownUnit(issues, cycleNumber) {
  const cycleIssues = (issues || []).filter(issue => String(issue.cycleNumber) === String(cycleNumber));
  return cycleIssues.some(issue => (Number(issue.points) || 0) > 0) ? 'points' : 'issues';
}

export function prepareSprintBurndownIssues(issues, cycleNumber) {
  const source = issues || [];
  const unit = sprintBurndownUnit(source, cycleNumber);
  if (!cycleNumber || unit === 'points') return { issues: source, unit };
  return {
    unit,
    issues: source.map(issue => String(issue.cycleNumber) === String(cycleNumber)
      ? { ...issue, points: 1 }
      : issue),
  };
}
