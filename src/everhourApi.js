const API = 'https://api.everhour.com';

async function everhourGet(apiKey, path) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      headers: { 'X-Api-Key': apiKey },
    });
  } catch {
    throw new Error('Network error — could not reach Everhour API.');
  }
  if (!res.ok) throw new Error(`Everhour API returned HTTP ${res.status}`);
  return res.json();
}

export async function fetchEverhourProjects(apiKey) {
  const data = await everhourGet(apiKey, '/projects?limit=250');
  return (Array.isArray(data) ? data : [])
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Returns budget summary for the given project IDs (or all if none given).
// Everhour time values are in seconds.
export async function fetchEverhourBudgets(apiKey, projectIds = []) {
  const all = await fetchEverhourProjects(apiKey);
  const filtered = projectIds.length > 0
    ? all.filter(p => projectIds.includes(String(p.id)))
    : all;

  return filtered.map(p => {
    const budgetSec = p.budget?.value ?? null;
    const consumedSec = p.budget?.progress ?? null;
    const percent = budgetSec ? Math.round((consumedSec / budgetSec) * 100) : null;
    return {
      id: String(p.id),
      name: p.name || 'Unnamed',
      budgetType: p.budget?.type || 'time',
      budgetHours: budgetSec != null ? Math.round(budgetSec / 3600 * 10) / 10 : null,
      consumedHours: consumedSec != null ? Math.round(consumedSec / 3600 * 10) / 10 : null,
      percentUsed: percent,
    };
  });
}
