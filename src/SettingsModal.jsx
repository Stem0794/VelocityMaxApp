import { CheckCircle2, Pencil, Plus, Trash2, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fetchProjects, fetchTeams } from './linearApi';
import { fetchEverhourProjects } from './everhourApi';

function PresetForm({ preset, linearKey, everhourKey, onSave, onCancel }) {
  const [name, setName] = useState(preset?.name || '');
  const [teamId, setTeamId] = useState(preset?.teamId || '');
  const [teamName, setTeamName] = useState(preset?.teamName || '');
  const [projectIds, setProjectIds] = useState(preset?.projectIds || []);
  const [everhourProjectIds, setEverhourProjectIds] = useState(preset?.everhourProjectIds || []);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [everhourProjects, setEverhourProjects] = useState([]);
  const [loading, setLoading] = useState({ teams: false, projects: false, everhour: false });
  const [error, setError] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [everhourSearch, setEverhourSearch] = useState('');

  useEffect(() => {
    if (!linearKey) {
      setTeams([]);
      return undefined;
    }
    let alive = true;
    setLoading(value => ({ ...value, teams: true }));
    fetchTeams(linearKey)
      .then(rows => { if (alive) setTeams(rows); })
      .catch(err => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(value => ({ ...value, teams: false })); });
    return () => { alive = false; };
  }, [linearKey]);

  useEffect(() => {
    if (!linearKey || !teamId) {
      setProjects([]);
      return undefined;
    }
    let alive = true;
    setLoading(value => ({ ...value, projects: true }));
    fetchProjects(linearKey, teamId)
      .then(rows => {
        if (!alive) return;
        setProjects(rows);
        setProjectIds(previous => previous.filter(id => rows.some(project => project.id === id)));
      })
      .catch(() => { if (alive) setProjects([]); })
      .finally(() => { if (alive) setLoading(value => ({ ...value, projects: false })); });
    return () => { alive = false; };
  }, [linearKey, teamId]);

  useEffect(() => {
    if (!everhourKey) {
      setEverhourProjects([]);
      return undefined;
    }
    let alive = true;
    setLoading(value => ({ ...value, everhour: true }));
    fetchEverhourProjects(everhourKey)
      .then(rows => { if (alive) setEverhourProjects(rows); })
      .catch(() => { if (alive) setEverhourProjects([]); })
      .finally(() => { if (alive) setLoading(value => ({ ...value, everhour: false })); });
    return () => { alive = false; };
  }, [everhourKey]);

  const save = () => {
    if (!name.trim()) return;
    onSave({
      ...preset,
      id: preset?.id || `preset-${Date.now()}`,
      name: name.trim(),
      teamId,
      teamName,
      projectIds,
      projectNames: projects.filter(project => projectIds.includes(project.id)).map(project => project.name),
      everhourProjectIds,
      everhourProjectNames: everhourProjects.filter(project => everhourProjectIds.includes(String(project.id))).map(project => project.name),
    });
  };

  return (
    <div className="preset-form-v2">
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      <label>
        Preset name
        <input value={name} onChange={event => setName(event.target.value)} autoFocus placeholder="Mobile, Platform, All…" />
      </label>
      <label>
        Team
        {!linearKey ? <span className="settings-note">Test the Linear connection to browse teams.</span> : loading.teams ? <span className="settings-note">Loading teams…</span> : (
          <select value={teamId} onChange={event => { const id = event.target.value; setTeamId(id); setTeamName(teams.find(team => team.id === id)?.name || ''); setProjectIds([]); }}>
            <option value="">Demo data / no team</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        )}
      </label>
      {teamId ? (
        <div className="preset-project-group">
          <div className="field-label">Linear projects <span>leave empty for all</span></div>
          {loading.projects ? <span className="settings-note">Loading projects…</span> : (
            <>
              <input className="project-search" value={projectSearch} onChange={event => setProjectSearch(event.target.value)} placeholder="Search projects" />
              <div className="project-checklist-v2">
                {projects.filter(project => project.name.toLowerCase().includes(projectSearch.toLowerCase())).map(project => (
                  <label key={project.id}>
                    <input type="checkbox" checked={projectIds.includes(project.id)} onChange={() => setProjectIds(previous => previous.includes(project.id) ? previous.filter(id => id !== project.id) : [...previous, project.id])} />
                    {project.name}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
      <div className="preset-project-group">
        <div className="field-label">Everhour projects <span>optional budget tracking</span></div>
        {!everhourKey ? <span className="settings-note">Test the Everhour connection to browse projects.</span> : loading.everhour ? <span className="settings-note">Loading Everhour projects…</span> : (
          <>
            <input className="project-search" value={everhourSearch} onChange={event => setEverhourSearch(event.target.value)} placeholder="Search Everhour projects" />
            <div className="project-checklist-v2">
              {everhourProjects.filter(project => (project.name || '').toLowerCase().includes(everhourSearch.toLowerCase())).map(project => {
                const id = String(project.id);
                return (
                  <label key={id}>
                    <input type="checkbox" checked={everhourProjectIds.includes(id)} onChange={() => setEverhourProjectIds(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id])} />
                    {project.name}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="preset-form-actions-v2">
        <button className="subtle-btn" type="button" onClick={onCancel}>Cancel</button>
        <button type="button" onClick={save} disabled={!name.trim()}>Save preset</button>
      </div>
    </div>
  );
}

function ConnectionStatus({ status }) {
  if (!status) return null;
  const ok = status.type === 'ok';
  const pending = status.type === 'pending';
  return (
    <span className={`connection-status ${ok ? 'ok' : pending ? '' : 'bad'}`}>
      {ok ? <CheckCircle2 size={14} aria-hidden="true" /> : pending ? null : <XCircle size={14} aria-hidden="true" />}
      {status.message}
    </span>
  );
}

export default function SettingsModal({ apiKey, everhourApiKey, presets, onSave, onClose, initialAdd = false }) {
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localEverhourApiKey, setLocalEverhourApiKey] = useState(everhourApiKey);
  const [localPresets, setLocalPresets] = useState(presets);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(initialAdd);
  const [linearStatus, setLinearStatus] = useState(apiKey ? { type: 'ok', message: 'Saved key' } : null);
  const [everhourStatus, setEverhourStatus] = useState(everhourApiKey ? { type: 'ok', message: 'Saved key' } : null);
  const [validatedLinearKey, setValidatedLinearKey] = useState(apiKey);
  const [validatedEverhourKey, setValidatedEverhourKey] = useState(everhourApiKey);
  const [deleteId, setDeleteId] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const testLinear = async () => {
    const key = localApiKey.trim();
    if (!key) {
      setLinearStatus({ type: 'bad', message: 'Enter a key first' });
      return;
    }
    setLinearStatus({ type: 'pending', message: 'Testing…' });
    try {
      const teams = await fetchTeams(key);
      setValidatedLinearKey(key);
      setLinearStatus({ type: 'ok', message: `Connected · ${teams.length} team${teams.length === 1 ? '' : 's'}` });
    } catch (error) {
      setValidatedLinearKey('');
      setLinearStatus({ type: 'bad', message: error.message });
    }
  };

  const testEverhour = async () => {
    const key = localEverhourApiKey.trim();
    if (!key) {
      setEverhourStatus({ type: 'bad', message: 'Enter a key first' });
      return;
    }
    setEverhourStatus({ type: 'pending', message: 'Testing…' });
    try {
      const projects = await fetchEverhourProjects(key);
      setValidatedEverhourKey(key);
      setEverhourStatus({ type: 'ok', message: `Connected · ${projects.length} project${projects.length === 1 ? '' : 's'}` });
    } catch (error) {
      setValidatedEverhourKey('');
      setEverhourStatus({ type: 'bad', message: error.message });
    }
  };

  const savePreset = preset => {
    setLocalPresets(previous => editingId
      ? previous.map(item => item.id === editingId ? preset : item)
      : [...previous, preset]);
    setEditingId(null);
    setAdding(false);
  };

  const usableLinearKey = validatedLinearKey === localApiKey.trim() ? validatedLinearKey : '';
  const usableEverhourKey = validatedEverhourKey === localEverhourApiKey.trim() ? validatedEverhourKey : '';

  return (
    <div className="modal-overlay-v2" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-card-v2" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} ref={dialogRef}>
        <div className="modal-header-v2">
          <div><div className="section-eyebrow">Configuration</div><h2 id="settings-title">Settings</h2></div>
          <button className="icon-action" type="button" onClick={onClose} aria-label="Close settings"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="settings-layout-v2">
          <section className="settings-section-v2">
            <h3>Connections</h3>
            <p>Keys stay in this browser. Test explicitly before using them to browse teams or projects.</p>
            <div className="connection-field">
              <label>Linear API key<input type="password" value={localApiKey} onChange={event => { setLocalApiKey(event.target.value); setLinearStatus(null); if (event.target.value !== apiKey) setValidatedLinearKey(''); }} placeholder="lin_api_…" /></label>
              <div className="connection-row"><ConnectionStatus status={linearStatus} /><button className="subtle-btn" type="button" onClick={testLinear}>Test connection</button></div>
            </div>
            <div className="connection-field">
              <label>Everhour API key<input type="password" value={localEverhourApiKey} onChange={event => { setLocalEverhourApiKey(event.target.value); setEverhourStatus(null); if (event.target.value !== everhourApiKey) setValidatedEverhourKey(''); }} placeholder="Everhour API key" /></label>
              <div className="connection-row"><ConnectionStatus status={everhourStatus} /><button className="subtle-btn" type="button" onClick={testEverhour}>Test connection</button></div>
            </div>
          </section>
          <section className="settings-section-v2">
            <div className="settings-section-heading">
              <div><h3>Presets</h3><p>Saved combinations of Linear and Everhour projects.</p></div>
              {!adding ? <button className="subtle-btn" type="button" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" /> Add preset</button> : null}
            </div>
            <div className="preset-list-v2">
              {localPresets.map(preset => (
                <div key={preset.id} className="preset-item-v2">
                  {editingId === preset.id ? (
                    <PresetForm preset={preset} linearKey={usableLinearKey} everhourKey={usableEverhourKey} onSave={savePreset} onCancel={() => setEditingId(null)} />
                  ) : (
                    <>
                      <div>
                        <strong>{preset.name}</strong>
                        <span>{preset.teamName || (preset.teamId ? 'Configured team' : 'Demo data')}{preset.projectNames?.length ? ` · ${preset.projectNames.join(', ')}` : preset.teamId ? ' · All projects' : ''}</span>
                      </div>
                      <div className="preset-item-actions-v2">
                        <button className="icon-action" type="button" onClick={() => setEditingId(preset.id)} aria-label={`Edit ${preset.name}`}><Pencil size={15} aria-hidden="true" /></button>
                        <button className="icon-action danger" type="button" onClick={() => setDeleteId(preset.id)} aria-label={`Delete ${preset.name}`}><Trash2 size={15} aria-hidden="true" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {adding ? <PresetForm linearKey={usableLinearKey} everhourKey={usableEverhourKey} onSave={savePreset} onCancel={() => setAdding(false)} /> : null}
          </section>
        </div>
        <div className="modal-footer-v2">
          <button className="subtle-btn" type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={() => { onSave({ apiKey: localApiKey.trim(), everhourApiKey: localEverhourApiKey.trim(), presets: localPresets }); onClose(); }}>Save settings</button>
        </div>
        {deleteId ? (
          <div className="confirm-overlay" role="alertdialog" aria-modal="true" aria-label="Confirm preset deletion">
            <div className="confirm-card">
              <h3>Delete preset?</h3>
              <p>This removes the preset from this browser. It does not delete anything in Linear or Everhour.</p>
              <div>
                <button className="subtle-btn" type="button" onClick={() => setDeleteId(null)}>Cancel</button>
                <button className="danger-btn" type="button" onClick={() => { setLocalPresets(previous => previous.filter(preset => preset.id !== deleteId)); setDeleteId(null); }}>Delete</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
