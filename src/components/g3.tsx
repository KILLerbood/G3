/** G3 building blocks: portraits with a strength ring, panels, ledger KPIs and a small hand-made area chart. */
import type { ReactNode } from 'react';
import { initials } from '../lib/format';
import { useI18n } from '../i18n';
import { BAND_LABEL, type Band } from '../features/clients/strength';

const FACES = ['#1f4d3a', '#b4532a', '#2f5e8c', '#7a5a1c', '#5b3f6b', '#2c6a50', '#8c3b2f', '#3d5a4c'];
export function faceColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FACES[h % FACES.length];
}
const RING: Record<Band, string> = { strong: 'var(--good)', steady: 'var(--g-forest-2)', cooling: 'var(--warn)', 'at-risk': 'var(--bad)' };

/** Initials on a colour picked from the name, with an optional ring that fills to the relationship score. */
export function Portrait({ name, size = 44, score, band }: { name: string; size?: number; score?: number; band?: Band }) {
  const stroke = Math.max(2.5, size / 16);
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const inner = score == null ? size : size - stroke * 2 - 4;
  return (
    <span className="g-portrait" style={{ width: size, height: size }} aria-hidden="true">
      {score != null ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING[band || 'steady']} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} />
        </svg>
      ) : null}
      <span className="g-portrait__face" style={{ width: inner, height: inner, background: faceColor(name), fontSize: Math.max(10, inner * 0.36) }}>{initials(name)}</span>
    </span>
  );
}

export function StrengthBadge({ score, band }: { score: number; band: Band }) {
  const { t } = useI18n();
  return <span className={'g-strength band-' + band} title={t('قوة العلاقة من 100', 'Relationship strength out of 100')}><b className="num">{score}</b>{t(BAND_LABEL[band][0], BAND_LABEL[band][1])}</span>;
}

export function Panel({ title, action, children, flush, id }: { title: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; id?: string }) {
  return (
    <section className="g-panel" aria-labelledby={id}>
      <div className="g-panel__head"><h2 id={id}>{title}</h2>{action}</div>
      <div className={'g-panel__body' + (flush ? ' g-panel__body--flush' : '')}>{children}</div>
    </section>
  );
}

export type Kpi = { label: string; value: ReactNode; unit?: string; note?: ReactNode; tone?: '' | 'good' | 'bad' | 'acc' };
export function Ledger({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <div className="g-ledger" role="group" aria-label={label}>
      {items.map((k) => (
        <div key={k.label} className={k.tone ? 'is-' + k.tone : ''}>
          <small>{k.label}</small>
          <b className="num">{k.value}{k.unit ? <em>{k.unit}</em> : null}</b>
          {k.note ? <span>{k.note}</span> : null}
        </div>
      ))}
    </div>
  );
}

/** A small area chart, hand-drawn in SVG. Labels under each point. */
export function AreaChart({ points, label, format = (n) => Math.round(n).toLocaleString('en-US') }: { points: { x: string; y: number }[]; label: string; format?: (n: number) => string }) {
  const W = 560, H = 170, P = 26;
  const max = Math.max(1, ...points.map((p) => p.y)) * 1.15;
  const step = points.length > 1 ? (W - P * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => [P + i * step, H - P - (p.y / max) * (H - P * 2)] as const);
  const line = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const area = line + ` L ${xy[xy.length - 1]?.[0] ?? P} ${H - P} L ${P} ${H - P} Z`;
  return (
    <svg className="g-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label + ': ' + points.map((p) => p.x + ' ' + format(p.y)).join('، ')}>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} className="grid" x1={P} x2={W - P} y1={P + f * (H - P * 2)} y2={P + f * (H - P * 2)} />)}
      {points.length ? <path className="area" d={area} /> : null}
      {points.length ? <path className="line" d={line} /> : null}
      {xy.map(([x, y], i) => (
        <g key={i}>
          <circle className="dot" cx={x} cy={y} r={3.5} />
          <text x={x} y={H - 6} textAnchor="middle">{points[i].x}</text>
          {i === xy.length - 1 ? <text x={x} y={y - 10} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 700 }}>{format(points[i].y)}</text> : null}
        </g>
      ))}
    </svg>
  );
}
