import * as jsts from 'jsts';
import { ProjectedSegment } from './geoAlignment';
import { RouteStyle, MapFrame } from '../types';

export interface SVGExportOptions {
  frame: MapFrame;
  segments: ProjectedSegment[];
  routeStyle: RouteStyle;
  includeMapRaster?: string; // base64 PNG data URL if combined
  includeMetadata?: boolean;
  exportType: 'route-only' | 'combined';
  asPolygons?: boolean;
}

/**
 * Format a number to 3 decimal places for clean SVG output (0.001 mm resolution).
 */
function f(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/**
 * Generates a unified 2D closed polygon outline path for the trail.
 * Uses planar buffering (JSTS) to dissolve overlapping segments and remove internal intersections.
 * Crucial for Bambu Studio / Blender / 3D printing so the first layer prints line-after-line with no squiggles.
 */
export function generateOutlinePolygonPath(
  segments: ProjectedSegment[],
  strokeWidthMm: number
): string {
  if (!segments || segments.length === 0) return '';
  const halfW = Math.max(0.4, strokeWidthMm / 2);

  try {
    const jstsLib = (jsts as any).geom ? jsts : ((jsts as any).default || jsts);
    const gf = new jstsLib.geom.GeometryFactory();

    const bufferParams = new jstsLib.operation.buffer.BufferParameters();
    bufferParams.setEndCapStyle(jstsLib.operation.buffer.BufferParameters.CAP_ROUND);
    bufferParams.setJoinStyle(jstsLib.operation.buffer.BufferParameters.JOIN_ROUND);
    bufferParams.setQuadrantSegments(8);

    let bufferedTrail: any = null;

    for (const seg of segments) {
      if (!seg || seg.length === 0) continue;
      const coords: any[] = [];
      for (const pt of seg) {
        const x = pt.xMm;
        const y = pt.yMm;
        if (
          coords.length === 0 ||
          Math.hypot(x - coords[coords.length - 1].x, y - coords[coords.length - 1].y) > 0.04
        ) {
          coords.push(new jstsLib.geom.Coordinate(x, y));
        }
      }
      if (coords.length < 2) continue;

      const rawLine = gf.createLineString(coords);
      const simplified = jstsLib.simplify?.DouglasPeuckerSimplifier?.simplify
        ? jstsLib.simplify.DouglasPeuckerSimplifier.simplify(rawLine, 0.05)
        : rawLine;

      const lineToBuffer = (simplified instanceof jstsLib.geom.LineString && simplified.getNumPoints() >= 2)
        ? simplified
        : rawLine;

      const bufferOp = new jstsLib.operation.buffer.BufferOp(lineToBuffer, bufferParams);
      const segBuffered = bufferOp.getResultGeometry(halfW);
      if (!bufferedTrail) {
        bufferedTrail = segBuffered;
      } else {
        bufferedTrail = bufferedTrail.union(segBuffered);
      }
    }

    if (!bufferedTrail) return '';

    const buffered = bufferedTrail;

    let pathData = '';
    for (let i = 0; i < buffered.getNumGeometries(); i++) {
      const poly = buffered.getGeometryN(i);
      if (!(poly instanceof jstsLib.geom.Polygon)) continue;

      const extRing = poly.getExteriorRing().getCoordinates();
      if (extRing.length >= 3) {
        pathData += `M ${f(extRing[0].x)} ${f(extRing[0].y)} `;
        for (let k = 1; k < extRing.length; k++) {
          pathData += `L ${f(extRing[k].x)} ${f(extRing[k].y)} `;
        }
        pathData += 'Z ';
      }

      const numHoles = poly.getNumInteriorRing();
      for (let h = 0; h < numHoles; h++) {
        const holeRingGeom = poly.getInteriorRingN(h);
        // Filter out micro-holes (< 35 mm²) at acute junctions, forks, and crossings.
        // This permanently eliminates the "dot and a triangle around it" artifacts and slicer travel jumps!
        const holePoly = gf.createPolygon(holeRingGeom, []);
        if (holePoly.getArea() < 35.0) {
          continue;
        }

        const holeRing = holeRingGeom.getCoordinates();
        if (holeRing.length >= 3) {
          pathData += `M ${f(holeRing[0].x)} ${f(holeRing[0].y)} `;
          for (let k = 1; k < holeRing.length; k++) {
            pathData += `L ${f(holeRing[k].x)} ${f(holeRing[k].y)} `;
          }
          pathData += 'Z ';
        }
      }
    }
    return pathData.trim();
  } catch (err) {
    console.warn('Failed to generate 2D polygon outline path for SVG:', err);
    return '';
  }
}

/**
 * Generates an SVG path string ('d' attribute) from projected segments in mm coordinates.
 */
export function generatePathData(segments: ProjectedSegment[]): string {
  if (!segments || segments.length === 0) return '';

  return segments
    .map((seg) => {
      if (!seg || seg.length === 0) return '';
      const start = `M ${f(seg[0].xMm)} ${f(seg[0].yMm)}`;
      const rest = seg.slice(1).map((p) => `L ${f(p.xMm)} ${f(p.yMm)}`).join(' ');
      return `${start} ${rest}`;
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Generates start and finish markers SVG elements.
 */
function generateMarkers(
  segments: ProjectedSegment[],
  routeStyle: RouteStyle
): string {
  if (!segments || segments.length === 0) return '';
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  if (!firstSeg || firstSeg.length === 0 || !lastSeg || lastSeg.length === 0) return '';

  const startPt = firstSeg[0];
  const finishPt = lastSeg[lastSeg.length - 1];

  let markersSvg = '';
  const markerRadius = Math.max(1.5, routeStyle.strokeWidthMm * 1.2);

  if (routeStyle.showStartMarker) {
    markersSvg += `
    <!-- Start Marker -->
    <g id="start-marker" transform="translate(${f(startPt.xMm)}, ${f(startPt.yMm)})">
      <circle r="${f(markerRadius * 1.4)}" fill="#ffffff" stroke="#000000" stroke-width="0.5" />
      <circle r="${f(markerRadius)}" fill="${routeStyle.startMarkerColor || '#22c55e'}" />
      <circle r="${f(markerRadius * 0.4)}" fill="#ffffff" />
    </g>`;
  }

  if (routeStyle.showFinishMarker) {
    markersSvg += `
    <!-- Finish Marker -->
    <g id="finish-marker" transform="translate(${f(finishPt.xMm)}, ${f(finishPt.yMm)})">
      <circle r="${f(markerRadius * 1.4)}" fill="#ffffff" stroke="#000000" stroke-width="0.5" />
      <circle r="${f(markerRadius)}" fill="${routeStyle.finishMarkerColor || '#ef4444'}" />
      <circle r="${f(markerRadius * 0.4)}" fill="#ffffff" />
    </g>`;
  }

  return markersSvg;
}

/**
 * Generates direction chevrons/arrows along segments at spaced mm intervals.
 */
function generateDirectionArrows(
  segments: ProjectedSegment[],
  routeStyle: RouteStyle
): string {
  if (!routeStyle.showDirectionArrows || !segments || segments.length === 0) return '';

  const intervalMm = routeStyle.arrowSpacingMm || 15;
  const arrowSize = Math.max(1.5, routeStyle.strokeWidthMm * 1.0);
  let arrowsSvg = '<g id="direction-arrows" fill="none" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round">';

  segments.forEach((seg) => {
    let accumulated = 0;
    for (let i = 0; i < seg.length - 1; i++) {
      const p1 = seg[i];
      const p2 = seg[i + 1];
      const dist = Math.hypot(p2.xMm - p1.xMm, p2.yMm - p1.yMm);
      accumulated += dist;

      if (accumulated >= intervalMm && dist > 0.5) {
        accumulated = 0;
        const angle = Math.atan2(p2.yMm - p1.yMm, p2.xMm - p1.xMm);
        const midX = (p1.xMm + p2.xMm) / 2;
        const midY = (p1.yMm + p2.yMm) / 2;

        const leftAngle = angle + Math.PI * 0.75;
        const rightAngle = angle - Math.PI * 0.75;

        const x1 = midX + arrowSize * Math.cos(leftAngle);
        const y1 = midY + arrowSize * Math.sin(leftAngle);
        const x2 = midX + arrowSize * Math.cos(rightAngle);
        const y2 = midY + arrowSize * Math.sin(rightAngle);

        arrowsSvg += `<path d="M ${f(x1)} ${f(y1)} L ${f(midX)} ${f(midY)} L ${f(x2)} ${f(y2)}" />`;
      }
    }
  });

  arrowsSvg += '</g>';
  return arrowsSvg;
}

/**
 * Generate fully compliant, dimensionally exact SVG XML string.
 */
export function generateSVG(options: SVGExportOptions): string {
  const { frame, segments, routeStyle, includeMapRaster, exportType } = options;
  const { widthMm, heightMm } = frame;

  const pathData = generatePathData(segments);
  const polygonPathData = generateOutlinePolygonPath(segments, routeStyle.strokeWidthMm);
  const markers = generateMarkers(segments, routeStyle);
  const arrows = generateDirectionArrows(segments, routeStyle);

  const timestamp = new Date().toISOString();

  let bodyContent = '';

  // If combined map and raster map provided
  if (exportType === 'combined' && includeMapRaster) {
    bodyContent += `
  <!-- Map Raster Layer -->
  <g id="map-artwork">
    <image href="${includeMapRaster}" x="0" y="0" width="${f(widthMm)}" height="${f(heightMm)}" preserveAspectRatio="none" />
  </g>`;
  }

  // Route Vector Layer
  if (pathData || polygonPathData) {
    if (exportType === 'route-only') {
      // Optimized for 3D Slicing (Bambu Studio, OrcaSlicer, PrusaSlicer) & Blender CAD:
      // We export ONLY the single, solid 2D closed polygon ribbon.
      // Crucial: nanosvg (used by Bambu Studio) ignores CSS "display: none". If an extra
      // centerline <path> exists in the SVG, Bambu Studio imports it as a second overlapping
      // 3D object, which causes discontinuous gap fill, severe over-extrusion, and bed lifting!
      bodyContent += `
  <!-- GPX Route Vector Overlay (Optimized for 3D Slicing & CAD Extrusion) -->
  <g id="gpx-route">
    ${
      polygonPathData
        ? `<path id="route-solid-ribbon" d="${polygonPathData}" fill="${routeStyle.color}" fill-rule="evenodd" />`
        : `<path id="route-path" d="${pathData}" fill="none" stroke="${routeStyle.color}" stroke-width="${f(
            routeStyle.strokeWidthMm
          )}" stroke-linecap="round" stroke-linejoin="round" />`
    }
  </g>`;
    } else {
      // Combined Poster Art overlay (with glow, arrows, start/finish markers)
      bodyContent += `
  <!-- GPX Route Vector Overlay -->
  <g id="gpx-route" opacity="${f(routeStyle.opacity)}">
    ${
      routeStyle.glow
        ? `<path d="${pathData}" fill="none" stroke="${routeStyle.glowColor || '#38bdf8'}" stroke-width="${f(
            routeStyle.strokeWidthMm * 2
          )}" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />`
        : ''
    }
    ${
      polygonPathData
        ? `<path id="route-solid-ribbon" d="${polygonPathData}" fill="${routeStyle.color}" fill-rule="evenodd" />`
        : ''
    }
    <path id="route-path" d="${pathData}" fill="none" stroke="${routeStyle.color}" stroke-width="${f(
      routeStyle.strokeWidthMm
    )}" stroke-linecap="round" stroke-linejoin="round" />
    ${arrows}
    ${markers}
  </g>`;
    }
  } else {
    bodyContent += `
  <!-- Empty Route Notice: No vector segments fell within the frame coordinates -->
  <g id="empty-notice">
    <!-- Center the frame over your GPX route on the map to capture segments -->
  </g>`;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${f(widthMm)}mm" 
  height="${f(heightMm)}mm" 
  viewBox="0 0 ${f(widthMm)} ${f(heightMm)}"
  version="1.1"
>
  <!-- Generated by MapCraft (Custom Map Designer & 3D Trail Generator) -->
  <!-- Target Dimensions: ${widthMm} mm x ${heightMm} mm -->
  <!-- Trail Width: ${routeStyle.strokeWidthMm} mm -->
  <!-- Created: ${timestamp} -->
  <!-- Center: [${frame.center[0].toFixed(6)}, ${frame.center[1].toFixed(6)}] Zoom: ${frame.zoom.toFixed(2)} -->
  <metadata>
    <mapcraft>
      <widthMm>${widthMm}</widthMm>
      <heightMm>${heightMm}</heightMm>
      <strokeWidthMm>${routeStyle.strokeWidthMm}</strokeWidthMm>
      <center lon="${frame.center[0]}" lat="${frame.center[1]}" />
      <zoom>${frame.zoom}</zoom>
      <bearing>${frame.bearing}</bearing>
    </mapcraft>
  </metadata>
  <defs>
    <clipPath id="frame-clip">
      <rect x="0" y="0" width="${f(widthMm)}" height="${f(heightMm)}" />
    </clipPath>
  </defs>
  <g clip-path="url(#frame-clip)">
    ${bodyContent}
  </g>
</svg>`;

  return svg.trim();
}

/**
 * Triggers a download of a string as an SVG file in browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'image/svg+xml') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
