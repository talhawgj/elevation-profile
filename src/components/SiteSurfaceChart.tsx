"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { ParcelAnalysis } from "@/lib/terrain";

type Props = {
  analysis: ParcelAnalysis | null;
  padElevation: number | null;
  onPadChange: (elevation: number) => void;
};

const WIDTH = 1000;
const HEIGHT = 248;
const MARGIN = { top: 25, right: 30, bottom: 38, left: 52 };

export default function SiteSurfaceChart({ analysis, padElevation, onPadChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const chart = useMemo(() => {
    if (!analysis || padElevation === null) return null;
    const min = Math.floor(analysis.minElevation - 2);
    const max = Math.ceil(analysis.maxElevation + 2);
    const binCount = 34;
    const interval = Math.max(0.1, (max - min) / binCount);
    const bins = Array.from({ length: binCount }, (_, index) => ({
      elevation: min + interval * (index + 0.5),
      count: 0,
    }));
    analysis.cells.forEach((cell) => {
      const index = Math.max(0, Math.min(binCount - 1, Math.floor((cell.elevation - min) / interval)));
      bins[index].count += 1;
    });
    const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
    const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const x = (value: number) => MARGIN.left + ((value - min) / (max - min || 1)) * plotWidth;
    const y = (value: number) => MARGIN.top + plotHeight - (value / maxCount) * plotHeight;
    return { min, max, bins, x, y, interval, plotWidth, plotHeight };
  }, [analysis, padElevation]);

  const updatePad = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging || !chart || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.max(0, Math.min(1, (svgX - MARGIN.left) / chart.plotWidth));
    onPadChange(chart.min + ratio * (chart.max - chart.min));
  };

  if (!chart || padElevation === null) {
    return (
      <div className="chart-empty site-empty">
        <div className="empty-chart-lines"><i /><i /><i /><i /></div>
        <div className="empty-message"><span>▦</span><strong>Your parcel surface will appear here</strong><small>Draw a site boundary to decode the complete terrain grid.</small></div>
      </div>
    );
  }

  return (
    <div className="chart-wrap site-surface-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Parcel elevation distribution with adjustable proposed pad"
        onPointerMove={updatePad}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {[0, 0.33, 0.66, 1].map((ratio) => {
          const y = MARGIN.top + chart.plotHeight * ratio;
          return <line key={ratio} x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y} y2={y} className="grid-line" />;
        })}
        {chart.bins.map((bin) => {
          const barWidth = chart.plotWidth / chart.bins.length - 2;
          const x = chart.x(bin.elevation) - barWidth / 2;
          const y = chart.y(bin.count);
          return <rect key={bin.elevation} x={x} y={y} width={barWidth} height={MARGIN.top + chart.plotHeight - y} rx="1" className={bin.elevation >= padElevation ? "surface-bar cut" : "surface-bar fill"} />;
        })}
        <text x={MARGIN.left} y={HEIGHT - 11} textAnchor="start" className="axis-text">{chart.min} m</text>
        <text x={WIDTH - MARGIN.right} y={HEIGHT - 11} textAnchor="end" className="axis-text">{chart.max} m</text>
        <text x={WIDTH / 2} y={HEIGHT - 11} textAnchor="middle" className="axis-text">Elevation distribution across parcel</text>
        <g className="surface-pad-control" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}>
          <line x1={chart.x(padElevation)} x2={chart.x(padElevation)} y1={MARGIN.top - 5} y2={HEIGHT - MARGIN.bottom} className="proposed-pad-line" />
          <rect x={chart.x(padElevation) - 48} y={3} width="96" height="25" rx="6" className="pad-label-bg" />
          <text x={chart.x(padElevation)} y={20} textAnchor="middle" className="pad-label">≡ {padElevation.toFixed(1)} m</text>
          <rect x={chart.x(padElevation) - 12} y={MARGIN.top - 8} width="24" height={chart.plotHeight + 12} fill="transparent" />
        </g>
      </svg>
      <div className="chart-instruction">Drag the pad marker to balance the full parcel</div>
      <label className="pad-slider-label">
        <span>Pad elevation</span>
        <input type="range" min={chart.min} max={chart.max} step="0.1" value={padElevation} onChange={(event) => onPadChange(Number(event.target.value))} />
      </label>
    </div>
  );
}
