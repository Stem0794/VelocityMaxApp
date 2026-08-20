const API = 'https://api.linear.app/graphql';

async function gql(apiKey, query, variables = {}) {
  let response;
  try {
    response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('Network error — could not reach Linear API. Check your connection.');
  }
  if (!response.ok) throw new Error(`Linear API returned HTTP ${response.status}`);
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map(error => error.message).join('; '));
  return json.data;
}

export async function fetchTeamName(apiKey, teamId) {
  const data = await gql(apiKey, `query($id:String!){team(id:$id){name}}`, { id: teamId });
  return data.team?.name || teamId;
}

export async function fetchTeams(apiKey) {
  const data = await gql(apiKey, `query { teams(first: 50) { nodes { id name } } }`);
  return data.teams.nodes.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchProjects(apiKey, teamId) {
  const data = await gql(apiKey, `
    query($teamId: String!) {
      team(id: $teamId) { projects(first: 100) { nodes { id name } } }
    }
  `, { teamId });
  return (data.team?.projects?.nodes || []).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchWorkflowStates(apiKey, teamId) {
  const data = await gql(apiKey, `
    query($teamId: String!) {
      team(id: $teamId) { states { nodes { id name type } } }
    }
  `, { teamId });
  return (data.team?.states?.nodes || []).sort((a, b) => a.name.localeCompare(b.name)).map(state => state.name);
}

export async function fetchIssues(apiKey, teamId, projectIds = []) {
  const issues = [];
  let cursor = null;
  const withProjects = projectIds.length > 0;

  do {
    const variables = { teamId, first: 100 };
    if (cursor) variables.after = cursor;
    if (withProjects) variables.projectIds = projectIds;
    const definitions = [
      '$teamId: String!', '$first: Int!', cursor ? '$after: String' : null,
      withProjects ? '$projectIds: [ID!]!' : null,
    ].filter(Boolean).join(', ');
    const data = await gql(apiKey, `
      query(${definitions}) {
        team(id: $teamId) {
          issues(first: $first ${cursor ? 'after: $after' : ''} orderBy: createdAt
            ${withProjects ? 'filter: { project: { id: { in: $projectIds } } }' : ''}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id identifier title estimate priority priorityLabel createdAt completedAt canceledAt startedAt
              state { name type }
              assignee { name }
              project { name }
              labels { nodes { name } }
              cycle { number startsAt endsAt }
            }
          }
        }
      }
    `, variables);
    const connection = data.team?.issues;
    if (!connection) break;
    issues.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (cursor);

  return issues;
}

async function fetchIssueHistory(apiKey, issueId) {
  const history = [];
  let cursor = null;
  do {
    const variables = { issueId, first: 50 };
    if (cursor) variables.after = cursor;
    const data = await gql(apiKey, `
      query($issueId: String!, $first: Int!${cursor ? ', $after: String' : ''}) {
        issue(id: $issueId) {
          history(first: $first${cursor ? ', after: $after' : ''}) {
            pageInfo { hasNextPage endCursor }
            nodes { createdAt fromState { name } toState { name } }
          }
        }
      }
    `, variables);
    const connection = data.issue?.history;
    if (!connection) break;
    history.push(...connection.nodes.filter(node => node.fromState && node.toState));
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (cursor);
  return history.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function fetchStatusHistories(apiKey, issues, onProgress) {
  const batchSize = 10;
  const failures = [];
  let completed = 0;
  for (let index = 0; index < issues.length; index += batchSize) {
    const batch = issues.slice(index, index + batchSize);
    await Promise.all(batch.map(async issue => {
      try {
        issue._history = await fetchIssueHistory(apiKey, issue.id);
      } catch (error) {
        issue._history = [];
        failures.push({ id: issue.identifier || issue.id, message: error.message });
      } finally {
        completed += 1;
        onProgress?.(completed, issues.length, failures.length);
      }
    }));
    if (index + batchSize < issues.length) await new Promise(resolve => setTimeout(resolve, 400));
  }
  return { failures };
}

function computeTimeByStatus(issue) {
  const history = issue._history || [];
  if (!history.length) return {};
  const result = {};
  history.forEach((entry, index) => {
    const name = entry.fromState.name;
    const start = index === 0 ? new Date(issue.createdAt) : new Date(history[index - 1].createdAt);
    const days = Math.max(0, (new Date(entry.createdAt) - start) / 86400000);
    result[name] = (result[name] || 0) + days;
  });
  const last = history.at(-1);
  const until = issue.completedAt ? new Date(issue.completedAt) : issue.canceledAt ? new Date(issue.canceledAt) : new Date();
  const tail = Math.max(0, (until - new Date(last.createdAt)) / 86400000);
  result[last.toState.name] = (result[last.toState.name] || 0) + tail;
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Math.round(value * 10) / 10]));
}

export function processIssues(issues) {
  return issues.map(issue => {
    const cycleTime = issue.startedAt && issue.completedAt
      ? Math.round(((new Date(issue.completedAt) - new Date(issue.startedAt)) / 86400000) * 10) / 10
      : null;
    const leadTime = issue.completedAt
      ? Math.round(((new Date(issue.completedAt) - new Date(issue.createdAt)) / 86400000) * 10) / 10
      : null;
    return {
      id: issue.identifier,
      title: issue.title,
      points: issue.estimate || 0,
      priority: issue.priorityLabel || '',
      assignee: issue.assignee?.name || '',
      project: issue.project?.name || '',
      labels: issue.labels?.nodes.map(label => label.name).join(', ') || '',
      currentStatus: issue.state?.name || '',
      currentStatusType: issue.state?.type || '',
      cycleNumber: issue.cycle?.number || '',
      cycleStartsAt: issue.cycle?.startsAt || '',
      cycleEndsAt: issue.cycle?.endsAt || '',
      createdAt: issue.createdAt || '',
      startedAt: issue.startedAt || '',
      completedAt: issue.completedAt || '',
      canceledAt: issue.canceledAt || '',
      cycleTimeDays: cycleTime,
      leadTimeDays: leadTime,
      timeByStatus: computeTimeByStatus(issue),
    };
  });
}

export function computeBurnupData(issues) {
  if (!issues.length) return [];
  const dailyMap = {};
  const add = (dateValue, field, points) => {
    if (!dateValue) return;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return;
    const day = date.toISOString().split('T')[0];
    dailyMap[day] ||= { created: 0, completed: 0 };
    dailyMap[day][field] += points;
  };
  issues.forEach(issue => {
    const points = Number(issue.points) || 0;
    add(issue.createdAt, 'created', points);
    add(issue.completedAt, 'completed', points);
  });
  let created = 0;
  let completed = 0;
  return Object.keys(dailyMap).sort().map(date => {
    created += dailyMap[date].created;
    completed += dailyMap[date].completed;
    return { date, cumulativeCreated: created, totalScope: created, cumulativeCompleted: completed };
  });
}
