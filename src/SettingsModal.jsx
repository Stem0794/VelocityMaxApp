import React, { useState, useEffect } from 'react';
import { fetchTeams, fetchProjects } from './linearApi';

function PresetForm({ preset, apiKey, onSave, onCancel }) {
  const [name, setName] = useState(preset?.name || '');
  const [teamId, setTeamId] = useState(preset?.teamId || '');
  const [teamName, setTeamName] = useState(preset?.teamName || '');
  const [projectIds, setProjectIds] = useState(preset?.projectIds || []);

  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Load teams when form opens (if API key is available)
  useEffect(() => {
    if (!apiKey) return;
    setLoadingTeams(true);
    setFetchError('');
    fetchTeams(apiKey)
      .then(setTeams)
      .catch(err => setFetchError(err.message))
      .finally(() => setLoadingTeams(false));
  }, [apiKey]);

  // Load projects when team changes
  useEffect(() => {
    if (!apiKey || !teamId) { setProjects([]); return; }
    setLoadingProjects(true);
    fetchProjects(apiKey, teamId)
      .then(list => {
        setProjects(list);
        // Drop any selected project IDs that don't exist in this team
        setProjectIds(prev => prev.filter(id => list.some(p => p.id === id)));
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, [apiKey, teamId]);

  const handleTeamChange = (e) => {
    const id = e.target.value;
    const selected = teams.find(t => t.id === id);
    setTeamId(id);
    setTeamName(selected?.name || '');
    setProjectIds([]);
  };

  const toggleProject = (id) => {
    setProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const selectedProjects = projects.filter(p => projectIds.includes(p.id));
    onSave({
      id: preset?.id || Date.now().toString(),
      name: name.trim(),
      teamId,
      teamName,
      projectIds,
      projectNames: selectedProjects.map(p => p.name),
    });
  };

  return (
    <div className="preset-form">
      <div className="preset-form-row">
        <label>Preset name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. TFS, Mobile, All"
          autoFocus
        />
      </div>

      <div className="preset-form-row">
        <label>Team</label>
        {!apiKey ? (
          <p className="settings-hint" style={{ margin: 0 }}>Enter your API key above to browse teams.</p>
        ) : loadingTeams ? (
          <p className="settings-hint" style={{ margin: 0 }}>Loading teams…</p>
        ) : fetchError ? (
          <p style={{ color: 'var(--chart-red)', fontSize: '0.8rem', margin: 0 }}>{fetchError}</p>
        ) : teams.length > 0 ? (
          <select className="preset-form-select" value={teamId} onChange={handleTeamChange}>
            <option value="">— Select a team —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <p className="settings-hint" style={{ margin: 0 }}>No teams found for this API key.</p>
        )}
      </div>

      {teamId && (
        <div className="preset-form-row">
          <label>
            Projects
            <span className="preset-form-label-note"> — leave all unchecked to include all projects</span>
          </label>
          {loadingProjects ? (
            <p className="settings-hint" style={{ margin: 0 }}>Loading projects…</p>
          ) : projects.length > 0 ? (
            <div className="project-checklist">
              {projects.map(p => (
                <label key={p.id} className="project-check-item">
                  <input
                    type="checkbox"
                    checked={projectIds.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="settings-hint" style={{ margin: 0 }}>No projects found for this team.</p>
          )}
        </div>
      )}

      <div className="preset-form-actions">
        <button className="btn-secondary" onClick={onCancel} type="button">Cancel</button>
        <button onClick={handleSave} type="button" disabled={!name.trim()}>Save Preset</button>
      </div>
    </div>
  );
}

export default function SettingsModal({ apiKey, presets, onSave, onClose }) {
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localPresets, setLocalPresets] = useState(presets);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const handleSavePreset = (preset) => {
    if (editingId) {
      setLocalPresets(prev => prev.map(p => p.id === editingId ? preset : p));
      setEditingId(null);
    } else {
      setLocalPresets(prev => [...prev, preset]);
      setAdding(false);
    }
  };

  const handleDelete = (id) => setLocalPresets(prev => prev.filter(p => p.id !== id));

  const handleSave = () => {
    onSave({ apiKey: localApiKey.trim(), presets: localPresets });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="settings-section">
          <label className="settings-label">Linear API Key</label>
          <input
            type="password"
            className="settings-input"
            value={localApiKey}
            onChange={e => setLocalApiKey(e.target.value)}
            placeholder="lin_api_xxxxxxxxxxxx"
          />
          <p className="settings-hint">
            Stored in your browser only. Get it from Linear → Settings → API → Personal API keys.
          </p>
        </div>

        <div className="settings-section">
          <label className="settings-label">Presets</label>
          <p className="settings-hint" style={{ marginBottom: '0.75rem' }}>
            Each preset is a saved view — a team and optional project selection.
          </p>

          <div className="preset-list">
            {localPresets.map(p => (
              <div key={p.id} className="preset-item">
                {editingId === p.id ? (
                  <PresetForm
                    preset={p}
                    apiKey={localApiKey}
                    onSave={handleSavePreset}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="preset-item-row">
                    <div className="preset-item-info">
                      <span className="preset-item-name">{p.name}</span>
                      <span className="preset-item-detail">
                        {p.teamName || (p.teamId ? `Team ID: …${p.teamId.slice(-8)}` : 'No team — loads demo data')}
                        {p.projectNames?.length > 0
                          ? ` · ${p.projectNames.join(', ')}`
                          : p.projectIds?.length > 0
                            ? ` · ${p.projectIds.length} project(s)`
                            : p.teamId ? ' · All projects' : ''}
                      </span>
                    </div>
                    <div className="preset-item-actions">
                      <button className="btn-icon-sm" onClick={() => setEditingId(p.id)} title="Edit">✎</button>
                      <button className="btn-icon-sm btn-danger" onClick={() => handleDelete(p.id)} title="Delete">✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {adding ? (
            <PresetForm
              apiKey={localApiKey}
              onSave={handleSavePreset}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              className="btn-secondary"
              style={{ width: 'auto', marginTop: '0.75rem' }}
              onClick={() => setAdding(true)}
              type="button"
            >
              + Add Preset
            </button>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} type="button">Cancel</button>
          <button onClick={handleSave} type="button">Save Settings</button>
        </div>
      </div>
    </div>
  );
}
