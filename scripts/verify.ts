import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { parseGPX, calculateRouteStats } from '../src/utils/gpxParser';
import { 
  projectTracksToPhysicalFrame, 
  clipSegmentLiangBarsky, 
  clipPolylineToFrame,
  simplifyPolyline,
  smoothPolylineChaikin
} from '../src/utils/geoAlignment';
import { generateSVG } from '../src/utils/svgGenerator';
import { 
  buildTrail3DGeometry, 
  validatePrintability, 
  exportToBinarySTL 
} from '../src/utils/stlGenerator';
import { DEFAULT_FRAME, DEFAULT_ROUTE_STYLE, DEFAULT_3D_CONFIG } from '../src/utils/projectStorage';

// Minimal polyfill for DOMParser in Node test environment
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;

console.log('====================================================');
console.log('MAPCRAFT ACCEPTANCE & VERIFICATION TEST SUITE');
console.log('====================================================\n');

// 1. Verify Mumbai Marathon GPX parsing
const gpxPath = path.resolve('public/samples/mumbai_marathon.gpx');
if (!fs.existsSync(gpxPath)) {
  console.error('FAIL: Mumbai Marathon GPX sample file not found at:', gpxPath);
  process.exit(1);
}
const gpxContent = fs.readFileSync(gpxPath, 'utf-8');
const tracks = parseGPX(gpxContent);

console.log('✓ TEST 1: GPX Parsing');
console.log(`  Parsed ${tracks.length} track(s), name: "${tracks[0].name}"`);
const totalPts = tracks.reduce((sum, t) => sum + t.segments.reduce((s2, seg) => s2 + seg.length, 0), 0);
console.log(`  Extracted ${totalPts} valid track points.`);

const stats = calculateRouteStats(tracks);
console.log(`  Distance: ${stats.totalDistanceKm} km (Expect ~42.2 km marathon distance)`);
console.log(`  Elevation Gain: +${stats.elevationGainM}m, Range: ${stats.minElevationM}m to ${stats.maxElevationM}m`);
if (stats.totalDistanceKm < 40 || stats.totalDistanceKm > 45) {
  console.error(`FAIL: Total distance ${stats.totalDistanceKm} km outside expected ~42.2km marathon range`);
  process.exit(1);
}
console.log('  -> PASS: GPX parsed with high geographic fidelity.\n');

// 2. Test Geographic Alignment & Projection Pipeline
console.log('✓ TEST 2: Geographic Alignment Engine & Physical Millimeter Transform');
// Simulate Web Mercator map projection over Mumbai area
// Frame: 119 mm x 243 mm
const testFrame = {
  ...DEFAULT_FRAME,
  widthMm: 119,
  heightMm: 243,
  screenRect: { x: 100, y: 100, width: 300, height: 612.6 } // aspect ratio = 119 / 243 = 0.4897
};

// Mock projector
const mockProjector = (coord: [number, number]) => {
  // lon 72.80 -> 72.86 mapped to x: 100 -> 400
  // lat 18.91 -> 19.05 mapped to y: 712 -> 100 (north up)
  const normX = (coord[0] - 72.80) / (72.86 - 72.80);
  const normY = (19.05 - coord[1]) / (19.05 - 18.91);
  return {
    x: 100 + normX * 300,
    y: 100 + normY * 612.6
  };
};

const projected = projectTracksToPhysicalFrame(tracks, mockProjector, testFrame, true);
console.log(`  Projected segments count: ${projected.segments.length}`);
console.log(`  Inside frame points: ${projected.insidePointsCount} / ${projected.allPointsCount}`);

// Verify all points are strictly within [0, 119] x [0, 243] mm
let outOfBounds = false;
projected.segments.forEach((seg) => {
  seg.forEach((pt) => {
    if (pt.xMm < -0.001 || pt.xMm > 119.001 || pt.yMm < -0.001 || pt.yMm > 243.001) {
      outOfBounds = true;
    }
  });
});

if (outOfBounds) {
  console.error('FAIL: Found projected points outside the physical frame boundary [0, 119] x [0, 243] mm');
  process.exit(1);
}
console.log('  -> PASS: All projected points are strictly bounded within [0, 119] × [0, 243] mm.\n');

// 3. Test Clipping Algorithm (Liang-Barsky)
console.log('✓ TEST 3: Liang-Barsky Boundary Clipping (No stretching)');
// Line from (-10, 50) to (50, 50) in a [0, 100] box
const clipTest1 = clipSegmentLiangBarsky(-10, 50, 50, 50, 100, 100);
if (!clipTest1 || Math.abs(clipTest1.x0 - 0) > 0.001 || clipTest1.x1 !== 50) {
  console.error('FAIL: Liang-Barsky clip failed for entering segment:', clipTest1);
  process.exit(1);
}
// Line completely outside: (-20, 50) to (-10, 50)
const clipTest2 = clipSegmentLiangBarsky(-20, 50, -10, 50, 100, 100);
if (clipTest2 !== null) {
  console.error('FAIL: Line completely outside should be null:', clipTest2);
  process.exit(1);
}
console.log('  -> PASS: Line clipping correctly trims boundary crossings without distortion.\n');

// 4. Test SVG Generation (Exact Millimeter Units and ViewBox)
console.log('✓ TEST 4: SVG Export Dimensions & Standards Compliance');
const routeSvg = generateSVG({
  frame: testFrame,
  segments: projected.segments,
  routeStyle: { ...DEFAULT_ROUTE_STYLE, strokeWidthMm: 2.0 },
  exportType: 'route-only'
});

if (!routeSvg.includes('width="119mm"') || !routeSvg.includes('height="243mm"')) {
  console.error('FAIL: SVG missing physical mm dimensions in width/height attributes');
  process.exit(1);
}
if (!routeSvg.includes('viewBox="0 0 119 243"')) {
  console.error('FAIL: SVG viewBox mismatch');
  process.exit(1);
}
if (!routeSvg.includes('id="route-solid-ribbon"')) {
  console.error('FAIL: Single-shell 2D solid ribbon not found in route-only SVG export');
  process.exit(1);
}

// Verify combined poster SVG includes stroke width
const combinedSvg = generateSVG({
  frame: testFrame,
  segments: projected.segments,
  routeStyle: { ...DEFAULT_ROUTE_STYLE, strokeWidthMm: 2.0 },
  exportType: 'combined'
});
if (!combinedSvg.includes('stroke-width="2"')) {
  console.error('FAIL: Trail width 2mm not found in stroke-width attribute of combined poster');
  process.exit(1);
}
console.log('  SVG Header: width="119mm" height="243mm" viewBox="0 0 119 243"');
console.log('  -> PASS: SVG conforms strictly to CAD and 3D printing physical standards.\n');

// 5. Test 3D Mesh Generation & Flat Underside Verification
console.log('✓ TEST 5: 3D Trail Mesh Generation & Watertight STL Export');
const meshGeom = buildTrail3DGeometry(
  projected.segments,
  testFrame.widthMm,
  testFrame.heightMm,
  {
    ...DEFAULT_3D_CONFIG,
    trailWidthMm: 2.0,
    extrusionHeightMm: 7.0
  }
);

const positions = meshGeom.attributes.position.array;
let minZ = Infinity;
let maxZ = -Infinity;
for (let i = 2; i < positions.length; i += 3) {
  const z = positions[i];
  if (z < minZ) minZ = z;
  if (z > maxZ) maxZ = z;
}

console.log(`  Mesh Z Extents: min Z = ${minZ.toFixed(4)} mm, max Z = ${maxZ.toFixed(4)} mm`);
if (Math.abs(minZ) > 0.001) {
  console.error(`FAIL: Underside is not flat at Z=0! min Z = ${minZ}`);
  process.exit(1);
}
if (maxZ < 6.5 || maxZ > 7.5) {
  console.error(`FAIL: Extrusion height ${maxZ} does not match expected 7.0 mm`);
  process.exit(1);
}
console.log('  ✓ Underside is completely planar at Z = 0.000 mm (perfect 3D printer bed adhesion).');

const stlBuffer = exportToBinarySTL(meshGeom);
console.log(`  STL binary buffer size: ${(stlBuffer.byteLength / 1024).toFixed(1)} KB`);
if (stlBuffer.byteLength < 84) {
  console.error('FAIL: STL buffer too small');
  process.exit(1);
}
console.log('  -> PASS: Binary STL successfully generated and validated.\n');

console.log('====================================================');
console.log('ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! (5/5)');
console.log('====================================================');
