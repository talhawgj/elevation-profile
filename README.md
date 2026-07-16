# Infryne Terrain Intelligence

A stateless urban site-feasibility workspace for drawing a terrain transect, decoding elevation in the browser, evaluating slope constraints, and estimating cut/fill earthwork.

## What it does

- Draw a line across a site with Mapbox Draw.
- Sample 50 evenly spaced locations along the transect.
- Switch to Site Mode and draw a complete parcel boundary.
- Decode an adaptive native-pixel terrain grid across the parcel, capped at 5,000 analysis cells for responsive browser performance.
- Render a parcel-wide green/orange/red slope heatmap directly on the map.
- Toggle an AWS Terrarium-derived hillshade over the satellite basemap.
- Calculate buildable area, boundary length, elevation range, and full-surface cut/fill volumes.
- Fetch only the public AWS Terrarium DEM tiles needed by those locations.
- Decode elevation from PNG pixel values on an off-screen browser canvas.
- Classify each segment as prime (`<10%`), engineered (`10–15%`), or restricted (`>15%`).
- Drag a proposed pad elevation and see cut/fill volumes update immediately.
- Adjust the assumed pad width for a concept-stage 3D earthwork estimate.
- Export the analysis with the browser print dialog.

The application has no elevation API route, AWS credentials, or spatial database. Terrain computation and feasibility math run entirely in the browser. Mapbox is used only for the interactive basemap and drawing controls.

## Analysis modes

- **Site Mode:** Decodes the parcel surface, calculates two-dimensional slope from neighbouring DEM cells, maps buildability, and integrates earthwork across the complete site area.
- **Transect Mode:** Produces a lightweight 50-sample cross-section for roads, access routes, utilities, and rapid terrain inspection.

Only one drawn feature is active at a time. Drawing a new parcel or transect automatically removes the previous geometry and clears its analysis. The map heading uses the selected geometry's center coordinates and nearby labels already present in the loaded Mapbox style.

## Run locally

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_public_mapbox_token
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Architecture

`src/lib/terrain.ts` contains the stateless terrain engine. Coordinates are converted to Web Mercator tile and pixel positions at zoom 14. Each pixel is decoded using the Terrarium formula:

```text
elevation = (R × 256 + G + B ÷ 256) − 32768
```

Tiles are loaded from the public `elevation-tiles-prod` S3 bucket and cached in memory for the browser session, so nearby transects do not repeatedly decode the same PNG. The underlying global dataset combines SRTM and other open elevation sources. All results are approximate and intended for preliminary feasibility screening, not final survey or engineering work.

Elevation data processing and tiles are provided by Mapzen/Tilezen through the AWS Open Data program. See the [Terrain Tiles dataset](https://registry.opendata.aws/terrain-tiles/) and [attribution requirements](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

## Stack

- Next.js 15 and React 19
- TypeScript
- Mapbox GL JS and Mapbox Draw
- Turf.js
- Tailwind CSS 4
