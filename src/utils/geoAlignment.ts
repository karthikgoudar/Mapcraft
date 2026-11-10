import { RoutePoint, RouteTrack, MapFrame } from '../types';

export interface ProjectedPoint {
  xMm: number;
  yMm: number;
  ele?: number;
  inFrame: boolean;
}

export type ProjectedSegment = ProjectedPoint[];

/**
 * Clips a 2D line segment (p1 -> p2) against the bounding box [0, 0, widthMm, heightMm]
 * using the Liang-Barsky parametric line clipping algorithm.
 */
export function clipSegmentLiangBarsky(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  h: number
): { x0: number; y0: number; x1: number; y1: number } | null {
  const dx = x1 - x0;
  const dy = y1 - y0;

  let t0 = 0;
  let t1 = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [x0, w - x0, y0, h - y0];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // Parallel and outside
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }

  if (t0 > t1) return null;

  return {
    x0: x0 + t0 * dx,
    y0: y0 + t0 * dy,
    x1: x0 + t1 * dx,
    y1: y0 + t1 * dy
  };
}

/**
 * Clip a polyline of physical mm points against the rectangle [0, 0, widthMm, heightMm].
 * Produces an array of continuous visible sub-segments.
 */
export function clipPolylineToFrame(
  points: ProjectedPoint[],
  widthMm: number,
  heightMm: number
): ProjectedSegment[] {
  if (points.length < 2) return [];

  const visibleSegments: ProjectedSegment[] = [];
  let currentSegment: ProjectedPoint[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    const clipped = clipSegmentLiangBarsky(p0.xMm, p0.yMm, p1.xMm, p1.yMm, widthMm, heightMm);

    if (clipped) {
      // If start of clipped edge matches previous currentSegment end, append
      if (currentSegment.length > 0) {
        const last = currentSegment[currentSegment.length - 1];
        const dist = Math.hypot(last.xMm - clipped.x0, last.yMm - clipped.y0);
        if (dist > 0.001) {
          // Discontinuity: close current segment and start fresh
          visibleSegments.push(currentSegment);
          currentSegment = [{ xMm: clipped.x0, yMm: clipped.y0, inFrame: true, ele: p0.ele }];
        }
      } else {
        currentSegment.push({ xMm: clipped.x0, yMm: clipped.y0, inFrame: true, ele: p0.ele });
      }

      currentSegment.push({ xMm: clipped.x1, yMm: clipped.y1, inFrame: true, ele: p1.ele });
    } else {
      // Line is entirely outside
      if (currentSegment.length > 0) {
        visibleSegments.push(currentSegment);
        currentSegment = [];
      }
    }
  }

  if (currentSegment.length > 0) {
    visibleSegments.push(currentSegment);
  }

  return visibleSegments;
}

/**
 * Projects a GPX route into physical millimeter coordinates using the map's current projection
 * and the physical frame bounding box.
 * 
 * Pipeline:
 * GPX (lat, lon) -> Map Viewport (px, py) -> Frame Pixel (px - x0, py - y0) -> Physical mm (mm) -> SVG
 */
export function projectTracksToPhysicalFrame(
  tracks: RouteTrack[],
  projectPoint: (coord: [number, number]) => { x: number; y: number },
  frame: MapFrame,
  clipToFrame = true
): {
  segments: ProjectedSegment[];
  allPointsCount: number;
  insidePointsCount: number;
} {
  const { widthMm, heightMm, screenRect } = frame;
  const scaleX = widthMm / screenRect.width;
  const scaleY = heightMm / screenRect.height;

  let allPointsCount = 0;
  let insidePointsCount = 0;

  const resultSegments: ProjectedSegment[] = [];

  tracks.forEach((track) => {
    track.segments.forEach((segment) => {
      const rawPhysicalPoints: ProjectedPoint[] = [];

      segment.forEach((pt) => {
        allPointsCount++;
        const screenPx = projectPoint([pt.lon, pt.lat]);
        const relX = screenPx.x - screenRect.x;
        const relY = screenPx.y - screenRect.y;

        const xMm = relX * scaleX;
        const yMm = relY * scaleY;

        const inFrame = xMm >= 0 && xMm <= widthMm && yMm >= 0 && yMm <= heightMm;
        if (inFrame) insidePointsCount++;

        rawPhysicalPoints.push({
          xMm,
          yMm,
          ele: pt.ele,
          inFrame
        });
      });

      if (clipToFrame) {
        const clipped = clipPolylineToFrame(rawPhysicalPoints, widthMm, heightMm);
        resultSegments.push(...clipped);
      } else {
        resultSegments.push(rawPhysicalPoints);
      }
    });
  });

  return {
    segments: resultSegments,
    allPointsCount,
    insidePointsCount
  };
}

/**
 * Ramer-Douglas-Peucker algorithm for polyline simplification in 2D mm space.
 */
export function simplifyPolyline(points: ProjectedPoint[], toleranceMm: number): ProjectedPoint[] {
  if (points.length <= 2 || toleranceMm <= 0) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  const dx = end.xMm - start.xMm;
  const dy = end.yMm - start.yMm;
  const lineLenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    let dist = 0;

    if (lineLenSq === 0) {
      dist = Math.hypot(pt.xMm - start.xMm, pt.yMm - start.yMm);
    } else {
      const t = Math.max(0, Math.min(1, ((pt.xMm - start.xMm) * dx + (pt.yMm - start.yMm) * dy) / lineLenSq));
      const projX = start.xMm + t * dx;
      const projY = start.yMm + t * dy;
      dist = Math.hypot(pt.xMm - projX, pt.yMm - projY);
    }

    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > toleranceMm) {
    const left = simplifyPolyline(points.slice(0, maxIdx + 1), toleranceMm);
    const right = simplifyPolyline(points.slice(maxIdx), toleranceMm);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [start, end];
  }
}

/**
 * Chaikin's corner cutting algorithm for polyline smoothing in mm.
 */
export function smoothPolylineChaikin(points: ProjectedPoint[], iterations: number = 1): ProjectedPoint[] {
  if (points.length < 3 || iterations <= 0) return points;

  let current = points;
  for (let it = 0; it < iterations; it++) {
    const next: ProjectedPoint[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];

      // Q = 0.75 * p0 + 0.25 * p1
      const q: ProjectedPoint = {
        xMm: 0.75 * p0.xMm + 0.25 * p1.xMm,
        yMm: 0.75 * p0.yMm + 0.25 * p1.yMm,
        ele: p0.ele !== undefined && p1.ele !== undefined ? 0.75 * p0.ele + 0.25 * p1.ele : p0.ele,
        inFrame: p0.inFrame && p1.inFrame
      };

      // R = 0.25 * p0 + 0.75 * p1
      const r: ProjectedPoint = {
        xMm: 0.25 * p0.xMm + 0.75 * p1.xMm,
        yMm: 0.25 * p0.yMm + 0.75 * p1.yMm,
        ele: p0.ele !== undefined && p1.ele !== undefined ? 0.25 * p0.ele + 0.75 * p1.ele : p1.ele,
        inFrame: p0.inFrame && p1.inFrame
      };

      next.push(q, r);
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}
