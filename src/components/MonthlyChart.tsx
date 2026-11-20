"use client";

import { useState } from "react";
import { formatCompactCurrency, formatCurrency, formatMonthKey } from "@/lib/format";

/** Single-series column chart of monthly totals with a hover tooltip. */
export function MonthlyChart({ data }: { data: { month: string; total: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.total), 0);
  const niceMax = niceCeil(max);
  const ticks = [0, niceMax / 2, niceMax];
  const W = 600;
  const H = 220;
  const pad = { l: 48, r: 8, t: 12, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const band = innerW / data.length;
  const barW = Math.min(44, band * 0.6);
  const y = (v: number) => pad.t + innerH - (niceMax ? (v / niceMax) * innerH : 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Monthly spending, last 6 months">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t === 0 ? undefined : "3 3"} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px]">
              {formatCompactCurrency(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const h = pad.t + innerH - y(d.total);
          const isActive = active === i;
          return (
            <g key={d.month} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={innerH} fill={isActive ? "#f1f5f9" : "transparent"} />
              {h > 0 && (
                <path
                  d={roundedTopBar(cx - barW / 2, y(d.total), barW, h, Math.min(4, h))}
                  fill={i === data.length - 1 ? "#4f46e5" : "#a5b4fc"}
                />
              )}
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {formatMonthKey(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{
            left: `${((pad.l + band * active + band / 2) / W) * 100}%`,
            top: `${(Math.max(y(data[active].total) - 40, 0) / H) * 100}%`,
          }}
        >
          <div className="text-slate-300">{formatMonthKey(data[active].month, "long")}</div>
          <div className="font-semibold tabular-nums">{formatCurrency(data[active].total)}</div>
        </div>
      )}
    </div>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}
