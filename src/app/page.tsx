"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type MapboxDraw from "@mapbox/mapbox-gl-draw";
import MapComp, { type MapExportHandle } from "@/components/MapComp";
import DrawControl, { type DrawControlHandle } from "@/components/DrawControl";
import ElevationChart from "@/components/ElevationChart";
import SiteSurfaceChart from "@/components/SiteSurfaceChart";
import {
  analyzeParcel,
  analyzeTransect,
  calculateEarthwork,
  calculateParcelEarthwork,
  summarizeTerrain,
  type ParcelAnalysis,
  type TerrainPoint,
} from "@/lib/terrain";

type AnalysisMode = "site" | "transect";
type AnalysisStatus = "idle" | "loading" | "ready" | "error";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export default function Home() {
  const [mode, setMode] = useState<AnalysisMode>("site");
  const [terrain, setTerrain] = useState<TerrainPoint[]>([]);
  const [parcel, setParcel] = useState<ParcelAnalysis | null>(null);
  const [padElevation, setPadElevation] = useState<number | null>(null);
  const [corridorWidth, setCorridorWidth] = useState(30);
  const [hillshade, setHillshade] = useState(true);
  const [analysisFocus, setAnalysisFocus] = useState<[number, number] | null>(null);
  const [mapLabel, setMapLabel] = useState("Draw a parcel");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [message, setMessage] = useState("Draw a site boundary to begin");
  const [isDrawing, setIsDrawing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const drawControlRef = useRef<DrawControlHandle>(null);
  const mapExportRef = useRef<MapExportHandle>(null);
  const analysisControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => analysisControllerRef.current?.abort(), []);

  const transectSummary = useMemo(() => summarizeTerrain(terrain), [terrain]);
  const transectEarthwork = useMemo(
    () => calculateEarthwork(terrain, padElevation ?? 0, corridorWidth),
    [terrain, padElevation, corridorWidth],
  );
  const parcelEarthwork = useMemo(
    () => parcel ? calculateParcelEarthwork(parcel, padElevation ?? 0) : { cut: 0, fill: 0, balance: 0 },
    [parcel, padElevation],
  );

  const isSite = mode === "site";
  const hasData = padElevation !== null && (isSite ? Boolean(parcel) : terrain.length > 1);
  const summary = isSite && parcel
    ? { prime: parcel.prime, engineered: parcel.engineered, restricted: parcel.restricted }
    : transectSummary;
  const earthwork = isSite ? parcelEarthwork : transectEarthwork;
  const balanced = hasData && Math.abs(earthwork.balance) <= Math.max(earthwork.cut, earthwork.fill) * 0.1;

  const exportAnalysis = async () => {
    if (!hasData || isExporting) return;
    setIsExporting(true);
    try {
      await mapExportRef.current?.prepareExport();
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const clearAnalysis = useCallback((nextMode: AnalysisMode = mode) => {
    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;
    setTerrain([]);
    setParcel(null);
    setPadElevation(null);
    setAnalysisFocus(null);
    setMapLabel(nextMode === "site" ? "Draw a parcel" : "Draw a transect");
    setStatus("idle");
    setIsDrawing(false);
    setMessage(nextMode === "site" ? "Draw a site boundary to begin" : "Draw a transect to begin");
  }, [mode]);

  const changeMode = (nextMode: AnalysisMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    clearAnalysis(nextMode);
  };

  const runAnalysis = useCallback(async (event: MapboxDraw.DrawCreateEvent | MapboxDraw.DrawUpdateEvent) => {
    const feature = event.features[0];
    if (!feature) return;
    const focus = geometryFocus(feature);
    setTerrain([]);
    setParcel(null);
    setPadElevation(null);
    setAnalysisFocus(focus);
    setMapLabel(isSite ? "Selected parcel" : "Selected transect");
    setStatus("loading");
    analysisControllerRef.current?.abort();
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    setMessage(isSite ? "Decoding the parcel terrain surface…" : "Decoding the transect terrain…");

    try {
      if (isSite && feature.geometry.type === "Polygon") {
        const analysis = await analyzeParcel(feature.geometry.coordinates[0] as [number, number][], controller.signal);
        if (controller.signal.aborted) return;
        const elevations = analysis.cells.map((cell) => cell.elevation).sort((a, b) => a - b);
        setParcel(analysis);
        setTerrain([]);
        setPadElevation(elevations[Math.floor(elevations.length / 2)]);
        setStatus("ready");
        setMessage(`${number.format(analysis.cells.length)} terrain cells decoded locally`);
      } else if (!isSite && feature.geometry.type === "LineString") {
        const points = await analyzeTransect(feature.geometry.coordinates as [number, number][], 2000, controller.signal);
        if (controller.signal.aborted) return;
        const elevations = points.map((point) => point.elevation).sort((a, b) => a - b);
        setTerrain(points);
        setParcel(null);
        setPadElevation(elevations[Math.floor(elevations.length / 2)]);
        setStatus("ready");
        setMessage(`${points.length} transect samples decoded locally`);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Terrain analysis failed.");
    } finally {
      if (analysisControllerRef.current === controller) analysisControllerRef.current = null;
    }
  }, [isSite]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span>I</span><span>T</span></div>
          <div>
            <div className="brand-name">INFRYNE <b>TECHWORKS</b></div>
            <div className="brand-product">Terrain Intelligence</div>
          </div>
        </div>
        <div className="mode-switch" role="group" aria-label="Analysis mode">
          <button type="button" className={isSite ? "active" : ""} onClick={() => changeMode("site")}><span>▦</span> Site mode</button>
          <button type="button" className={!isSite ? "active" : ""} onClick={() => changeMode("transect")}><span>⌁</span> Transect</button>
        </div>
        <div className="topbar-actions">
          <span className="engine-badge"><i /> Edge-compute engine</span>
          <button className="export-button" type="button" disabled={!hasData || isExporting} onClick={exportAnalysis}>
            {isExporting ? "Preparing map..." : "Export analysis"}
          </button>
          {/* <div className="avatar" aria-label="Account">IT</div> */}
        </div>
      </header>

      <section className="workspace">
        <div className="map-panel">
          <MapComp ref={mapExportRef} heatmap={parcel?.heatmap} hillshade={hillshade}>
            <DrawControl
              ref={drawControlRef}
              key={mode}
              position="top-left"
              displayControlsDefault={false}
              controls={isSite ? { polygon: true, trash: true } : { line_string: true, trash: true }}
              defaultMode="simple_select"
              onCreate={runAnalysis}
              onUpdate={runAnalysis}
              onDelete={() => clearAnalysis(mode)}
              onModeChange={(event) => setIsDrawing(event.mode.startsWith("draw_"))}
            />
          </MapComp>

          <div className="map-heading">
            <span className="eyebrow">SITE FEASIBILITY / {isSite ? "PARCEL" : "TRANSECT"}</span>
            <h1>{mapLabel}</h1>
            <span className="coordinates">{analysisFocus ? formatCoordinates(analysisFocus) : "Select geometry on the map"}</span>
          </div>

          <div className="draw-hint">
            <span className="hint-icon">{isSite ? "▱" : "⌁"}</span>
            <div>
              <strong>{isSite ? "Draw the parcel boundary" : "Draw a transect"}</strong>
              <small>{isDrawing ? "Add the remaining points, then finish the geometry" : isSite ? "Select the polygon tool and outline the full site" : "Select the line tool and click across the site"}</small>
            </div>
          </div>

          {isDrawing && (
            <button type="button" className="finish-drawing" onClick={() => {
              drawControlRef.current?.finish();
              setIsDrawing(false);
            }}>
              Finish {isSite ? "boundary" : "transect"}
            </button>
          )}

          <div className={`processing-pill ${status}`} role="status"><span className="processing-dot" />{message}</div>

          <button type="button" className={`hillshade-toggle ${hillshade ? "active" : ""}`} onClick={() => setHillshade((visible) => !visible)} aria-pressed={hillshade}>
            <span aria-hidden="true">◒</span> Hillshade
          </button>

          <div className="map-legend">
            <span><i className="prime" /> Prime &lt;10%</span>
            <span><i className="engineered" /> Engineered 10–15%</span>
            <span><i className="restricted" /> Restricted &gt;15%</span>
          </div>
        </div>

        <aside className="insights-panel">
          <div className="panel-title">
            <div><span className="eyebrow">LIVE {isSite ? "PARCEL" : "TRANSECT"} ANALYSIS</span><h2>Feasibility snapshot</h2></div>
            <span className="live-dot" title="Updates automatically" />
          </div>

          <div className="buildability-card">
            <div className="metric-label"><span>Prime buildable land</span><span className="info">i</span></div>
            <div className="hero-metric">{hasData ? Math.round(summary.prime) : "—"}<small>{hasData ? "%" : ""}</small></div>
            <div className="segmented-bar" aria-label="Slope distribution">
              <i className="prime" style={{ width: `${summary.prime}%` }} />
              <i className="engineered" style={{ width: `${summary.engineered}%` }} />
              <i className="restricted" style={{ width: `${summary.restricted}%` }} />
            </div>
            <div className="metric-caption">{hasData ? `of ${isSite ? "parcel area" : "transect length"} is below 10% grade` : "Waiting for terrain data"}</div>
          </div>

          <div className="metric-grid">
            {isSite ? (
              <>
                <Metric label="Parcel area" value={parcel ? formatArea(parcel.area) : "—"} />
                <Metric label="Boundary" value={parcel ? `${number.format(parcel.perimeter)} m` : "—"} />
                <Metric label="Terrain cells" value={parcel ? number.format(parcel.cells.length) : "—"} />
                <Metric label="Grid resolution" value={parcel ? `≈ ${parcel.resolution.toFixed(1)} m` : "—"} />
              </>
            ) : (
              <>
                <Metric label="Transect length" value={hasData ? `${number.format(transectSummary.distance)} m` : "—"} />
                <Metric label="Elevation gain" value={hasData ? `${number.format(transectSummary.ascent)} m` : "—"} />
                <Metric label="Terrain samples" value={hasData ? `${terrain.length}` : "—"} />
                <Metric label="Data source" value={hasData ? "AWS Terrarium" : "—"} />
              </>
            )}
          </div>

          {isSite && parcel && (
            <div className="elevation-range">
              <span>Surface elevation</span>
              <strong>{parcel.minElevation.toFixed(1)}–{parcel.maxElevation.toFixed(1)} m</strong>
            </div>
          )}

          <div className="section-divider" />

          <div className="earthwork-heading">
            <div><span className="eyebrow">EARTHWORK</span><h2>{isSite ? "Surface cut / fill" : "Cut / fill estimate"}</h2></div>
            <span className={`balance-chip ${balanced ? "balanced" : ""}`}>{hasData ? (balanced ? "Near balance" : earthwork.balance > 0 ? "Cut surplus" : "Fill deficit") : "No estimate"}</span>
          </div>

          {isSite ? (
            <label className="pad-field">
              <span>Proposed pad elevation</span>
              <span><input type="number" step="0.1" value={padElevation?.toFixed(1) ?? ""} disabled={!hasData} onChange={(event) => setPadElevation(Number(event.target.value))} /> m</span>
            </label>
          ) : (
            <label className="width-field">
              <span>Assumed pad width</span>
              <span><input type="number" min="1" max="250" value={corridorWidth} onChange={(event) => setCorridorWidth(Math.max(1, Number(event.target.value)))} /> m</span>
            </label>
          )}

          <div className="volume-list">
            <VolumeRow color="cut" label="Cut volume" value={hasData ? `${number.format(earthwork.cut)} m³` : "—"} />
            <VolumeRow color="fill" label="Fill volume" value={hasData ? `${number.format(earthwork.fill)} m³` : "—"} />
          </div>
          <div className="net-balance"><span>Net balance</span><strong>{hasData ? `${earthwork.balance >= 0 ? "+" : "−"}${number.format(Math.abs(earthwork.balance))} m³` : "—"}</strong></div>

          <div className="advisory">
            <span>!</span>
            <p><strong>Concept-stage estimate</strong>{isSite ? "Volumes use a horizontal pad across the decoded parcel surface. " : ""}Confirm soil, drainage, and engineering constraints with a licensed surveyor. Elevation: Mapzen Terrain Tiles on AWS.</p>
          </div>
        </aside>

        <section className="profile-panel">
          <div className="profile-header">
            <div>
              <span className="eyebrow">{isSite ? "PARCEL SURFACE" : "ELEVATION PROFILE"}</span>
              <h2>{isSite ? "Elevation distribution vs. proposed pad" : "Natural terrain vs. proposed pad"}</h2>
            </div>
            <div className="profile-key">
              {isSite ? <span><i className="grid-box" /> Slope grid on map</span> : <span><i className="terrain-line" /> Natural terrain</span>}
              <span><i className="pad-line" /> Proposed pad</span>
              <span><i className="cut-box" /> Cut</span>
              <span><i className="fill-box" /> Fill</span>
            </div>
          </div>

          {isSite
            ? <SiteSurfaceChart analysis={parcel} padElevation={padElevation} onPadChange={setPadElevation} />
            : <ElevationChart data={terrain} padElevation={padElevation} onPadChange={setPadElevation} />}
        </section>
      </section>
    </main>
  );
}

function formatArea(area: number) {
  return area >= 10000 ? `${(area / 10000).toFixed(2)} ha` : `${number.format(area)} m²`;
}

function geometryFocus(feature: MapboxDraw.DrawCreateEvent["features"][number]): [number, number] {
  if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "LineString") return [0, 0];
  const coordinates = feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
  const longitudes = coordinates.map((coordinate) => coordinate[0]);
  const latitudes = coordinates.map((coordinate) => coordinate[1]);
  return [
    (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
  ];
}

function formatCoordinates([longitude, latitude]: [number, number]) {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? "E" : "W"}`;
  return `${lat}   ${lon}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="minor-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function VolumeRow({ color, label, value }: { color: "cut" | "fill"; label: string; value: string }) {
  return <div className="volume-row"><span><i className={color} />{label}</span><strong>{value}</strong></div>;
}
