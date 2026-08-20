import { Download } from 'lucide-react';
import { useState } from 'react';

function getHealthGrade(score) {
  if (score >= 85) return { grade: 'A', label: 'Excellent', tone: 'good' };
  if (score >= 70) return { grade: 'B', label: 'Good', tone: 'good' };
  if (score >= 55) return { grade: 'C', label: 'Fair', tone: 'warn' };
  if (score >= 40) return { grade: 'D', label: 'Needs attention', tone: 'warn' };
  return { grade: 'F', label: 'At risk', tone: 'bad' };
}

function factorTone(score) {
  return score >= 75 ? 'good' : score >= 50 ? 'warn' : 'bad';
}

function factorStatus(score) {
  return score >= 75 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
}

function drawSnapshot({ healthScore, presetName, team, metrics }) {
  const width = 1200;
  const height = 420;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas export is not supported by this browser.');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#0f1b2d';
  ctx.fillRect(20, 20, width - 40, height - 40);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 24px system-ui';
  ctx.fillText('VelocityMAX', 48, 62);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui';
  ctx.fillText([presetName, team].filter(Boolean).join(' · '), 48, 88);
  const grade = getHealthGrade(healthScore.overall);
  const toneColor = grade.tone === 'good' ? '#34d399' : grade.tone === 'warn' ? '#fbbf24' : '#fb7185';
  ctx.fillStyle = toneColor;
  ctx.font = '800 64px system-ui';
  ctx.fillText(String(healthScore.overall), 48, 180);
  ctx.font = '700 28px system-ui';
  ctx.fillText(`${grade.grade} · ${grade.label}`, 48, 218);
  ctx.fillStyle = '#64748b';
  ctx.font = '12px system-ui';
  ctx.fillText('TEAM HEALTH SCORE', 48, 244);

  const kpis = [
    ['Issues', metrics.totalIssues], ['Delivered', metrics.completedIssues],
    ['Story points', metrics.totalPoints], ['Avg cycle', metrics.avgCycleTime == null ? '—' : `${metrics.avgCycleTime}d`],
  ];
  kpis.forEach(([label, value], index) => {
    const x = 320 + index * 205;
    ctx.fillStyle = '#172337';
    ctx.fillRect(x, 112, 180, 92);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 28px system-ui';
    ctx.fillText(String(value), x + 18, 152);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui';
    ctx.fillText(label.toUpperCase(), x + 18, 180);
  });
  healthScore.factors.forEach((factor, index) => {
    const x = 320 + index * 205;
    const tone = factorTone(factor.score);
    const color = tone === 'good' ? '#34d399' : tone === 'warn' ? '#fbbf24' : '#fb7185';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui';
    ctx.fillText(factor.label.toUpperCase(), x, 275);
    ctx.fillStyle = color;
    ctx.font = '700 17px system-ui';
    ctx.fillText(factor.value, x, 304);
    ctx.fillStyle = '#263349';
    ctx.fillRect(x, 324, 180, 5);
    ctx.fillStyle = color;
    ctx.fillRect(x, 324, 180 * factor.score / 100, 5);
  });
  ctx.fillStyle = '#64748b';
  ctx.font = '11px system-ui';
  ctx.fillText(`Generated ${new Date().toLocaleString()}`, 48, height - 40);
  return canvas;
}

export default function HealthScore({ healthScore, presetName, team, metrics }) {
  const [exportError, setExportError] = useState('');
  if (!healthScore) return null;
  const grade = getHealthGrade(healthScore.overall);

  const exportSnapshot = async () => {
    setExportError('');
    try {
      const canvas = drawSnapshot({ healthScore, presetName, team, metrics });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not generate the PNG.');
      const filename = `velocitymax-${new Date().toISOString().slice(0, 10)}.png`;
      if (navigator.share && navigator.canShare && typeof File !== 'undefined') {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'VelocityMAX snapshot' });
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      if (error?.name !== 'AbortError') setExportError(error.message || 'Could not export the snapshot.');
    }
  };

  return (
    <section className="health-card-v2" aria-label="Team health score">
      <div className="health-score-block">
        <div className={`health-score-ring tone-${grade.tone}`}>
          <strong>{healthScore.overall}</strong><span>/100</span>
        </div>
        <div>
          <div className={`health-grade-v2 tone-${grade.tone}`}>{grade.grade}</div>
          <div className="health-grade-label-v2">{grade.label}</div>
        </div>
      </div>
      <div className="health-factors-v2">
        {healthScore.factors.map(factor => (
          <div key={factor.key} className="health-factor-v2">
            <div className="health-factor-top"><span>{factor.label}</span><strong className={`tone-${factorTone(factor.score)}`}>{factorStatus(factor.score)}</strong></div>
            <div className="health-factor-value-v2">{factor.value}</div>
            <div className="health-factor-track"><span className={`tone-bg-${factorTone(factor.score)}`} style={{ width: `${factor.score}%` }} /></div>
          </div>
        ))}
      </div>
      <button className="subtle-btn health-export" type="button" onClick={exportSnapshot}>
        <Download size={14} aria-hidden="true" /> Export PNG
      </button>
      {exportError ? <p className="inline-error health-export-error" role="alert">{exportError}</p> : null}
    </section>
  );
}
