'use client';
import Map, { Source } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
// in MapComp.tsx or page.tsx
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

export default function MapComp({ children }: { children: React.ReactNode }) {
    return (
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: 0,
          latitude: 0,
          zoom: 3
      }}
      mapStyle="mapbox://styles/mapbox/satellite-v9"
      projection="globe"
      terrain={{source: 'mapbox-dem', exaggeration: 1.5}}
    >
    <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />
      {children}
    </Map>
    
  );
}