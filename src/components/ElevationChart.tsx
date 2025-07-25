'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Label,
} from 'recharts';

type ElevationPoint = {
  distance: number;
  elevation: number;
};

interface ElevationChartProps {
  data: ElevationPoint[];
}

export default function ElevationChart({ data }: ElevationChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 bg-white p-4 rounded shadow-lg z-50"
         style={{ width: 'min(90vw, 500px)', height: '300px' }}>
      <h3 className="text-sm font-semibold mb-2 text-black">Elevation Profile</h3>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="distance" tick={{ fontSize: 10 }}>
            <Label value="Index" position="insideBottom" offset={-8} />
          </XAxis>
          <YAxis tick={{ fontSize: 10 }} label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 12 } }} />
          <Tooltip  />
          <Line
            type="monotone"
            dataKey="elevation"
            stroke="#6366f1" // Indigo-500 Tailwind
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
