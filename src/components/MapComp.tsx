"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Map, { Layer, NavigationControl, Source, type MapRef } from "react-map-gl/mapbox";
import type { Map as MapboxMap } from "mapbox-gl";
import type { ParcelAnalysis } from "@/lib/terrain";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

type Props = {
  children: React.ReactNode;
  heatmap?: ParcelAnalysis["heatmap"] | null;
  hillshade?: boolean;
};

export type MapExportHandle = {
  prepareExport: () => Promise<void>;
};

const TERRARIUM_TILES = ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"];

const MapComp = forwardRef<MapExportHandle, Props>(function MapComp({ children, heatmap, hillshade = true }, ref) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapRef = useRef<MapRef>(null);
  const [printSnapshot, setPrintSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (cancelled) return;

        mapRef.current?.getMap().jumpTo({
          center: [coords.longitude, coords.latitude],
          zoom: 15,
        });
      },
      () => {
        // Keep the default view when location access is unavailable or denied.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    async prepareExport() {
      const map = mapRef.current?.getMap();
      if (!map) return;

      map.triggerRepaint();
      await nextFrame();
      await nextFrame();
      setPrintSnapshot(map.getCanvas().toDataURL("image/png"));
      await nextFrame();
    },
  }), []);

  if (!token) {
    return (
      <div className="map-token-state">
        <div className="map-grid" />
        <strong>Mapbox token required</strong>
        <span>Add NEXT_PUBLIC_MAPBOX_TOKEN to load the terrain workspace.</span>
      </div>
    );
  }

  return (
    <>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{ longitude: 73.058, latitude: 33.728, zoom: 13.2, pitch: 0, bearing: 0 }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        attributionControl={false}
        preserveDrawingBuffer
        maxPitch={65}
        doubleClickZoom={false}
        onLoad={(event) => hideSiteLabels(event.target)}
      >
        <Source id="aws-terrarium-dem" type="raster-dem" tiles={TERRARIUM_TILES} tileSize={256} maxzoom={15} encoding="terrarium" />
        {hillshade && (
          <Layer
            id="aws-terrain-hillshade"
            type="hillshade"
            source="aws-terrarium-dem"
            paint={{
              "hillshade-exaggeration": 0.44,
              "hillshade-shadow-color": "rgba(18,32,27,0.78)",
              "hillshade-highlight-color": "rgba(238,244,221,0.68)",
              "hillshade-accent-color": "rgba(61,93,79,0.7)",
              "hillshade-illumination-direction": 330,
            }}
          />
        )}
        {heatmap && (
          <Source id="parcel-slope-grid" type="geojson" data={heatmap}>
            <Layer
              id="parcel-slope-fill"
              type="fill"
              paint={{
                "fill-color": ["match", ["get", "zone"], "prime", "#43d39e", "engineered", "#f4a74a", "restricted", "#f06b62", "#ffffff"],
                "fill-opacity": 0.54,
                "fill-outline-color": "rgba(255,255,255,0.16)",
              }}
            />
          </Source>
        )}
        <NavigationControl position="bottom-right" showCompass visualizePitch />
        {children}
      </Map>
      {/* A data-URL snapshot is required because print engines do not reliably render WebGL canvases. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {printSnapshot && <img className="print-map-snapshot" src={printSnapshot} alt="Exported terrain map" />}
    </>
  );
});

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function hideSiteLabels(map: MapboxMap) {
  map.getStyle().layers?.forEach((layer) => {
    if (layer.type === "symbol" && /(poi|transit|airport)/i.test(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });
}

export default MapComp;
