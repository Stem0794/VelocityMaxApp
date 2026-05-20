const API = 'https://api.linear.app/graphql';

async function gql(apiKey, query, variables = {}) {
  let res;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('Network error — could not reach Linear API. Check your connection.');
  }
  if (!res.ok) throw new Error(`Linear API returned HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '));
  return json.data;
}

export async function fetchTeamName(apiKey, teamId) {
  const d = await gql(apiKey, `query($id:String!){team(id:$id){name}}`, { id: teamId });
  return d.team?.name || teamId;
}

export async function fetchIssues(apiKey, teamId, projectIds = []) {
  const issues = [];
  let cursor = null;
  const withProjects = projectIds.length > 0;

  do {
    const vars = { teamId, first: 100 };
    if (cursor) vars.after = cursor;
    if (withProjects) vars.projectIds = projectIds;

    const varDefs = [
      '$teamId: String!', '$first: Int!',
      cursor ? '$after: String' : null,
      withProjects ? '$projectIds: [ID!]!' : null,
    ].filter(Boolean).join(', ');

    const data = await gql(apiKey, `
      query(${varDefs}) {
        team(id: $teamId) {
          issues(
            first: $first
            ${cursor ? 'after: $after' : ''}
            orderBy: createdAt
            ${withProjects ? 'filter: { project: { id: { in: $projectIds } } }' : ''}
          ) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id identifier title estimate priority priorityLabel
              createdAt completedAt canceledAt startedAt
              state { name type }
              assignee { name }
              project { name }
              labels { nodes { name } }
              cycle { number }
            }
          }
        }
      }
    `, vars);

    const conn = data.team.issues;
    issues.push(...conn.nodes);
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (cursor);

  return issues;
}

async function fetchIssueHistory(apiKey, issueId) {
  let history = [], cursor = null;
  do {
    const vars = { issueId, first: 50 };
    if (cursor) vars.after = cursor;
    const data = await gql(apiKey, `
      query($issueId: String!, $first: Int!${cursor ? ', $after: String' : ''}) {
        issue(id: $issueId) {
          history(first: $first${cursor ? ', after: $after' : ''}) {
            pageInfo { hasNextPage endCursor }
            nodes { createdAt fromState { name } toState { name } }
          }
        }
      }
    `, vars);
    const conn = data.issue.history;
    history.push(...conn.nodes.filter(n => n.fromState && n.toState));
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (cursor);

  return history.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function fetchStatusHistories(apiKey, issues, onProgress) {
  const BATCH = 10;
  for (let i = 0; i < issues.length; i += BATCH) {
    await Promise.all(
      issues.slice(i, i + BATCH).map(async issue => {
        issue._history = await fetchIssueHistory(apiKey, issue.id);
      })
    );
    onProgress?.(Math.min(i + BATCH, issues.length), issues.length);
    if (i + BATCH < issues.length) await new Promise(r => setTimeout(r, 400));
  }
}

function computeTimeByStatus(issue) {
  const h = issue._history || [];
  if (!h.length) return {};
  const result = {};
  h.forEach((entry, i) => {
    const name = entry.fromState.name;
    const start = i === 0 ? new Date(issue.createdAt) : new Date(h[i - 1].createdAt);
    const days = Math.max(0, (new Date(entry.createdAt) - start) / 86400000);
    result[name] = (result[name] || 0) + days;
  });
  const last = h[h.length - 1];
  const until = issue.completedAt ? new Date(issue.completedAt)
    : issue.canceledAt ? new Date(issue.canceledAt) : new Date();
  const tail = Math.max(0, (until - new Date(last.createdAt)) / 86400000);
  result[last.toState.name] = (result[last.toState.name] || 0) + tail;
  return Object.fromEntries(Object.entries(result).map(([k, v]) => [k, Math.round(v * 10) / 10]));
}

export function processIssues(issues) {
  return issues.map(i => {
    const cycleTime = i.startedAt && i.completedAt
      ? Math.round(((new Date(i.completedAt) - new Date(i.startedAt)) / 86400000) * 10) / 10 : null;
    const leadTime = i.completedAt
      ? Math.round(((new Date(i.completedAt) - new Date(i.createdAt)) / 86400000) * 10) / 10 : null;
    return {
      id: i.identifier,
      title: i.title,
      points: i.estimate || 0,
      priority: i.priorityLabel || '',
      assignee: i.assignee?.name || '',
      project: i.project?.name || '',
      labels: i.labels?.nodes.map(l => l.name).join(', ') || '',
      currentStatus: i.state?.name || '',
      currentStatusType: i.state?.type || '',
      cycleNumber: i.cycle?.number || '',
      createdAt: i.createdAt || '',
      startedAt: i.startedAt || '',
      completedAt: i.completedAt || '',
      canceledAt: i.canceledAt || '',
      cycleTimeDays: cycleTime,
      leadTimeDays: leadTime,
      timeByStatus: computeTimeByStatus(i),
    };
  });
}

export function computeBurnupData(issues) {
  if (!issues.length) return [];
  const dailyMap = {};
  issues.forEach(i => {
    const cd = i.createdAt.split('T')[0];
    dailyMap[cd] = dailyMap[cd] || { created: 0, completed: 0 };
    dailyMap[cd].created += i.points || 0;
    if (i.completedAt) {
      const dd = i.completedAt.split('T')[0];
      dailyMap[dd] = dailyMap[dd] || { created: 0, completed: 0 };
      dailyMap[dd].completed += i.points || 0;
    }
  });
  let cumCreated = 0, cumCompleted = 0;
  return Object.keys(dailyMap).sort().map(d => {
    cumCreated += dailyMap[d].created;
    cumCompleted += dailyMap[d].completed;
    return { date: d, totalScope: cumCreated, cumulativeCompleted: cumCompleted };
  });
}
