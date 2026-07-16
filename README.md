# Infryne Terrain Intelligence

Infryne Terrain Intelligence is a browser-based preliminary site-feasibility tool. It lets a user draw either a parcel boundary or a linear transect on a satellite map, reads public terrain elevation tiles, classifies slope, estimates cut and fill, and exports a compact engineering-style report.

The application performs terrain processing in the browser. It does not require an elevation API key, an application backend, a spatial database, or AWS credentials. Mapbox provides the interactive basemap and drawing interface; elevation values come from public Mapzen/Tilezen Terrarium tiles hosted by AWS.

> This tool is intended for early planning and concept-stage screening. It is not a replacement for a licensed survey, geotechnical investigation, drainage study, or detailed civil design.

## Contents

- [Main capabilities](#main-capabilities)
- [Quick start](#quick-start)
- [Interface and tools](#interface-and-tools)
- [Site Mode: step-by-step workflow](#site-mode-step-by-step-workflow)
- [Transect Mode: step-by-step workflow](#transect-mode-step-by-step-workflow)
- [Understanding the results](#understanding-the-results)
- [How terrain processing works](#how-terrain-processing-works)
- [How earthwork is calculated](#how-earthwork-is-calculated)
- [Exporting an analysis](#exporting-an-analysis)
- [Limits and safeguards](#limits-and-safeguards)
- [Project architecture](#project-architecture)
- [Development and verification](#development-and-verification)
- [Troubleshooting](#troubleshooting)
- [Data attribution](#data-attribution)

## Main capabilities

The application supports two analysis workflows:

1. **Site Mode** analyzes a two-dimensional parcel surface.
2. **Transect Mode** analyzes a line across the terrain.

Across these modes, the application can:

- Draw, edit, replace, and delete a parcel or transect.
- Decode elevation directly from Terrarium PNG tiles.
- Display AWS-derived hillshade over a Mapbox satellite basemap.
- Hide business, POI, transit, and airport labels for a cleaner engineering map.
- Classify terrain as prime, engineered, or restricted according to slope.
- Display a parcel slope grid or a color-coded elevation profile.
- Calculate parcel area, perimeter, elevation range, distance, and elevation gain.
- Estimate cut volume, fill volume, and net earthwork balance.
- Change the proposed pad elevation interactively.
- Change the assumed corridor width for a transect.
- Capture the WebGL map as an image and export an A4 landscape report through the browser print dialog.

Only one drawn geometry is active at a time. Creating another feature or switching analysis mode clears the previous geometry and its results.

## Quick start

### 1. Requirements

- Node.js 20 or a compatible current Node.js release.
- npm.
- A public Mapbox access token.
- A modern browser with WebGL, Canvas, `createImageBitmap`, and Fetch support.
- Internet access to Mapbox and the AWS Terrain Tiles dataset.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Mapbox

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_public_mapbox_token
```

The token is exposed to the browser, so it must be a public Mapbox token. Apply URL restrictions to the token when deploying the application.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is already in use, Next.js may select another local port and display it in the terminal.

### 5. Create the first analysis

1. Leave **Site mode** selected.
2. Select the polygon tool on the left side of the map.
3. Click around the parcel boundary.
4. Select **Finish boundary** after placing at least three valid points.
5. Wait for the status pill to report that terrain cells were decoded.
6. Review the map, metrics, earthwork values, and elevation distribution.
7. Select **Export analysis** to print or save the report as a PDF.

## Interface and tools

### Mode selector

| Tool | Purpose | What happens when selected |
| --- | --- | --- |
| **Site mode** | Analyze a complete parcel surface. | Enables polygon drawing, parcel metrics, a slope grid, surface elevation distribution, and parcel-wide cut/fill. |
| **Transect** | Analyze a line across the terrain. | Enables line drawing, a 50-point elevation profile, distance/ascent metrics, corridor width, and transect cut/fill. |

Changing mode removes the current Mapbox Draw control, clears the current geometry, cancels any active terrain analysis, and resets the results panel.

### Map drawing tools

| Tool | Purpose | Detailed behavior |
| --- | --- | --- |
| **Polygon tool** | Start a Site Mode boundary. | Each click adds a parcel vertex. The polygon must contain at least three valid vertices. |
| **Line tool** | Start a Transect Mode line. | Each click adds another segment to the transect. |
| **Finish boundary / Finish transect** | Explicitly complete the geometry. | Changes Mapbox Draw back to selection mode. A valid feature triggers terrain analysis immediately. |
| **Delete** | Remove the selected feature. | Deletes the geometry and clears its terrain, pad elevation, metrics, chart, and earthwork result. |
| **Edit vertices** | Correct an existing geometry. | Select a completed feature and edit its vertices. A draw update starts a fresh analysis and cancels the previous one. |

Mapbox Draw also supports completing a polygon by selecting its first vertex. The explicit Finish button is the recommended and more reliable method.

### Map navigation tools

| Tool | Purpose |
| --- | --- |
| **Zoom in / Zoom out** | Changes the basemap zoom without changing the drawn coordinates. |
| **Compass** | Resets bearing and provides orientation feedback. |
| **Hillshade** | Shows or hides terrain shading derived from the AWS Terrarium raster DEM. This changes map presentation only; it does not change calculated elevations. |

### Analysis controls

| Control | Available in | Purpose |
| --- | --- | --- |
| **Proposed pad elevation** | Site Mode | Sets the horizontal design surface used for parcel cut/fill. It can be typed in the metrics panel or dragged on the surface chart. |
| **Proposed pad line** | Transect Mode | Sets the horizontal design elevation across the transect. Drag the dashed line vertically to update earthwork. |
| **Assumed pad width** | Transect Mode | Converts the two-dimensional profile difference into an approximate three-dimensional volume. |
| **Export analysis** | Both modes after analysis | Captures the rendered map and opens the browser print dialog with a compact A4 landscape report. |

### Status pill

The map status pill communicates the current state:

- **Idle:** asks the user to draw a parcel or transect.
- **Loading:** reports that terrain is being decoded.
- **Ready:** reports the number of decoded terrain cells or transect samples.
- **Error:** displays a useful error such as a tile timeout, an oversized parcel, or a parcel that is too small for the available terrain resolution.

## Site Mode: step-by-step workflow

Site Mode evaluates terrain across the area inside a polygon.

### Step 1: Select Site Mode

Select **Site mode** in the top navigation. The left map control changes to a polygon tool. Any previous transect is removed.

### Step 2: Draw the parcel

Select the polygon tool and place vertices around the site boundary. Keep the polygon reasonably close to the real parcel instead of drawing a very large bounding shape; a tighter polygon improves relevance and reduces tile loading.

### Step 3: Finish the boundary

Select **Finish boundary**. If the polygon is valid, Mapbox Draw emits a create event and the application starts analysis.

### Step 4: Build the terrain grid

The application performs these operations:

1. Closes the polygon ring if the first and last coordinates do not already match.
2. Calculates the parcel bounding box.
3. Converts the geographic bounds to global Web Mercator pixels at terrain zoom 14.
4. Chooses an adaptive pixel stride so the parcel analysis stays near or below 5,000 cells.
5. Tests each candidate cell center and keeps only points inside the polygon.
6. Determines all Terrarium tiles required by the center and neighboring slope samples.
7. Downloads and caches the required tiles.
8. Decodes elevation for every retained terrain cell.
9. Calculates east-west and north-south grade from neighboring elevations.
10. Combines the two grades into a two-dimensional slope magnitude.

### Step 5: Read the slope grid

Each parcel cell is converted back into a small GeoJSON polygon and displayed over the map:

- **Green - Prime:** slope below 10%.
- **Orange - Engineered:** slope from 10% through 15%.
- **Red - Restricted:** slope above 15%.

The percentages shown in the feasibility panel are based on the number of analyzed parcel cells in each class. Because the cells use the same adaptive grid spacing, the percentages approximate the share of parcel area in each class.

### Step 6: Review parcel metrics

Site Mode reports:

- **Prime buildable land:** percentage of cells below 10% slope.
- **Parcel area:** Turf.js geodesic polygon area, shown in square metres or hectares.
- **Boundary:** geodesic polygon perimeter in metres.
- **Terrain cells:** number of decoded grid cells inside the polygon.
- **Grid resolution:** approximate ground spacing between cell centers at the parcel latitude.
- **Surface elevation:** minimum and maximum decoded cell elevation.

### Step 7: Adjust the proposed pad

The initial pad elevation is the median decoded parcel elevation. This provides a useful starting point but does not guarantee balanced cut and fill.

Change it in either of two ways:

1. Enter a value in **Proposed pad elevation**.
2. Drag the marker on the parcel elevation distribution chart.

Bars above the pad are shown as cut; bars below the pad are shown as fill. All volume metrics update immediately without downloading terrain again.

### Step 8: Interpret earthwork

- **Cut volume:** approximate material above the horizontal pad.
- **Fill volume:** approximate volume required below the horizontal pad.
- **Net balance:** cut minus fill.
- **Cut surplus:** cut is greater than fill.
- **Fill deficit:** fill is greater than cut.
- **Near balance:** the absolute balance is no more than 10% of the larger cut or fill value.

## Transect Mode: step-by-step workflow

Transect Mode evaluates a linear cross-section. It is useful for roads, access routes, drainage paths, utility corridors, and quick terrain checks.

### Step 1: Select Transect

Select **Transect** in the top navigation. Any parcel geometry and parcel analysis are cleared.

### Step 2: Draw the line

Select the line tool and click along the intended alignment. A transect can contain multiple segments, allowing it to follow a route rather than only a straight line.

### Step 3: Finish the transect

Select **Finish transect**. A valid line starts terrain analysis.

### Step 4: Sample elevation

The application:

1. Measures the complete line length with Turf.js.
2. Divides the line into 49 equal intervals.
3. Creates 50 evenly spaced sample locations, including both ends.
4. Converts every sample location to a Terrarium tile and pixel.
5. Loads and caches the required tiles.
6. Decodes the 50 elevations.
7. Calculates the absolute grade of each segment from rise divided by run.
8. Assigns each segment to the prime, engineered, or restricted class.

### Step 5: Read the profile

The profile chart shows:

- Horizontal distance in metres.
- Natural terrain elevation in metres.
- Terrain segments colored by slope class.
- A dashed horizontal proposed pad line.
- Cut shading where natural terrain is above the pad.
- Fill shading where natural terrain is below the pad.

Drag the proposed pad line vertically to update the estimate.

### Step 6: Set the corridor width

Enter an **Assumed pad width** in metres. The application multiplies the profile cut/fill cross-section by this width to estimate volume. Increasing the width increases cut and fill proportionally.

### Step 7: Review transect metrics

Transect Mode reports:

- Total transect length.
- Cumulative positive elevation gain.
- Number of terrain samples.
- Percentage of line length in each slope class.
- Cut, fill, and net balance based on the selected pad elevation and corridor width.

## Understanding the results

### Slope percentage

Slope is reported as percent grade, not degrees:

```text
slope (%) = elevation change / horizontal distance x 100
```

A 10% slope means elevation changes by approximately 10 metres over 100 horizontal metres.

### Slope classes

| Class | Grade | Intended interpretation |
| --- | ---: | --- |
| Prime | `< 10%` | Generally more favorable for concept-stage development screening. |
| Engineered | `10-15%` | May require more grading, retaining, drainage, or structural consideration. |
| Restricted | `> 15%` | Likely to need significant engineering review or may be unsuitable for the proposed use. |

These thresholds are application planning rules, not universal regulatory limits. Local codes and project requirements must take precedence.

### Elevation values

Terrarium values are decoded in metres using RGB channels:

```text
elevation = (red x 256 + green + blue / 256) - 32768
```

Elevation accuracy depends on the underlying source data and is not survey-grade.

### Net balance

```text
net balance = cut volume - fill volume
```

- A positive value indicates a cut surplus.
- A negative value indicates a fill deficit.
- A result near zero indicates approximate balance before shrink/swell, stripping, unsuitable material, haul, compaction, retaining structures, drainage, or construction tolerances are considered.

## How terrain processing works

### Coordinate conversion

Longitude and latitude are converted to Web Mercator tile and pixel coordinates at zoom 14. Terrarium tiles are 256 by 256 pixels. Latitude is clamped to the valid Web Mercator range before conversion.

### Tile loading and caching

Tiles are requested from:

```text
https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png
```

Each tile request is stored as a promise in an in-memory cache. Nearby cells and repeated analyses can reuse the same decoded tile rather than downloading it again. Decoded `ImageData` is also cached for direct pixel access.

### Browser decoding

For every new tile:

1. Fetch the PNG.
2. Convert the response blob to an `ImageBitmap`.
3. Draw it to an off-screen 256 by 256 canvas.
4. Read the canvas as `ImageData`.
5. Decode the red, green, and blue values at the required pixels.

This processing happens locally in the user's browser.

### Parcel slope calculation

For each parcel cell, the engine reads five elevations:

- Center.
- One grid stride left.
- One grid stride right.
- One grid stride above.
- One grid stride below.

It uses the opposing neighbor pairs to estimate east-west and north-south grade. The final slope magnitude is:

```text
slope (%) = sqrt(east-west grade^2 + north-south grade^2) x 100
```

### Transect slope calculation

For every profile segment after the first sample:

```text
segment slope (%) = absolute elevation difference / segment length x 100
```

The first point is assigned zero slope because it has no preceding segment.

## How earthwork is calculated

### Parcel earthwork

The application approximates a uniform area for each analyzed cell:

```text
cell area = total parcel area / number of cells
```

For every cell:

```text
cell volume = (natural elevation - pad elevation) x cell area
```

- A positive cell volume contributes to cut.
- A negative cell volume contributes to fill.

The calculation assumes one horizontal pad across the parcel. It does not model building footprints, batters, benches, walls, roads, drainage channels, topsoil stripping, or multiple design surfaces.

### Transect earthwork

For each pair of adjacent samples, the application compares both natural elevations with the pad elevation. If the segment crosses the pad, it divides the segment at the calculated crossing point so cut and fill are accumulated separately.

Approximate volume is based on:

```text
average vertical difference x segment length x corridor width
```

This is a concept-stage corridor estimate, not a full terrain-to-design-surface volume calculation.

## Exporting an analysis

The **Export analysis** button becomes available after terrain data and an initial pad elevation are ready.

### Export sequence

1. The button changes to **Preparing map...**.
2. Mapbox is asked to repaint the WebGL map.
3. The application waits for browser animation frames so the latest parcel grid and map state are visible.
4. The WebGL canvas is converted to a PNG data URL.
5. The PNG is placed behind the report's map annotations for print.
6. The browser print dialog opens.
7. The print stylesheet arranges the report on A4 landscape paper.

The PNG step is necessary because many print engines do not render WebGL canvases reliably. Without it, the exported map area may appear blank.

The print layout:

- Keeps the brand header.
- Places the map and chart in the left column.
- Places feasibility and earthwork metrics in the right column.
- Removes drawing controls, navigation controls, mode buttons, hillshade controls, loading status, and other interactive UI.
- Uses neutral titles such as **Selected parcel** and **Selected transect** instead of nearby business names.

In the browser print dialog, select **Save as PDF** to create a PDF file. Browser-generated page headers and footers, such as the URL and date, can usually be disabled in the print dialog's advanced settings.

## Limits and safeguards

### Parcel cell limit

Site Mode uses an adaptive stride and targets a maximum of approximately 5,000 analysis cells. Larger parcels therefore use a coarser grid resolution.

### Tile footprint limit

A parcel may require no more than 64 unique terrain tiles for its center and slope-neighbor samples. A larger footprint stops with a message asking the user to draw a smaller boundary. This prevents thousands of simultaneous browser downloads.

### Tile timeout

Each tile request has a 15-second timeout. A stalled request produces a clear error rather than leaving the analysis in a permanent loading state.

### Small parcel validation

If fewer than three terrain grid locations fall inside the parcel at zoom 14, the application asks the user to draw a larger boundary.

### Cancellation

Starting a new analysis, deleting geometry, changing mode, or leaving the page aborts the current analysis. Results from an older request are not allowed to overwrite a newer geometry.

### Browser and network dependency

The application needs:

- Mapbox access for the basemap.
- AWS S3 access for elevation tiles.
- Canvas pixel-reading support.
- WebGL support for the interactive map.

Corporate proxies, content blockers, restrictive browser policies, or disabled WebGL may prevent the application from working correctly.

### Engineering limitations

The current calculations do not include:

- Survey control or cadastral validation.
- Soil type, rock, groundwater, or unsuitable material.
- Shrink and swell factors.
- Compaction factors.
- Topsoil stripping or replacement.
- Haul distance or disposal/import cost.
- Retaining walls and side slopes.
- Drainage, flood, environmental, utility, or access constraints.
- Building-specific finished floor levels.
- Multiple pads or a graded design surface.
- Local planning and building regulations.

## Project architecture

```text
src/
|-- app/
|   |-- globals.css          Responsive and print-report styling
|   |-- layout.tsx           Root Next.js layout and metadata
|   `-- page.tsx             Application state and workflow coordination
|-- components/
|   |-- DrawControl.tsx      Mapbox Draw lifecycle and finish behavior
|   |-- ElevationChart.tsx   Transect profile and draggable pad line
|   |-- MapComp.tsx          Map, hillshade, slope grid, label filtering, export capture
|   `-- SiteSurfaceChart.tsx Parcel elevation histogram and draggable pad marker
`-- lib/
    `-- terrain.ts           Tile decoding, sampling, slope, summaries, and earthwork math
```

### `src/app/page.tsx`

This is the main workflow coordinator. It owns:

- Current mode.
- Active terrain or parcel result.
- Proposed pad elevation.
- Corridor width.
- Loading and error state.
- Analysis cancellation.
- Draw event handling.
- Export preparation.

### `src/components/DrawControl.tsx`

This component integrates Mapbox Draw with `react-map-gl`. It:

- Registers create, update, delete, and mode-change listeners.
- Keeps event callbacks current without recreating the control.
- Removes an older feature when a new feature is created.
- Exposes the explicit `finish()` method used by the Finish button.
- Retains the actual mounted Mapbox Draw instance, including under React development checks.

### `src/components/MapComp.tsx`

This component:

- Creates the Mapbox map.
- Adds the AWS Terrarium raster DEM source.
- Renders optional hillshade.
- Renders the parcel GeoJSON slope grid.
- Hides POI, transit, and airport symbol layers.
- Preserves the drawing buffer so the map can be exported.
- Captures the WebGL canvas before printing.

### `src/lib/terrain.ts`

This module contains stateless terrain and earthwork functions plus in-memory tile caches. It is responsible for:

- Coordinate and pixel conversion.
- Tile loading and decoding.
- Parcel grid generation.
- Transect sampling.
- Slope classification.
- Terrain summaries.
- Parcel and transect cut/fill calculations.

## Development and verification

### Development server

```bash
npm run dev
```

### TypeScript check

```bash
npx tsc --noEmit
```

### ESLint

```bash
npx eslint src
```

### Production build

```bash
npm run build
```

### Start the production build

```bash
npm start
```

## Troubleshooting

### The map says a Mapbox token is required

Confirm that `.env.local` contains:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_public_mapbox_token
```

Restart the development server after changing environment variables. Also confirm the token's URL restrictions allow the current hostname.

### Geometry starts but does not finish

- Place enough points for a valid polygon or line.
- Use the visible **Finish boundary** or **Finish transect** button.
- If necessary, delete the incomplete geometry and start again.

### Terrain analysis remains in loading state

Tile requests automatically time out after 15 seconds. If loading repeatedly fails:

- Confirm internet access.
- Confirm the AWS terrain tile domain is not blocked.
- Try a smaller geometry.
- Disable restrictive content-blocking extensions for the application.

### The parcel is too small

The parcel contains fewer than three terrain grid cells at zoom 14. Draw a slightly larger boundary or use Transect Mode for a narrow feature.

### The parcel covers too much terrain

The analysis requires more than 64 Terrarium tiles. Draw a smaller parcel or split the study area into multiple analyses.

### The exported map is blank

Always use the application's **Export analysis** button instead of opening print directly with the browser shortcut. The button captures the WebGL map as a PNG before printing. Also keep background graphics enabled in the print dialog when the browser provides that option.

### Business or site names appear on the map

The application hides Mapbox POI, transit, and airport symbol layers when the style loads and uses a neutral selected-geometry title. Road and general place labels remain for orientation.

### Cut and fill appear unexpectedly large

Check:

- The proposed pad elevation.
- The parcel size.
- The transect corridor width.
- Whether the horizontal-pad assumption is suitable for the site.

Remember that the estimate is calculated across the complete parcel or corridor, not only a future building footprint.

## Technology stack

- Next.js 15
- React 19
- TypeScript
- Mapbox GL JS
- Mapbox Draw
- react-map-gl
- Turf.js
- Tailwind CSS 4
- SVG-based custom charts

## Data attribution

Elevation tiles are provided by the Mapzen/Tilezen terrain pipeline through the AWS Open Data program. The underlying dataset combines SRTM and other elevation sources.

- [AWS Registry of Open Data: Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
- [Tilezen/Joerd attribution guidance](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)

Map rendering and satellite imagery are provided through Mapbox and are subject to the Mapbox terms and attribution requirements.
