import React, { useState } from 'react';

function PresetForm({ preset, onSave, onCancel }) {
  const [name, setName] = useState(preset?.name || '');
  const [teamId, setTeamId] = useState(preset?.teamId || '');
  const [projectIds, setProjectIds] = useState(preset?.projectIds?.join(', ') || '');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: preset?.id || Date.now().toString(),
      name: name.trim(),
      teamId: teamId.trim(),
      projectIds: projectIds.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  return (
    <div className="preset-form">
      <div className="preset-form-row">
        <label>Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. TFS"
          autoFocus
        />
      </div>
      <div className="preset-form-row">
        <label>Team ID</label>
        <input
          value={teamId}
          onChange={e => setTeamId(e.target.value)}
          placeholder="Linear team UUID (leave empty for demo data)"
        />
      </div>
      <div className="preset-form-row">
        <label>Project IDs</label>
        <input
          value={projectIds}
          onChange={e => setProjectIds(e.target.value)}
          placeholder="UUID1, UUID2, UUID3 (leave empty for all projects)"
        />
      </div>
      <div className="preset-form-actions">
        <button className="btn-secondary" onClick={onCancel} type="button">Cancel</button>
        <button onClick={handleSave} type="button">Save Preset</button>
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

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
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
            Stored in your browser only. Find it at Linear → Settings → API → Personal API keys.
          </p>
        </div>

        <div className="settings-section">
          <label className="settings-label">Presets</label>
          <p className="settings-hint" style={{ marginBottom: '0.75rem' }}>
            Each preset defines a team + project combination. Team ID and Project IDs are UUIDs from Linear URLs.
          </p>

          <div className="preset-list">
            {localPresets.map(p => (
              <div key={p.id} className="preset-item">
                {editingId === p.id ? (
                  <PresetForm
                    preset={p}
                    onSave={handleSavePreset}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="preset-item-row">
                    <div className="preset-item-info">
                      <span className="preset-item-name">{p.name}</span>
                      <span className="preset-item-detail">
                        {p.teamId
                          ? `Team: …${p.teamId.slice(-8)}`
                          : 'No team — loads demo data'}
                        {p.projectIds?.length > 0 && ` · ${p.projectIds.length} project${p.projectIds.length > 1 ? 's' : ''}`}
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
            <PresetForm onSave={handleSavePreset} onCancel={() => setAdding(false)} />
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
