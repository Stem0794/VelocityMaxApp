import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Attempt to load dotenv if available (for local testing)
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
} catch {
  // dotenv not available or not needed in CI
}

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const API_KEY = process.env.LINEAR_API_KEY;
const TEAM_ID = process.env.LINEAR_TEAM_ID;
// Expected format: comma separated string e.g., "PROJ1,PROJ2"
const PROJECT_IDS_ENV = process.env.LINEAR_PROJECT_IDS;

if (!API_KEY) {
  console.error("Missing LINEAR_API_KEY environment variable. Exiting.");
  process.exit(1);
}

if (!TEAM_ID) {
  console.error("Missing LINEAR_TEAM_ID environment variable. Exiting.");
  process.exit(1);
}

const projectIds = PROJECT_IDS_ENV ? PROJECT_IDS_ENV.split(',').map(s => s.trim()) : [];

// --------------- Low-level GraphQL helper ---------------
async function linearQuery(query, variables) {
  const payload = { query };
  if (variables) payload.variables = variables;

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors) {
    const errorMsg = 'Linear API error: ' + json.errors.map(e => e.message).join(', ');
    throw new Error(errorMsg);
  }
  return json.data;
}

// --------------- Issues ---------------
async function fetchIssuesForProject(teamId, projectIds) {
  let allIssues = [];
  let hasMore = true;
  let cursor = null;

  while (hasMore) {
    const variables = { teamId, first: 100 };
    if (cursor) variables.after = cursor;

    let filterClauseParts = [];
    if (projectIds && projectIds.length > 0) {
      variables.projectIds = projectIds;
      filterClauseParts.push('project: { id: { in: $projectIds } }');
    }

    let filterClause = '';
    if (filterClauseParts.length > 0) {
      filterClause = ', filter: { ' + filterClauseParts.join(', ') + ' }';
    }

    let queryVariables = '$teamId: String!, $first: Int!, $after: String';
    if (projectIds && projectIds.length > 0) queryVariables += ', $projectIds: [ID!]!';

    const query = `query(${queryVariables}) {
      team(id: $teamId) {
        issues(first: $first, after: $after${filterClause}, orderBy: createdAt) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id identifier title
            estimate
            priority priorityLabel
            createdAt completedAt canceledAt startedAt
            state { id name type }
            assignee { name }
            project { id name }
            labels { nodes { name } }
            cycle { id number startsAt endsAt }
          }
        }
      }
    }`;

    console.log(`Fetching issues... ${allIssues.length} so far`);
    const data = await linearQuery(query, variables);
    const connection = data.team.issues;
    allIssues = allIssues.concat(connection.nodes);
    hasMore = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return allIssues;
}

// --------------- Issue status history ---------------
async function fetchStatusHistories(issues) {
  const BATCH_SIZE = 10;
  for (let i = 0; i < issues.length; i += BATCH_SIZE) {
    console.log(`Fetching history for batch ${i} to ${i + BATCH_SIZE} of ${issues.length}`);
    const batch = issues.slice(i, i + BATCH_SIZE);
    
    // Fetch concurrently for the batch
    await Promise.all(batch.map(async (issue) => {
      issue._statusHistory = await fetchSingleIssueHistory(issue.id);
    }));
    
    if (i + BATCH_SIZE < issues.length) {
      // sleep to avoid rate limits
      await new Promise(res => setTimeout(res, 500));
    }
  }
  return issues;
}

async function fetchSingleIssueHistory(issueId) {
  let history = [];
  let hasMore = true;
  let cursor = null;

  while (hasMore) {
    const variables = { issueId, first: 50 };
    if (cursor) variables.after = cursor;

    const query = `query($issueId: String!, $first: Int!, $after: String) {
      issue(id: $issueId) {
        history(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            createdAt
            fromState { id name type }
            toState { id name type }
          }
        }
      }
    }`;

    const data = await linearQuery(query, variables);
    const connection = data.issue.history;

    const stateChanges = connection.nodes.filter(entry => entry.fromState && entry.toState);
    history = history.concat(stateChanges);
    hasMore = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  history.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return history;
}

// --------------- Process Data ---------------
function computeTimeByStatus(issue) {
  const history = issue._statusHistory || [];
  const result = {};

  if (!history.length) return result;

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const statusName = entry.fromState.name;
    let start = i === 0 ? new Date(issue.createdAt) : new Date(history[i - 1].createdAt);
    let end = new Date(entry.createdAt);
    let days = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));

    if (!result[statusName]) result[statusName] = 0;
    result[statusName] += days;
  }

  const lastTransition = history[history.length - 1];
  const currentStatus = lastTransition.toState.name;
  const sinceLastTransition = new Date(lastTransition.createdAt);
  const until = issue.completedAt ? new Date(issue.completedAt) :
                issue.canceledAt ? new Date(issue.canceledAt) : new Date();

  const daysInCurrent = Math.max(0, (until - sinceLastTransition) / (1000 * 60 * 60 * 24));
  if (!result[currentStatus]) result[currentStatus] = 0;
  result[currentStatus] += daysInCurrent;

  Object.keys(result).forEach(k => {
    result[k] = Math.round(result[k] * 10) / 10;
  });

  return result;
}

function processIssues(issues) {
  return issues.map(issue => {
    const timeByStatus = computeTimeByStatus(issue);
    let cycleTime = null;
    let leadTime = null;

    if (issue.startedAt && issue.completedAt) {
      cycleTime = Math.round(((new Date(issue.completedAt) - new Date(issue.startedAt)) / (1000 * 60 * 60 * 24)) * 10) / 10;
    }
    if (issue.completedAt) {
      leadTime = Math.round(((new Date(issue.completedAt) - new Date(issue.createdAt)) / (1000 * 60 * 60 * 24)) * 10) / 10;
    }

    return {
      id: issue.identifier,
      title: issue.title,
      points: issue.estimate || 0,
      priority: issue.priorityLabel || '',
      assignee: issue.assignee ? issue.assignee.name : '',
      project: issue.project ? issue.project.name : '',
      labels: issue.labels ? issue.labels.nodes.map(l => l.name).join(', ') : '',
      currentStatus: issue.state ? issue.state.name : '',
      currentStatusType: issue.state ? issue.state.type : '',
      cycleNumber: issue.cycle ? issue.cycle.number : '',
      cycleStartsAt: issue.cycle ? issue.cycle.startsAt || '' : '',
      cycleEndsAt: issue.cycle ? issue.cycle.endsAt || '' : '',
      createdAt: issue.createdAt || '',
      startedAt: issue.startedAt || '',
      completedAt: issue.completedAt || '',
      canceledAt: issue.canceledAt || '',
      cycleTimeDays: cycleTime,
      leadTimeDays: leadTime,
      timeByStatus: timeByStatus
    };
  });
}

function computeBurnupBurndownData(processedIssues) {
  if (!processedIssues || processedIssues.length === 0) return [];

  let minDate = new Date();
  let maxDate = new Date(0);

  processedIssues.forEach(issue => {
    if (issue.createdAt) {
      let d = new Date(issue.createdAt);
      if (d < minDate) minDate = d;
    }
    if (issue.completedAt) {
      let d = new Date(issue.completedAt);
      if (d > maxDate) maxDate = d;
    }
    if (issue.canceledAt) {
      let d = new Date(issue.canceledAt);
      if (d > maxDate) maxDate = d;
    }
    if (issue.createdAt) {
      let d = new Date(issue.createdAt);
      if (d > maxDate) maxDate = d;
    }
  });

  if (maxDate.getTime() === new Date(0).getTime()) maxDate = new Date();
  if (minDate > new Date()) minDate = new Date();

  const dailyData = {};
  const sortedIssues = [...processedIssues].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  sortedIssues.forEach(issue => {
    const createdAt = new Date(issue.createdAt);
    const completedAt = issue.completedAt ? new Date(issue.completedAt) : null;
    const points = issue.points || 0;

    let currentDate = new Date(minDate);
    while (currentDate <= createdAt) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!dailyData[dateStr]) dailyData[dateStr] = { date: new Date(currentDate), created: 0, completed: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const createdDateStr = createdAt.toISOString().split('T')[0];
    if (!dailyData[createdDateStr]) dailyData[createdDateStr] = { date: new Date(createdAt), created: 0, completed: 0 };
    dailyData[createdDateStr].created += points;

    if (completedAt) {
      const completedDateStr = completedAt.toISOString().split('T')[0];
      if (!dailyData[completedDateStr]) dailyData[completedDateStr] = { date: new Date(completedAt), created: 0, completed: 0 };
      dailyData[completedDateStr].completed += points;
    }
  });

  const result = [];
  let cumulativeCreated = 0;
  let cumulativeCompleted = 0;

  let currentDate = new Date(minDate);
  while (currentDate <= maxDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const data = dailyData[dateStr] || { date: new Date(currentDate), created: 0, completed: 0 };

    cumulativeCreated += data.created;
    cumulativeCompleted += data.completed;

    result.push({
      date: data.date.toISOString(),
      cumulativeCreated,
      cumulativeCompleted,
      totalScope: cumulativeCreated
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return result;
}

// --------------- Fetch team name ---------------
async function fetchTeamName(teamId) {
  const query = `query($teamId: String!) { team(id: $teamId) { name } }`;
  const data = await linearQuery(query, { teamId });
  return data.team?.name || teamId;
}

// --------------- Fetch workflow states ---------------
async function fetchWorkflowStates(teamId) {
  const query = `query($teamId: String!) {
    team(id: $teamId) { states { nodes { id name type } } }
  }`;
  const data = await linearQuery(query, { teamId });
  return (data.team?.states?.nodes || [])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => s.name);
}

// --------------- Main ---------------
async function main() {
  console.log('Fetching team info...');
  const [teamName, workflowStates] = await Promise.all([
    fetchTeamName(TEAM_ID),
    fetchWorkflowStates(TEAM_ID),
  ]);
  console.log(`Team: ${teamName}, States: ${workflowStates.join(', ')}`);

  console.log('Fetching raw issues...');
  const issues = await fetchIssuesForProject(TEAM_ID, projectIds);
  console.log(`Found ${issues.length} issues.`);

  console.log('Fetching status histories...');
  const issuesWithHistory = await fetchStatusHistories(issues);

  console.log('Processing issues...');
  const processed = processIssues(issuesWithHistory);
  const burnupData = computeBurnupBurndownData(processed);

  const outputData = {
    issues: processed,
    burnupData: burnupData,
    workflowStates: workflowStates,
    lastUpdated: new Date().toISOString(),
    team: teamName
  };

  const outPath = path.resolve(__dirname, '../public/data.json');
  fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2));
  console.log(`Successfully wrote data to ${outPath}`);
}

main().catch(err => {
  console.error("Error in fetch-data.js:", err);
  process.exit(1);
});
