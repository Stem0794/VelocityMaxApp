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
    projectIds.map(id => everhourGet(apiKey, `/projects/${encodeURIComponent(id)}`))
  );

  return projects.map(p => {
    const b = p.budget;

    if (!b) {
      return { id: String(p.id), name: p.name || 'Unnamed', budgetDisplay: null, consumedDisplay: null, percentUsed: null };
    }

    // Total budget is in b.budget (nested), consumed in b.progress.
    // Money values are in cents (e.g. 1070000 = €10,700).
    const totalRaw = b.budget ?? b.value ?? null;
    const consumedRaw = b.progress ?? null;
    const isMoneyType = b.type === 'money' || b.type === 'financial';

    let budgetDisplay, consumedDisplay, percentUsed;

    if (isMoneyType) {
      budgetDisplay = totalRaw != null ? formatEuros(totalRaw / 100) : null;
      consumedDisplay = consumedRaw != null ? formatEuros(consumedRaw / 100) : null;
      percentUsed = totalRaw ? Math.round((consumedRaw / totalRaw) * 100) : null;
    } else {
      // Time budget — values in seconds
      const budgetH = totalRaw != null ? Math.round(totalRaw / 3600 * 10) / 10 : null;
      const consumedH = consumedRaw != null ? Math.round(consumedRaw / 3600 * 10) / 10 : null;
      budgetDisplay = budgetH != null ? `${budgetH}h` : null;
      consumedDisplay = consumedH != null ? `${consumedH}h` : null;
      percentUsed = budgetH ? Math.round((consumedH / budgetH) * 100) : null;
    }

    return {
      id: String(p.id),
      name: p.name || 'Unnamed',
      isFinancial: isMoneyType,
      budgetDisplay,
      consumedDisplay,
      percentUsed,
    };
  });
}

export async function fetchMonthlyHours(apiKey, projectIds, monthsBack = 12) {
  const to = new Date().toISOString().split('T')[0];
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - monthsBack);
  const from = fromDate.toISOString().split('T')[0];

  const allEntries = [];
  for (const projectId of projectIds) {
    let page = 1;
    while (true) {
      const params = new URLSearchParams({ from, to, limit: 250, page });
      const data = await everhourGet(apiKey, `/projects/${encodeURIComponent(projectId)}/time?${params}`).catch(() => []);
      const items = Array.isArray(data) ? data : [];
      allEntries.push(...items.map(e => ({ ...e, _projectId: String(projectId) })));
      if (items.length < 250) break;
      page++;
    }
  }

  // Aggregate by month and project
  const monthMap = {};
  allEntries.forEach(entry => {
    const month = entry.date?.slice(0, 7);
    if (!month) return;
    const projectId = entry._projectId;
    const hours = Math.round((entry.time || 0) / 3600 * 10) / 10;
    if (!monthMap[month]) monthMap[month] = { month };
    monthMap[month][projectId] = (monthMap[month][projectId] || 0) + hours;
  });

  return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
}

function formatEuros(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}
