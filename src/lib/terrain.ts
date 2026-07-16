import * as turf from "@turf/turf";
import type { FeatureCollection, Polygon } from "geojson";

export type TerrainPoint = {
  distance: number;
  elevation: number;
  slope: number;
  zone: "prime" | "engineered" | "restricted";
};

export type ParcelCell = {
  longitude: number;
  latitude: number;
  elevation: number;
  slope: number;
  zone: TerrainPoint["zone"];
};

export type ParcelAnalysis = {
  cells: ParcelCell[];
  heatmap: FeatureCollection<Polygon, { elevation: number; slope: number; zone: TerrainPoint["zone"] }>;
  area: number;
  perimeter: number;
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  prime: number;
  engineered: number;
  restricted: number;
  resolution: number;
};

const TILE_SIZE = 256;
const TERRAIN_ZOOM = 14;
const MAX_SITE_CELLS = 5000;
const MAX_SITE_TILES = 64;
const TILE_TIMEOUT_MS = 15000;
const EARTH_CIRCUMFERENCE = 40075016.686;
const tileCache = new Map<string, Promise<ImageData>>();
const decodedTileCache = new Map<string, ImageData>();

function getTilePosition(lon: number, lat: number, zoom: number) {
  const scale = 2 ** zoom;
  const normalizedX = ((lon + 180) / 360) * scale;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const radians = (latitude * Math.PI) / 180;
  const normalizedY =
    ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * scale;

  const tileX = Math.floor(normalizedX);
  const tileY = Math.floor(normalizedY);

  return {
    tileX,
    tileY,
    pixelX: Math.min(TILE_SIZE - 1, Math.floor((normalizedX - tileX) * TILE_SIZE)),
    pixelY: Math.min(TILE_SIZE - 1, Math.floor((normalizedY - tileY) * TILE_SIZE)),
  };
}

function lonLatToGlobalPixel(lon: number, lat: number) {
  const position = getTilePosition(lon, lat, TERRAIN_ZOOM);
  return {
    x: position.tileX * TILE_SIZE + position.pixelX,
    y: position.tileY * TILE_SIZE + position.pixelY,
  };
}

function globalPixelToLonLat(x: number, y: number): [number, number] {
  const scale = TILE_SIZE * 2 ** TERRAIN_ZOOM;
  const longitude = (x / scale) * 360 - 180;
  const mercatorY = Math.PI * (1 - (2 * y) / scale);
  const latitude = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
  return [longitude, latitude];
}

async function loadTile(
  tileX: number,
  tileY: number,
): Promise<ImageData> {
  const key = `${TERRAIN_ZOOM}/${tileX}/${tileY}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    const url = `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${key}.png`;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), TILE_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(url, { cache: "force-cache", signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Terrain tiles timed out. Check your connection and try again.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`AWS Terrarium tile request failed (${response.status}).`);
    }

    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) throw new Error("Canvas decoding is unavailable in this browser.");
    context.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE);
    bitmap.close();
    const image = context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    decodedTileCache.set(key, image);
    return image;
  })();

  tileCache.set(key, pending);
  pending.catch(() => tileCache.delete(key));
  return pending;
}

function decodeElevation(tile: ImageData, pixelX: number, pixelY: number) {
  const offset = (pixelY * TILE_SIZE + pixelX) * 4;
  const red = tile.data[offset];
  const green = tile.data[offset + 1];
  const blue = tile.data[offset + 2];
  return red * 256 + green + blue / 256 - 32768;
}

function tileCoordinatesAtGlobalPixel(globalX: number, globalY: number) {
  const x = Math.floor(globalX);
  const y = Math.floor(globalY);
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  return {
    key: `${TERRAIN_ZOOM}/${tileX}/${tileY}`,
    tileX,
    tileY,
    pixelX: ((x % TILE_SIZE) + TILE_SIZE) % TILE_SIZE,
    pixelY: ((y % TILE_SIZE) + TILE_SIZE) % TILE_SIZE,
  };
}

function decodedElevationAtGlobalPixel(globalX: number, globalY: number) {
  const position = tileCoordinatesAtGlobalPixel(globalX, globalY);
  const tile = decodedTileCache.get(position.key);
  if (!tile) throw new Error("Terrain tile was not decoded.");
  return decodeElevation(tile, position.pixelX, position.pixelY);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Terrain analysis cancelled.", "AbortError");
}

async function waitForTile(tileX: number, tileY: number, signal?: AbortSignal) {
  throwIfAborted(signal);
  const pending = loadTile(tileX, tileY);
  if (!signal) return pending;

  return new Promise<ImageData>((resolve, reject) => {
    const abort = () => reject(new DOMException("Terrain analysis cancelled.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    pending.then(
      (tile) => {
        signal.removeEventListener("abort", abort);
        resolve(tile);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

function slopeZone(slope: number): TerrainPoint["zone"] {
  if (slope < 10) return "prime";
  if (slope <= 15) return "engineered";
  return "restricted";
}

export async function analyzeTransect(
  coordinates: [number, number][],
  sampleCount = 50,
  signal?: AbortSignal,
): Promise<TerrainPoint[]> {
  throwIfAborted(signal);
  const line = turf.lineString(coordinates);
  const totalDistance = turf.length(line, { units: "meters" });
  const count = Math.max(2, sampleCount);
  const interval = totalDistance / (count - 1);

  const samples = Array.from({ length: count }, (_, index) => {
    const point = turf.along(line, interval * index, { units: "meters" });
    const [lon, lat] = point.geometry.coordinates;
    return {
      distance: interval * index,
      ...getTilePosition(lon, lat, TERRAIN_ZOOM),
    };
  });

  const elevations = await Promise.all(
    samples.map(async (sample) => {
      const tile = await waitForTile(sample.tileX, sample.tileY, signal);
      return decodeElevation(tile, sample.pixelX, sample.pixelY);
    }),
  );

  return samples.map((sample, index) => {
    const previous = index === 0 ? 0 : index - 1;
    const rise = Math.abs(elevations[index] - elevations[previous]);
    const run = Math.max(0.01, sample.distance - samples[previous].distance);
    const slope = index === 0 ? 0 : (rise / run) * 100;
    return {
      distance: sample.distance,
      elevation: elevations[index],
      slope,
      zone: slopeZone(slope),
    };
  });
}

export async function analyzeParcel(
  coordinates: [number, number][],
  signal?: AbortSignal,
): Promise<ParcelAnalysis> {
  throwIfAborted(signal);
  const ring = coordinates[0]?.[0] === coordinates.at(-1)?.[0] && coordinates[0]?.[1] === coordinates.at(-1)?.[1]
    ? coordinates
    : [...coordinates, coordinates[0]];
  const polygon = turf.polygon([ring]);
  const [west, south, east, north] = turf.bbox(polygon);
  const northWest = lonLatToGlobalPixel(west, north);
  const southEast = lonLatToGlobalPixel(east, south);
  const pixelWidth = Math.max(1, southEast.x - northWest.x);
  const pixelHeight = Math.max(1, southEast.y - northWest.y);
  const stride = Math.max(1, Math.ceil(Math.sqrt((pixelWidth * pixelHeight) / MAX_SITE_CELLS)));
  const locations: { x: number; y: number; longitude: number; latitude: number }[] = [];

  for (let y = northWest.y; y <= southEast.y; y += stride) {
    for (let x = northWest.x; x <= southEast.x; x += stride) {
      const [longitude, latitude] = globalPixelToLonLat(x + stride / 2, y + stride / 2);
      if (turf.booleanPointInPolygon(turf.point([longitude, latitude]), polygon)) {
        locations.push({ x: x + stride / 2, y: y + stride / 2, longitude, latitude });
      }
    }
  }

  if (locations.length < 3) {
    throw new Error("The parcel is too small at this terrain resolution. Draw a larger boundary.");
  }

  const requiredTiles = new Map<string, { tileX: number; tileY: number }>();
  locations.forEach((location) => {
    const samplePixels = [
      [location.x, location.y],
      [location.x - stride, location.y],
      [location.x + stride, location.y],
      [location.x, location.y - stride],
      [location.x, location.y + stride],
    ];
    samplePixels.forEach(([x, y]) => {
      const position = tileCoordinatesAtGlobalPixel(x, y);
      requiredTiles.set(position.key, position);
    });
  });

  if (requiredTiles.size > MAX_SITE_TILES) {
    throw new Error("This parcel covers too much terrain for a browser analysis. Draw a smaller boundary.");
  }

  await Promise.all(
    Array.from(requiredTiles.values(), ({ tileX, tileY }) => waitForTile(tileX, tileY, signal)),
  );
  throwIfAborted(signal);

  const cells = locations.map((location): ParcelCell => {
    const center = decodedElevationAtGlobalPixel(location.x, location.y);
    const left = decodedElevationAtGlobalPixel(location.x - stride, location.y);
    const right = decodedElevationAtGlobalPixel(location.x + stride, location.y);
    const top = decodedElevationAtGlobalPixel(location.x, location.y - stride);
    const bottom = decodedElevationAtGlobalPixel(location.x, location.y + stride);
    const pixelMeters = (EARTH_CIRCUMFERENCE * Math.cos((location.latitude * Math.PI) / 180)) / (TILE_SIZE * 2 ** TERRAIN_ZOOM);
    const run = Math.max(0.1, 2 * stride * pixelMeters);
    const eastWestGrade = (right - left) / run;
    const northSouthGrade = (bottom - top) / run;
    const slope = Math.hypot(eastWestGrade, northSouthGrade) * 100;
    return {
      longitude: location.longitude,
      latitude: location.latitude,
      elevation: center,
      slope,
      zone: slopeZone(slope),
    };
  });

  const features = cells.map((cell, index) => {
    const location = locations[index];
    const half = stride / 2;
    const northWestCorner = globalPixelToLonLat(location.x - half, location.y - half);
    const northEastCorner = globalPixelToLonLat(location.x + half, location.y - half);
    const southEastCorner = globalPixelToLonLat(location.x + half, location.y + half);
    const southWestCorner = globalPixelToLonLat(location.x - half, location.y + half);
    return turf.polygon(
      [[northWestCorner, northEastCorner, southEastCorner, southWestCorner, northWestCorner]],
      { elevation: cell.elevation, slope: cell.slope, zone: cell.zone },
    );
  });

  const zoneCounts = { prime: 0, engineered: 0, restricted: 0 };
  cells.forEach((cell) => { zoneCounts[cell.zone] += 1; });
  const elevations = cells.map((cell) => cell.elevation);
  const area = turf.area(polygon);
  const perimeter = turf.length(turf.lineString(ring), { units: "meters" });
  const center = turf.centroid(polygon).geometry.coordinates as [number, number];
  const resolution = stride * (EARTH_CIRCUMFERENCE * Math.cos((center[1] * Math.PI) / 180)) / (TILE_SIZE * 2 ** TERRAIN_ZOOM);

  return {
    cells,
    heatmap: turf.featureCollection(features) as ParcelAnalysis["heatmap"],
    area,
    perimeter,
    minElevation: Math.min(...elevations),
    maxElevation: Math.max(...elevations),
    meanElevation: elevations.reduce((sum, elevation) => sum + elevation, 0) / elevations.length,
    prime: (zoneCounts.prime / cells.length) * 100,
    engineered: (zoneCounts.engineered / cells.length) * 100,
    restricted: (zoneCounts.restricted / cells.length) * 100,
    resolution,
  };
}

export function summarizeTerrain(points: TerrainPoint[]) {
  if (points.length < 2) {
    return { distance: 0, ascent: 0, prime: 0, engineered: 0, restricted: 0 };
  }

  const totals = { prime: 0, engineered: 0, restricted: 0 };
  let ascent = 0;

  for (let index = 1; index < points.length; index += 1) {
    const segment = points[index].distance - points[index - 1].distance;
    totals[points[index].zone] += segment;
    ascent += Math.max(0, points[index].elevation - points[index - 1].elevation);
  }

  const distance = points.at(-1)?.distance ?? 0;
  return {
    distance,
    ascent,
    prime: distance ? (totals.prime / distance) * 100 : 0,
    engineered: distance ? (totals.engineered / distance) * 100 : 0,
    restricted: distance ? (totals.restricted / distance) * 100 : 0,
  };
}

export function calculateEarthwork(
  points: TerrainPoint[],
  padElevation: number,
  corridorWidth: number,
) {
  let cut = 0;
  let fill = 0;

  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    const distance = right.distance - left.distance;
    const leftDelta = left.elevation - padElevation;
    const rightDelta = right.elevation - padElevation;

    if (leftDelta * rightDelta < 0) {
      const crossingRatio = Math.abs(leftDelta) / (Math.abs(leftDelta) + Math.abs(rightDelta));
      const leftVolume = Math.abs(leftDelta) * distance * crossingRatio * corridorWidth * 0.5;
      const rightVolume = Math.abs(rightDelta) * distance * (1 - crossingRatio) * corridorWidth * 0.5;
      if (leftDelta > 0) {
        cut += leftVolume;
        fill += rightVolume;
      } else {
        fill += leftVolume;
        cut += rightVolume;
      }
    } else {
      const averageDelta = (leftDelta + rightDelta) / 2;
      const volume = Math.abs(averageDelta) * distance * corridorWidth;
      if (averageDelta > 0) cut += volume;
      else fill += volume;
    }
  }

  return { cut, fill, balance: cut - fill };
}

export function calculateParcelEarthwork(
  analysis: ParcelAnalysis,
  padElevation: number,
) {
  const cellArea = analysis.cells.length ? analysis.area / analysis.cells.length : 0;
  let cut = 0;
  let fill = 0;

  analysis.cells.forEach((cell) => {
    const volume = (cell.elevation - padElevation) * cellArea;
    if (volume > 0) cut += volume;
    else fill += Math.abs(volume);
  });

  return { cut, fill, balance: cut - fill };
}
