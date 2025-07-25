'use client';

import React, { useState, useCallback } from 'react';
import MapComp from '@/components/MapComp';
import DrawControl from '@/components/DrawControl';
import ElevationChart from '@/components/ElevationChart';
import * as turf from '@turf/turf';

type ElevationPoint = {
  distance: number;
  elevation: number;
};

export default function Home() {
  const [features, setFeatures] = useState({});
  const [elevationData, setElevationData] = useState<ElevationPoint[]>([]);

  const fetchElevation = async (coords: [number, number][]) => {
    try {
      const locationParam = coords.map(([lon, lat]) => `${lat},${lon}`).join('|');
      const res = await fetch(
        `https://api.open-elevation.com/api/v1/lookup?locations=${locationParam}`
      );
      const data = await res.json();

      const points: ElevationPoint[] = data.results.map((d: any, i: number) => ({
        distance: i,
        elevation: d.elevation,
      }));

      setElevationData(points);
    } catch (err) {
      console.error('Elevation API error:', err);
    }
  };

  const interpolateLine = (coordinates: [number, number][], maxPoints = 30) => {
    const line = turf.lineString(coordinates);
    const totalLength = turf.length(line, { units: 'kilometers' });

    const step = totalLength / (maxPoints - 1);
    const sampled: [number, number][] = [];

    for (let i = 0; i < maxPoints; i++) {
      const point = turf.along(line, i * step, { units: 'kilometers' });
      sampled.push(point.geometry.coordinates as [number, number]);
    }

    return sampled;
  };

  const onUpdate = useCallback((e: { features: any[] }) => {
    setFeatures((curr) => {
      const newFeatures = { ...curr };
      for (const f of e.features) {
        newFeatures[f.id] = f;

        if (f.geometry.type === 'LineString') {
          const coords = f.geometry.coordinates as [number, number][];
          const interpolated = interpolateLine(coords, 30);
          fetchElevation(interpolated);
        }
      }
      return newFeatures;
    });
  }, []);

  const onDelete = useCallback((e: { features: any[] }) => {
    setFeatures((curr) => {
      const newFeatures = { ...curr };
      for (const f of e.features) {
        delete newFeatures[f.id];
      }
      setElevationData([]);
      return newFeatures;
    });
  }, []);

  return (
    <main className="bg-gray-100 min-h-screen">
      <header className="h-15 bg-black text-white-bold flex items-center px-4 py-2 text-xl font-semibold">
        Elevation Profile Viewer
      </header>

      <div className="relative h-[90vh] w-full bg-black">
        <MapComp>
          <DrawControl
            position="top-left"
            displayControlsDefault={false}
            controls={{
              point: false,
              line_string: true,
              polygon: false,
              trash: true,
            }}
            defaultMode="draw_line_string"
            onCreate={onUpdate}
            onDelete={onDelete}
          />
        </MapComp>

        {/* Overlay chart */}
        <ElevationChart data={elevationData} />
      </div>
    </main>
  );
}
