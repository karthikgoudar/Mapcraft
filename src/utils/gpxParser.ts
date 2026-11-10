import { RouteTrack, RoutePoint, RouteStats } from '../types';

/**
 * Calculates the Haversine distance in kilometers between two coordinates.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse GPX file contents into structured RouteTrack objects.
 */
export function parseGPX(xmlText: string): RouteTrack[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Malformed XML in GPX file: ' + parserError.textContent);
  }

  const tracks: RouteTrack[] = [];
  const trkElements = xmlDoc.querySelectorAll('trk');

  if (trkElements.length > 0) {
    trkElements.forEach((trk, trkIndex) => {
      const name = trk.querySelector('name')?.textContent?.trim() || `Track ${trkIndex + 1}`;
      const segments: RoutePoint[][] = [];
      const trksegElements = trk.querySelectorAll('trkseg');

      trksegElements.forEach((trkseg) => {
        const segPoints: RoutePoint[] = [];
        const trkptElements = trkseg.querySelectorAll('trkpt');

        trkptElements.forEach((pt) => {
          const lat = parseFloat(pt.getAttribute('lat') || '');
          const lon = parseFloat(pt.getAttribute('lon') || '');

          if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return; // skip invalid coordinate
          }

          const eleNode = pt.querySelector('ele');
          const ele = eleNode ? parseFloat(eleNode.textContent || '') : undefined;
          const timeNode = pt.querySelector('time');
          const time = timeNode ? timeNode.textContent || undefined : undefined;

          segPoints.push({
            lat,
            lon,
            ele: !isNaN(ele as number) ? ele : undefined,
            time
          });
        });

        if (segPoints.length > 0) {
          segments.push(segPoints);
        }
      });

      if (segments.length > 0) {
        tracks.push({
          id: `trk-${trkIndex}-${Date.now()}`,
          name,
          segments
        });
      }
    });
  }

  // Also check for routes (<rte>) if no <trk> found
  if (tracks.length === 0) {
    const rteElements = xmlDoc.querySelectorAll('rte');
    rteElements.forEach((rte, rteIndex) => {
      const name = rte.querySelector('name')?.textContent?.trim() || `Route ${rteIndex + 1}`;
      const segPoints: RoutePoint[] = [];
      const rteptElements = rte.querySelectorAll('rtept');

      rteptElements.forEach((pt) => {
        const lat = parseFloat(pt.getAttribute('lat') || '');
        const lon = parseFloat(pt.getAttribute('lon') || '');
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return;
        }
        const eleNode = pt.querySelector('ele');
        const ele = eleNode ? parseFloat(eleNode.textContent || '') : undefined;
        segPoints.push({ lat, lon, ele: !isNaN(ele as number) ? ele : undefined });
      });

      if (segPoints.length > 0) {
        tracks.push({
          id: `rte-${rteIndex}-${Date.now()}`,
          name,
          segments: [segPoints]
        });
      }
    });
  }

  if (tracks.length === 0) {
    throw new Error('No valid track points or route points found in GPX file.');
  }

  return cleanTracksAndComputeDistances(tracks);
}

/**
 * Parse KML string.
 */
export function parseKML(kmlText: string): RouteTrack[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'application/xml');
  const tracks: RouteTrack[] = [];

  const lineStrings = xmlDoc.querySelectorAll('LineString');
  lineStrings.forEach((ls, idx) => {
    const coordText = ls.querySelector('coordinates')?.textContent?.trim() || '';
    const points: RoutePoint[] = [];
    const tuples = coordText.split(/\s+/);

    tuples.forEach((tuple) => {
      const parts = tuple.split(',');
      if (parts.length >= 2) {
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        const ele = parts[2] ? parseFloat(parts[2]) : undefined;
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          points.push({ lat, lon, ele: !isNaN(ele as number) ? ele : undefined });
        }
      }
    });

    if (points.length > 0) {
      tracks.push({
        id: `kml-${idx}`,
        name: `Path ${idx + 1}`,
        segments: [points]
      });
    }
  });

  if (tracks.length === 0) {
    throw new Error('No valid LineString geometry found in KML file.');
  }

  return cleanTracksAndComputeDistances(tracks);
}

/**
 * Parse GeoJSON object or string.
 */
export function parseGeoJSON(jsonStringOrObj: string | any): RouteTrack[] {
  const data = typeof jsonStringOrObj === 'string' ? JSON.parse(jsonStringOrObj) : jsonStringOrObj;
  const tracks: RouteTrack[] = [];

  const processCoordinates = (coords: number[][]): RoutePoint[] => {
    return coords
      .map((c) => ({
        lon: c[0],
        lat: c[1],
        ele: c.length > 2 && !isNaN(c[2]) ? c[2] : undefined
      }))
      .filter((p) => !isNaN(p.lat) && !isNaN(p.lon) && p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180);
  };

  const processGeometry = (geom: any, name: string) => {
    if (!geom) return;
    if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
      const pts = processCoordinates(geom.coordinates);
      if (pts.length > 0) {
        tracks.push({
          id: `geojson-${tracks.length}`,
          name: name || `Track ${tracks.length + 1}`,
          segments: [pts]
        });
      }
    } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
      const segs = geom.coordinates.map(processCoordinates).filter((s: RoutePoint[]) => s.length > 0);
      if (segs.length > 0) {
        tracks.push({
          id: `geojson-${tracks.length}`,
          name: name || `Multi-track ${tracks.length + 1}`,
          segments: segs
        });
      }
    }
  };

  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    data.features.forEach((feat: any, idx: number) => {
      const name = feat.properties?.name || `Feature ${idx + 1}`;
      processGeometry(feat.geometry, name);
    });
  } else if (data.type === 'Feature') {
    processGeometry(data.geometry, data.properties?.name || 'Feature');
  } else if (data.type === 'LineString' || data.type === 'MultiLineString') {
    processGeometry(data, 'Route');
  }

  if (tracks.length === 0) {
    throw new Error('No valid LineString or MultiLineString found in GeoJSON.');
  }

  return cleanTracksAndComputeDistances(tracks);
}

/**
 * Filter out crazy GPS teleports/jumps and annotate cumulative distances.
 */
function cleanTracksAndComputeDistances(tracks: RouteTrack[]): RouteTrack[] {
  return tracks.map((track) => {
    const cleanedSegments = track.segments.map((segment) => {
      if (segment.length <= 1) return segment;

      const filtered: RoutePoint[] = [segment[0]];
      let cumDist = 0;
      segment[0].distFromStartKm = 0;

      for (let i = 1; i < segment.length; i++) {
        const prev = filtered[filtered.length - 1];
        const curr = segment[i];
        const dist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);

        // Detect extreme GPS teleportation (> 100km instantaneous jump in a single point)
        if (dist > 100) {
          // If there's another point after that returns close to prev, skip this outlier
          if (i + 1 < segment.length) {
            const next = segment[i + 1];
            const distNextToPrev = haversineDistance(prev.lat, prev.lon, next.lat, next.lon);
            if (distNextToPrev < 5) {
              continue; // skip outlier point
            }
          }
        }

        cumDist += dist;
        filtered.push({
          ...curr,
          distFromStartKm: cumDist
        });
      }

      return filtered;
    });

    return {
      ...track,
      segments: cleanedSegments
    };
  });
}

/**
 * Compute aggregate statistics for the tracks.
 */
export function calculateRouteStats(tracks: RouteTrack[]): RouteStats {
  let totalDistanceKm = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  let minElevationM = Infinity;
  let maxElevationM = -Infinity;
  let pointsCount = 0;
  let segmentsCount = 0;

  tracks.forEach((track) => {
    track.segments.forEach((segment) => {
      segmentsCount++;
      pointsCount += segment.length;

      for (let i = 0; i < segment.length; i++) {
        const pt = segment[i];
        if (pt.ele !== undefined) {
          if (pt.ele < minElevationM) minElevationM = pt.ele;
          if (pt.ele > maxElevationM) maxElevationM = pt.ele;

          if (i > 0) {
            const prevEle = segment[i - 1].ele;
            if (prevEle !== undefined) {
              const diff = pt.ele - prevEle;
              // Ignore tiny noise (< 0.2m)
              if (diff > 0.2) elevationGainM += diff;
              else if (diff < -0.2) elevationLossM += Math.abs(diff);
            }
          }
        }

        if (i > 0) {
          const prev = segment[i - 1];
          totalDistanceKm += haversineDistance(prev.lat, prev.lon, pt.lat, pt.lon);
        }
      }
    });
  });

  return {
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    minElevationM: minElevationM === Infinity ? 0 : Math.round(minElevationM),
    maxElevationM: maxElevationM === -Infinity ? 0 : Math.round(maxElevationM),
    pointsCount,
    segmentsCount
  };
}

/**
 * Universal file parser for GPX, KML, or GeoJSON.
 */
export function parseRouteFile(content: string, filename: string): RouteTrack[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.kml')) {
    return parseKML(content);
  }
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) {
    return parseGeoJSON(content);
  }
  // Default to GPX
  return parseGPX(content);
}
