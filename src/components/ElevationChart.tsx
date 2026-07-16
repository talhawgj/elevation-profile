"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { TerrainPoint } from "@/lib/terrain";

type Props = {
  data: TerrainPoint[];
  padElevation: number | null;
  onPadChange: (elevation: number) => void;
};

const WIDTH = 1000;
const HEIGHT = 248;
const MARGIN = { top: 22, right: 28, bottom: 38, left: 58 };

export default function ElevationChart({ data, padElevation, onPadChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const chart = useMemo(() => {
    if (data.length < 2 || padElevation === null) return null;

    const rawMin = Math.min(...data.map((point) => point.elevation), padElevation);
    const rawMax = Math.max(...data.map((point) => point.elevation), padElevation);
    const padding = Math.max(8, (rawMax - rawMin) * 0.18);
    const min = Math.floor((rawMin - padding) / 5) * 5;
    const max = Math.ceil((rawMax + padding) / 5) * 5;
    const distance = data.at(-1)?.distance ?? 1;
    const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const x = (value: number) => MARGIN.left + (value / distance) * plotWidth;
    const y = (value: number) => MARGIN.top + ((max - value) / (max - min || 1)) * plotHeight;
    const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
    const distanceTicks = Array.from({ length: 6 }, (_, index) => (distance * index) / 5);

    const fills: { points: string; kind: "cut" | "fill"; key: string }[] = [];
    for (let index = 1; index < data.length; index += 1) {
      const a = data[index - 1];
      const b = data[index];
      const aDelta = a.elevation - padElevation;
      const bDelta = b.elevation - padElevation;

      if (aDelta === 0 && bDelta === 0) continue;
      if ((aDelta >= 0 && bDelta >= 0) || (aDelta <= 0 && bDelta <= 0)) {
        fills.push({
          key: `${index}-whole`,
          kind: (aDelta + bDelta) / 2 >= 0 ? "cut" : "fill",
          points: `${x(a.distance)},${y(a.elevation)} ${x(b.distance)},${y(b.elevation)} ${x(b.distance)},${y(padElevation)} ${x(a.distance)},${y(padElevation)}`,
        });
      } else {
        const ratio = Math.abs(aDelta) / (Math.abs(aDelta) + Math.abs(bDelta));
        const crossingDistance = a.distance + (b.distance - a.distance) * ratio;
        const crossingX = x(crossingDistance);
        fills.push({
          key: `${index}-a`,
          kind: aDelta > 0 ? "cut" : "fill",
          points: `${x(a.distance)},${y(a.elevation)} ${crossingX},${y(padElevation)} ${x(a.distance)},${y(padElevation)}`,
        });
        fills.push({
          key: `${index}-b`,
          kind: bDelta > 0 ? "cut" : "fill",
          points: `${crossingX},${y(padElevation)} ${x(b.distance)},${y(b.elevation)} ${x(b.distance)},${y(padElevation)}`,
        });
      }
    }

    return { min, max, distance, x, y, ticks, distanceTicks, fills };
  }, [data, padElevation]);

  const updatePad = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging || !chart || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgY = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const ratio = Math.max(0, Math.min(1, (svgY - MARGIN.top) / plotHeight));
    onPadChange(chart.max - ratio * (chart.max - chart.min));
  };

  if (!chart || padElevation === null) {
    return (
      <div className="chart-empty">
        <div className="empty-chart-lines"><i /><i /><i /><i /></div>
        <div className="empty-message"><span>⌁</span><strong>Your terrain profile will appear here</strong><small>Draw a line across the site to decode 50 elevation samples.</small></div>
      </div>
    );
  }

  const lineColor = (zone: TerrainPoint["zone"]) => zone === "prime" ? "#43d39e" : zone === "engineered" ? "#f4a74a" : "#f06b62";

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Elevation profile with draggable proposed pad elevation"
        onPointerMove={updatePad}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {chart.ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={chart.y(tick)} y2={chart.y(tick)} className="grid-line" />
            <text x={MARGIN.left - 10} y={chart.y(tick) + 4} textAnchor="end" className="axis-text">{Math.round(tick)} m</text>
          </g>
        ))}
        {chart.distanceTicks.map((tick) => (
          <text key={tick} x={chart.x(tick)} y={HEIGHT - 10} textAnchor="middle" className="axis-text">{Math.round(tick)} m</text>
        ))}

        {chart.fills.map((area) => <polygon key={area.key} points={area.points} className={`earthwork-area ${area.kind}`} />)}

        {data.slice(1).map((point, index) => {
          const previous = data[index];
          return <line key={point.distance} x1={chart.x(previous.distance)} y1={chart.y(previous.elevation)} x2={chart.x(point.distance)} y2={chart.y(point.elevation)} stroke={lineColor(point.zone)} strokeWidth="3.5" strokeLinecap="round" />;
        })}

        <g className="pad-control" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}>
          <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={chart.y(padElevation)} y2={chart.y(padElevation)} className="proposed-pad-line" />
          <rect x={WIDTH - 146} y={chart.y(padElevation) - 15} width="118" height="30" rx="7" className="pad-label-bg" />
          <text x={WIDTH - 87} y={chart.y(padElevation) + 4} textAnchor="middle" className="pad-label">≡&nbsp; {padElevation.toFixed(1)} m</text>
          <rect x={MARGIN.left} y={chart.y(padElevation) - 12} width={WIDTH - MARGIN.left - MARGIN.right} height="24" fill="transparent" />
        </g>
      </svg>
      <div className="chart-instruction">Drag the proposed pad line to balance earthwork</div>
      <label className="pad-slider-label">
        <span>Pad elevation</span>
        <input
          type="range"
          min={chart.min}
          max={chart.max}
          step="0.1"
          value={padElevation}
          onChange={(event) => onPadChange(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
