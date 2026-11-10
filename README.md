# MapCraft 🗺️
### Custom Map Designer, GPX Route Aligner & 3D Trail Generator

MapCraft is a modern web application designed for cartography enthusiasts, marathoners, trail runners, 3D printing creators, and CAD designers. It bridges the gap between Snazzy Maps, GPX Studio, physical map poster designers, SVG vector engines, and 3D mesh slicers.

---

## ✨ Core Product Capabilities

1. **Map Designer (MapLibre GL JS)**
   - Fast geocoding and search for global cities, landmarks, and addresses (Nominatim).
   - Predefined curated styles:
     - **Dark Monochrome** (high-contrast modern wall art)
     - **Light Monochrome** (clean architectural aesthetic)
     - **Minimal Clean** (muted subtle roads & topography)
     - **Topographic Terrain** (ESRI & USGS hillshading and contour lines)
     - **Satellite Imagery** (ESRI high-resolution global aerial tiles)
     - **Custom Palette** (interactive color pickers & visibility toggles for roads, water bodies, buildings, parks, boundaries, and labels).

2. **Physical Map Framing**
   - Interactive screen-space frame overlay with live dimensioning ($119 \times 243\text{ mm}$ default test case).
   - Displays real-time geographic coordinates of all four corners (**NW, NE, SE, SW**) and center coordinate.
   - Lockable aspect ratio with corner resize handles and pan-around freedom.
   - Center crosshair and physical mm ruler indicators.
   - Non-stretching, conformal Web Mercator projection preservation.

3. **GPX / KML / GeoJSON Route Processor**
   - Automatic parser with GPS jump / teleportation outlier detection.
   - Preserves original coordinate order and multi-segment tracks.
   - Live elevation profile, cumulative distance, min/max altitude, and climb statistics.
   - Pre-loaded with genuine **Tata Mumbai Marathon 2025 (42.195 km)** sample.

4. **Geographic Alignment Engine (Zero Manual Dragging)**
   - Strict transformation pipeline:
     $$\text{GPX } (\text{lat, lon}) \longrightarrow \text{Web Mercator (EPSG:3857)} \longrightarrow \text{Viewport } (x, y) \longrightarrow \text{Frame } (x_{rel}, y_{rel}) \longrightarrow \text{Physical mm} \longrightarrow \text{SVG / 3D Mesh}$$
   - **When you pan the map or resize the frame, the GPX route automatically follows its true geographic coordinates.**
   - Includes **Liang-Barsky parametric line clipping** to cleanly clip segments crossing frame boundaries without stretching or distortion.

5. **Route Styling & Geometry Tools**
   - Physical stroke width slider in exact millimeters (0.5 mm to 8 mm, default 2.0 mm).
   - Route color, opacity, glow halo effect.
   - Start / Finish waypoint markers and directional flow arrows.
   - Ramer-Douglas-Peucker (RDP) polyline simplification slider.
   - Chaikin corner-cutting curve smoothing slider.
   - Revert edits at any time to preserve pristine GPX data.

6. **Dual SVG Export**
   - **Route-Only SVG**: Specially engineered for 3D printing (Cura, Bambu Studio, PrusaSlicer, OrcaSlicer) and CAD/Laser cutting (Blender, Illustrator, FreeCAD, LightBurn). Features:
     - Exact physical millimeter units (`width="119mm" height="243mm" viewBox="0 0 119 243"`).
     - Clean vector paths with `stroke-linecap="round"` and `stroke-linejoin="round"`.
     - Transparent background with zero unnecessary rasterization.
   - **Combined Map Poster SVG**: High-resolution map artwork combined with the vector route overlay for physical print framing.

7. **3D Trail Generator & Slicer Validation (Three.js)**
   - Real-time WebGL 3D preview with OrbitControls, wireframe toggle, and printer bed visualizer.
   - Configurable trail width (default 2 mm), extrusion height (default 7 mm), base plate backing, corner styles, and upper edge beveling (rounded/chamfer/flat).
   - **100% flat underside at $Z = 0$** for flawless 3D print bed adhesion.
   - Watertight mesh generation and instant binary STL export.
   - Live printability checks: wall thickness, disconnected component warnings, and build volume compatibility against Bambu Lab, Prusa, Ender 3, and custom beds.

8. **Project Management**
   - Save and reload projects locally in browser storage.
   - Export project configuration to `.mapcraft` file and re-import anytime.
   - Undo / Redo history stack.

---

## 🚀 Quick Start

### Prerequisites
- Node.js $\ge 18$
- npm or yarn

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Open in browser
# http://localhost:5173
```

### Run Automated Acceptance Verification Suite

To run the verification suite testing GPX parsing, Web Mercator projection alignment, Liang-Barsky boundary clipping, SVG physical dimensions, and 3D STL flat underside:

```bash
npx tsx scripts/verify.ts
```

Output:
```text
====================================================
MAPCRAFT ACCEPTANCE & VERIFICATION TEST SUITE
====================================================

✓ TEST 1: GPX Parsing
  Parsed 1 track(s), name: "TATA Mumbai Marathon 2025 - 42.195 km"
  Extracted 943 valid track points.
  Distance: 42.18 km (Expect ~42.2 km marathon distance)
  Elevation Gain: +151m, Range: 0m to 41m
  -> PASS: GPX parsed with high geographic fidelity.

✓ TEST 2: Geographic Alignment Engine & Physical Millimeter Transform
  Projected segments count: 2
  Inside frame points: 937 / 943
  -> PASS: All projected points are strictly bounded within [0, 119] × [0, 243] mm.

✓ TEST 3: Liang-Barsky Boundary Clipping (No stretching)
  -> PASS: Line clipping correctly trims boundary crossings without distortion.

✓ TEST 4: SVG Export Dimensions & Standards Compliance
  SVG Header: width="119mm" height="243mm" viewBox="0 0 119 243"
  -> PASS: SVG conforms strictly to CAD and 3D printing physical standards.

✓ TEST 5: 3D Trail Mesh Generation & Watertight STL Export
  Mesh Z Extents: min Z = 0.0000 mm, max Z = 7.4000 mm
  ✓ Underside is completely planar at Z = 0.000 mm (perfect 3D printer bed adhesion).
  STL binary buffer size: 1480.6 KB
  -> PASS: Binary STL successfully generated and validated.

====================================================
ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! (5/5)
====================================================
```
