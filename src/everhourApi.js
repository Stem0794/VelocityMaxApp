const API = 'https://api.everhour.com';
const PAGE_SIZE = 50;

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
  const all = [];
  let page = 1;

  while (true) {
    const data = await everhourGet(apiKey, `/projects?limit=${PAGE_SIZE}&page=${page}`);
    const items = Array.isArray(data) ? data : [];
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
    page++;
  }

  return all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Returns budget summary for the given project IDs.
// Fetches each project individually to get complete budget data.
export async function fetchEverhourBudgets(apiKey, projectIds = []) {
  const projects = await Promise.all(
    projectIds.map(id =>
      everhourGet(apiKey, `/projects/${encodeURIComponent(id)}`).catch(() => null)
    )
  );

  return projects.filter(Boolean).map(p => {
    const b = p.budget;

    // Log raw budget data so the actual API field names are visible in the browser console
    console.log('[Everhour]', p.name, JSON.stringify({ budget: b, time: p.time }, null, 2));

    const isFinancial = b?.type === 'financial' || b?.type === 'money';

    // Try common field names for budget total and consumed
    const rawTotal = b?.value ?? b?.amount ?? b?.total ?? null;
    // For consumed: progress field, or fall back to project-level time (seconds)
    const rawConsumed = b?.progress ?? b?.spent ?? b?.consumed ?? p.time ?? null;

    let budgetDisplay, consumedDisplay, percentUsed;

    if (isFinancial) {
      // Financial budget — values are in the team's currency (€)
      budgetDisplay = rawTotal != null ? formatEuros(rawTotal) : null;
      consumedDisplay = rawConsumed != null ? formatEuros(rawConsumed) : null;
      percentUsed = rawTotal ? Math.round((rawConsumed / rawTotal) * 100) : null;
    } else {
      // Time budget — values in seconds, display as hours
      const budgetH = rawTotal != null ? Math.round(rawTotal / 3600 * 10) / 10 : null;
      const consumedH = rawConsumed != null ? Math.round(rawConsumed / 3600 * 10) / 10 : null;
      budgetDisplay = budgetH != null ? `${budgetH}h` : null;
      consumedDisplay = consumedH != null ? `${consumedH}h` : null;
      percentUsed = budgetH ? Math.round((consumedH / budgetH) * 100) : null;
    }

    return {
      id: String(p.id),
      name: p.name || 'Unnamed',
      isFinancial,
      budgetDisplay,
      consumedDisplay,
      percentUsed,
    };
  });
}

function formatEuros(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}
