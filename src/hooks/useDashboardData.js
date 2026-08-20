import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeBurnupData, fetchIssues, fetchStatusHistories, fetchTeamName, fetchWorkflowStates, processIssues,
} from '../linearApi';
import { fetchEverhourBudgets } from '../everhourApi';

const REFRESH_MS = { '5m': 300000, '15m': 900000, '30m': 1800000 };

export default function useDashboardData({ isAuthenticated, activePreset, apiKey, everhourApiKey, autoRefreshInterval }) {
  const [data, setData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyProgress, setHistoryProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [error, setError] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [historyWarning, setHistoryWarning] = useState('');
  const fetchSeq = useRef(0);
  const dataRef = useRef(null);
  const loadedPresetIdRef = useRef(null);
  const loadedSourceRef = useRef(null);

  const publishData = useCallback(next => {
    dataRef.current = next;
    setData(next);
  }, []);

  const load = useCallback(async ({ forceClear = false } = {}) => {
    if (!isAuthenticated || !activePreset) return;
    const preset = activePreset;
    const seq = ++fetchSeq.current;
    const sourceSignature = JSON.stringify({
      id: preset.id,
      teamId: preset.teamId || '',
      projectIds: preset.projectIds || [],
      deliveryRules: preset.deliveryRules || {},
    });
    const clear = forceClear || loadedPresetIdRef.current !== preset.id || loadedSourceRef.current !== sourceSignature || !dataRef.current;
    if (clear) {
      setLoading(true);
      publishData(null);
      setBudgetData(null);
    } else {
      setRefreshing(true);
    }
    setError(''); setBudgetError(''); setHistoryWarning(''); setLoadingHistory(false);
    setHistoryProgress({ done: 0, total: 0, failed: 0 });

    const loadBudget = async () => {
      if (!everhourApiKey || !preset.everhourProjectIds?.length) {
        if (fetchSeq.current === seq) setBudgetData(null);
        return;
      }
      try {
        const rows = await fetchEverhourBudgets(everhourApiKey, preset.everhourProjectIds);
        if (fetchSeq.current === seq) setBudgetData(rows);
      } catch (budgetErr) {
        if (fetchSeq.current === seq) { setBudgetData(null); setBudgetError(budgetErr.message || 'Could not load Everhour budgets.'); }
      }
    };
    void loadBudget();

    try {
      if (!preset.teamId || !apiKey) {
        const response = await fetch(`${import.meta.env.BASE_URL}data.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Demo data is not available yet.');
        const json = await response.json();
        if (fetchSeq.current !== seq) return;
        loadedPresetIdRef.current = preset.id;
        loadedSourceRef.current = sourceSignature;
        publishData(json);
        return;
      }

      const [teamName, rawIssues, workflowStates] = await Promise.all([
        preset.teamName ? Promise.resolve(preset.teamName) : fetchTeamName(apiKey, preset.teamId),
        fetchIssues(apiKey, preset.teamId, preset.projectIds),
        fetchWorkflowStates(apiKey, preset.teamId),
      ]);
      if (fetchSeq.current !== seq) return;
      const processed = processIssues(rawIssues, preset.deliveryRules || {});
      const coreData = {
        issues: processed, burnupData: computeBurnupData(processed), workflowStates,
        lastUpdated: new Date().toISOString(), team: teamName,
      };
      loadedPresetIdRef.current = preset.id;
      loadedSourceRef.current = sourceSignature;
      publishData(coreData);

      if (!rawIssues.length) return;
      setLoadingHistory(true);
      setHistoryProgress({ done: 0, total: rawIssues.length, failed: 0 });
      const { failures } = await fetchStatusHistories(apiKey, rawIssues, (done, total, failed) => {
        if (fetchSeq.current === seq) setHistoryProgress({ done, total, failed });
      });
      if (fetchSeq.current !== seq) return;
      const historyProcessed = processIssues(rawIssues, preset.deliveryRules || {});
      const withHistory = {
        ...coreData,
        issues: historyProcessed,
        burnupData: computeBurnupData(historyProcessed),
      };
      publishData(withHistory);
      if (failures.length) {
        setHistoryWarning(`${failures.length} issue histor${failures.length === 1 ? 'y' : 'ies'} could not be loaded. Time-in-status and configured delivery milestones may be partial.`);
      }
    } catch (loadError) {
      if (fetchSeq.current === seq) setError(loadError.message || 'Could not load dashboard data.');
    } finally {
      if (fetchSeq.current === seq) { setLoading(false); setRefreshing(false); setLoadingHistory(false); }
    }
  }, [activePreset, apiKey, everhourApiKey, isAuthenticated, publishData]);

  useEffect(() => {
    if (isAuthenticated) return;
    fetchSeq.current += 1;
    dataRef.current = null;
    loadedPresetIdRef.current = null;
    loadedSourceRef.current = null;
    setData(null);
    setBudgetData(null);
    setLoading(false);
    setRefreshing(false);
    setLoadingHistory(false);
    setHistoryProgress({ done: 0, total: 0, failed: 0 });
    setError('');
    setBudgetError('');
    setHistoryWarning('');
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !activePreset) return;
    void load({ forceClear: loadedPresetIdRef.current !== activePreset.id });
  }, [activePreset, isAuthenticated, load]);

  useEffect(() => {
    const ms = REFRESH_MS[autoRefreshInterval];
    if (!ms || !isAuthenticated || !activePreset) return undefined;
    const timer = window.setInterval(() => { void load(); }, ms);
    return () => window.clearInterval(timer);
  }, [activePreset, autoRefreshInterval, isAuthenticated, load]);

  return {
    data, budgetData, loading, refreshing, loadingHistory, historyProgress,
    error, budgetError, historyWarning,
    refresh: () => load(), retry: () => load({ forceClear: !dataRef.current }),
  };
}
