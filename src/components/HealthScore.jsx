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
  ctx.fillStyle = '#060c10';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#0d171c';
  ctx.fillRect(20, 20, width - 40, height - 40);
  ctx.fillStyle = '#12c8c7';
  ctx.fillRect(20, 20, 8, height - 40);
  ctx.fillStyle = '#f0f2f2';
  ctx.font = '700 24px system-ui';
  ctx.fillText('VelocityMAX', 52, 62);
  ctx.fillStyle = '#a5b6b8';
  ctx.font = '14px system-ui';
  ctx.fillText([presetName, team].filter(Boolean).join(' · '), 52, 88);
  const grade = getHealthGrade(healthScore.overall);
  const toneColor = grade.tone === 'good' ? '#58d6b7' : grade.tone === 'warn' ? '#e6b86a' : '#d85858';
  ctx.fillStyle = '#f0f2f2';
  ctx.font = '800 72px system-ui';
  ctx.fillText(String(healthScore.overall), 52, 185);
  ctx.fillStyle = toneColor;
  ctx.font = '700 24px system-ui';
  ctx.fillText(`${grade.grade} · ${grade.label}`, 52, 224);
  ctx.fillStyle = '#708589';
  ctx.font = '12px system-ui';
  ctx.fillText('DELIVERY HEALTH', 52, 250);

  const kpis = [
    ['Issues', metrics.totalIssues], ['Completed', metrics.completedIssues],
    ['Story points', metrics.totalPoints], ['Avg cycle', metrics.avgCycleTime == null ? '—' : `${metrics.avgCycleTime}d`],
  ];
  kpis.forEach(([label, value], index) => {
    const x = 360 + index * 196;
    ctx.fillStyle = '#121f27';
    ctx.fillRect(x, 108, 172, 92);
    ctx.fillStyle = '#f0f2f2';
    ctx.font = '700 28px system-ui';
    ctx.fillText(String(value), x + 16, 149);
    ctx.fillStyle = '#708589';
    ctx.font = '11px system-ui';
    ctx.fillText(label.toUpperCase(), x + 16, 176);
  });
  healthScore.factors.forEach((factor, index) => {
    const x = 360 + index * 196;
    const tone = factorTone(factor.score);
    const color = tone === 'good' ? '#58d6b7' : tone === 'warn' ? '#e6b86a' : '#d85858';
    ctx.fillStyle = '#708589';
    ctx.font = '11px system-ui';
    ctx.fillText(factor.label.toUpperCase(), x, 270);
    ctx.fillStyle = '#f0f2f2';
    ctx.font = '700 16px system-ui';
    ctx.fillText(factor.value, x, 296);
    ctx.fillStyle = '#26343b';
    ctx.fillRect(x, 318, 172, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x, 318, 172 * factor.score / 100, 4);
  });
  return canvas;
}

function OverviewMetric({ label, value, detail }) {
  return (
    <div className="overview-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export default function HealthScore({ healthScore, presetName, team, metrics }) {
  const [exportError, setExportError] = useState('');
  if (!healthScore) return null;
  const grade = getHealthGrade(healthScore.overall);
  const completion = metrics.totalIssues ? Math.round((metrics.completedIssues / metrics.totalIssues) * 100) : 0;

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
    <section className="overview-hero" aria-label="Delivery overview">
      <div className="overview-copy">
        <div className="section-eyebrow">Delivery overview</div>
        <div className="overview-title-row">
          <h1>{presetName || 'Workspace'}</h1>
          {team ? <span className="team-pill">{team}</span> : null}
        </div>
        <p>Flow, throughput and delivery health for the current scope.</p>
        <div className="health-lockup">
          <div className="health-number"><strong>{healthScore.overall}</strong><span>/100</span></div>
          <div className={`health-grade-pill tone-${grade.tone}`}>{grade.grade} · {grade.label}</div>
        </div>
        <button className="hero-export" type="button" onClick={exportSnapshot}>
          <Download size={15} aria-hidden="true" /> Export snapshot
        </button>
        {exportError ? <p className="inline-error" role="alert">{exportError}</p> : null}
      </div>

      <div className="overview-metrics">
        <OverviewMetric label="Issues" value={metrics.totalIssues} detail={`${metrics.completedIssues} completed`} />
        <OverviewMetric label="Completion" value={`${completion}%`} detail={`${metrics.completedIssues} of ${metrics.totalIssues}`} />
        <OverviewMetric label="Story points" value={metrics.totalPoints} detail={`${metrics.completedPoints ?? 0} delivered`} />
        <OverviewMetric label="Avg cycle" value={metrics.avgCycleTime == null ? '—' : `${metrics.avgCycleTime}d`} detail={metrics.medianCycleTime == null ? 'No completed issues' : `Median ${metrics.medianCycleTime}d`} />
      </div>

      <div className="overview-factors">
        {healthScore.factors.map(factor => (
          <div key={factor.key} className="overview-factor">
            <div className="overview-factor-head">
              <span>{factor.label}</span>
              <strong className={`tone-${factorTone(factor.score)}`}>{factorStatus(factor.score)}</strong>
            </div>
            <div className="overview-factor-value">{factor.value}</div>
            <div className="overview-factor-track"><span className={`tone-bg-${factorTone(factor.score)}`} style={{ width: `${factor.score}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}
