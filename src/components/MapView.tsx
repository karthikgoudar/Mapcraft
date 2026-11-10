import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { 
  MapFrame, 
  LayerStyle, 
  RouteTrack, 
  RouteStyle 
} from '../types';
import { BUILTIN_STYLE_PRESETS, applyCustomLayerStyles, loadUserPresets } from '../utils/mapStyles';
import { 
  Compass, 
  Plus, 
  Minus, 
  Crosshair, 
  Frame,
  Move,
  PanelLeftOpen,
  PanelRightOpen
} from 'lucide-react';

interface MapViewProps {
  currentStyleId: string;
  layerStyles: LayerStyle;
  frame: MapFrame;
  setFrame: React.Dispatch<React.SetStateAction<MapFrame>>;
  isFrameVisible: boolean;
  setIsFrameVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isLeftPanelOpen: boolean;
  setIsLeftPanelOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  tracks: RouteTrack[];
  routeStyle: RouteStyle;
  onMapReady?: (map: maplibregl.Map) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  currentStyleId,
  layerStyles,
  frame,
  setFrame,
  isFrameVisible,
  setIsFrameVisible,
  isLeftPanelOpen,
  setIsLeftPanelOpen,
  isRightPanelOpen,
  setIsRightPanelOpen,
  tracks,
  routeStyle,
  onMapReady
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Stable references for high-frequency event handlers
  const tracksRef = useRef<RouteTrack[]>(tracks);
  tracksRef.current = tracks;
  const routeStyleRef = useRef<RouteStyle>(routeStyle);
  routeStyleRef.current = routeStyle;
  const layerStylesRef = useRef(layerStyles);
  layerStylesRef.current = layerStyles;

  const frameRef = useRef<MapFrame>(frame);
  frameRef.current = frame;
  const screenRectRef = useRef(frame.screenRect);
  screenRectRef.current = frame.screenRect;

  const lastSizeRef = useRef({ width: 0, height: 0 });

  // Frame dragging & resizing state
  const [isDraggingFrame, setIsDraggingFrame] = useState(false);
  const [resizingHandle, setResizingHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialRect: { x: number; y: number; width: number; height: number };
  }>({
    startX: 0,
    startY: 0,
    initialRect: { x: 0, y: 0, width: 0, height: 0 }
  });

  // Calculate and commit live geographic bounds & corners from map + screenRect
  const updateFrameGeographics = useCallback(
    (customRect?: { x: number; y: number; width: number; height: number }) => {
      const map = mapRef.current;
      if (!map || !mapContainerRef.current) return;

      const rect = customRect || screenRectRef.current;
      const { x, y, width, height } = rect;
      if (width <= 0 || height <= 0) return;

      try {
        const nw = map.unproject([x, y]);
        const ne = map.unproject([x + width, y]);
        const se = map.unproject([x + width, y + height]);
        const sw = map.unproject([x, y + height]);
        const center = map.unproject([x + width / 2, y + height / 2]);

        const minLon = Math.min(nw.lng, ne.lng, se.lng, sw.lng);
        const maxLon = Math.max(nw.lng, ne.lng, se.lng, sw.lng);
        const minLat = Math.min(nw.lat, ne.lat, se.lat, sw.lat);
        const maxLat = Math.max(nw.lat, ne.lat, se.lat, sw.lat);

        setFrame((prev) => ({
          ...prev,
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          bounds: { minLon, minLat, maxLon, maxLat },
          corners: {
            nw: [nw.lng, nw.lat],
            ne: [ne.lng, ne.lat],
            se: [se.lng, se.lat],
            sw: [sw.lng, sw.lat]
          }
        }));
      } catch (e) {
        // Safe ignore during map unmount / style transitions
      }
    },
    [setFrame]
  );

  // Helper to attach route & marker layers
  const attachRouteLayers = useCallback((map: maplibregl.Map) => {
    const currentTracks = tracksRef.current;
    const currentRouteStyle = routeStyleRef.current;

    const lineFeatures: any[] = [];
    const markerFeatures: any[] = [];

    currentTracks.forEach((track) => {
      track.segments.forEach((segment) => {
        if (segment.length >= 2) {
          lineFeatures.push({
            type: 'Feature',
            properties: { name: track.name },
            geometry: {
              type: 'LineString',
              coordinates: segment.map((p) => [p.lon, p.lat])
            }
          });
        }
      });

      if (track.segments.length > 0 && track.segments[0].length > 0) {
        const first = track.segments[0][0];
        const lastSeg = track.segments[track.segments.length - 1];
        const last = lastSeg[lastSeg.length - 1];

        if (currentRouteStyle.showStartMarker) {
          markerFeatures.push({
            type: 'Feature',
            properties: { color: currentRouteStyle.startMarkerColor || '#22c55e', type: 'start' },
            geometry: { type: 'Point', coordinates: [first.lon, first.lat] }
          });
        }

        if (currentRouteStyle.showFinishMarker) {
          markerFeatures.push({
            type: 'Feature',
            properties: { color: currentRouteStyle.finishMarkerColor || '#ef4444', type: 'finish' },
            geometry: { type: 'Point', coordinates: [last.lon, last.lat] }
          });
        }
      }
    });

    // 1. Route Source
    if (!map.getSource('gpx-route-source')) {
      map.addSource('gpx-route-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: lineFeatures }
      });
    } else {
      (map.getSource('gpx-route-source') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: lineFeatures
      });
    }

    // 2. Glow Layer
    if (!map.getLayer('gpx-route-glow')) {
      map.addLayer({
        id: 'gpx-route-glow',
        type: 'line',
        source: 'gpx-route-source',
        paint: {
          'line-color': currentRouteStyle.glowColor || '#ea580c',
          'line-width': 8,
          'line-opacity': currentRouteStyle.glow ? 0.4 : 0,
          'line-blur': 4
        }
      });
    }

    // 3. Line Layer
    if (!map.getLayer('gpx-route-line')) {
      map.addLayer({
        id: 'gpx-route-line',
        type: 'line',
        source: 'gpx-route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': currentRouteStyle.color,
          'line-width': 4,
          'line-opacity': currentRouteStyle.opacity
        }
      });
    }

    // 4. Markers Source & Layer
    if (!map.getSource('gpx-markers-source')) {
      map.addSource('gpx-markers-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: markerFeatures }
      });
    } else {
      (map.getSource('gpx-markers-source') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: markerFeatures
      });
    }

    if (!map.getLayer('gpx-markers-circle')) {
      map.addLayer({
        id: 'gpx-markers-circle',
        type: 'circle',
        source: 'gpx-markers-source',
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  }, []);

  // INITIALIZE MAPLIBRE ONCE ON MOUNT
  // preserveDrawingBuffer: true is CRITICAL so WebGL buffer is NOT wiped to black on canvas export!
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const allPresets = [...BUILTIN_STYLE_PRESETS, ...loadUserPresets()];
    const preset = allPresets.find((p) => p.id === currentStyleId) || BUILTIN_STYLE_PRESETS[0];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: preset.styleUrlOrSpec as any,
      center: frame.center,
      zoom: frame.zoom,
      bearing: frame.bearing,
      pitch: frame.pitch,
      preserveDrawingBuffer: true,
      attributionControl: { compact: true }
    });

    mapRef.current = map;

    map.on('load', () => {
      setIsMapLoaded(true);
      if (onMapReady) onMapReady(map);
      attachRouteLayers(map);
      updateFrameGeographics();
    });

    // Safety net: whenever the style changes and the GPX overlay is missing, put it back.
    map.on('styledata', () => {
      if (tracksRef.current.length === 0) return;
      try {
        if (!map.getLayer('gpx-route-line') || !map.getSource('gpx-route-source')) {
          attachRouteLayers(map);
        }
      } catch (e) {
        // Style mid-transition; the next styledata event retries
      }
    });

    // Throttled live update during map pan to guarantee 60 FPS
    let moveAnimFrame: number | null = null;
    map.on('move', () => {
      if (!moveAnimFrame) {
        moveAnimFrame = window.requestAnimationFrame(() => {
          updateFrameGeographics();
          moveAnimFrame = null;
        });
      }
    });

    map.on('moveend', () => {
      if (moveAnimFrame) {
        window.cancelAnimationFrame(moveAnimFrame);
        moveAnimFrame = null;
      }
      updateFrameGeographics();
    });

    return () => {
      if (moveAnimFrame) window.cancelAnimationFrame(moveAnimFrame);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ResizeObserver: handles sidebar collapse/expansion without infinite loops
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let resizeTimer: any = null;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;

        // Prevent infinite loops if element size hasn't changed
        if (width === lastSizeRef.current.width && height === lastSizeRef.current.height) {
          continue;
        }

        const isInitial = lastSizeRef.current.width === 0;
        lastSizeRef.current = { width, height };
        setContainerSize({ width, height });

        if (mapRef.current) {
          mapRef.current.resize();
        }

        const currentFrame = frameRef.current;
        const targetAspect = currentFrame.widthMm / currentFrame.heightMm;
        let rectW = currentFrame.screenRect.width;
        let rectH = currentFrame.screenRect.height;

        if (rectW <= 0 || rectH <= 0 || isInitial) {
          const visibleHeight = Math.max(100, height - 48);
          const maxW = width * 0.72;
          const maxH = visibleHeight * 0.72;
          if (maxW / targetAspect <= maxH) {
            rectW = maxW;
            rectH = maxW / targetAspect;
          } else {
            rectH = maxH;
            rectW = maxH * targetAspect;
          }
          const rectX = Math.round((width - rectW) / 2);
          const rectY = Math.round((visibleHeight - rectH) / 2);

          const newRect = {
            x: rectX,
            y: rectY,
            width: Math.round(rectW),
            height: Math.round(rectH)
          };
          screenRectRef.current = newRect;

          setFrame((prev) => ({
            ...prev,
            screenRect: newRect
          }));

          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            updateFrameGeographics(newRect);
          }, 60);
        } else {
          // Clamp inside bounds if sidebar toggled
          const visibleHeight = Math.max(100, height - 48);
          const clampedX = Math.max(10, Math.min(width - rectW - 10, currentFrame.screenRect.x));
          const clampedY = Math.max(10, Math.min(visibleHeight - rectH - 10, currentFrame.screenRect.y));
          if (clampedX !== currentFrame.screenRect.x || clampedY !== currentFrame.screenRect.y) {
            const newRect = {
              ...currentFrame.screenRect,
              x: clampedX,
              y: clampedY
            };
            screenRectRef.current = newRect;
            setFrame((prev) => ({
              ...prev,
              screenRect: newRect
            }));
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
              updateFrameGeographics(newRect);
            }, 60);
          }
        }
      }
    });

    observer.observe(mapContainerRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(resizeTimer);
    };
  }, [setFrame, updateFrameGeographics]);

  // UPDATE MAP STYLE SEAMLESSLY
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const allPresets = [...BUILTIN_STYLE_PRESETS, ...loadUserPresets()];
    const preset = allPresets.find((p) => p.id === currentStyleId) || BUILTIN_STYLE_PRESETS[0];

    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();

    // Carry the GPX overlay (sources + layers) into the new style so it never disappears,
    // whether MapLibre diffs the styles or loads the new one from scratch.
    const OVERLAY_SOURCES = ['gpx-route-source', 'gpx-markers-source'];
    map.setStyle(preset.styleUrlOrSpec as any, {
      transformStyle: (previous: any, next: any) => {
        if (!previous) return next;
        const sources = { ...next.sources };
        OVERLAY_SOURCES.forEach((sid) => {
          if (previous.sources?.[sid]) sources[sid] = previous.sources[sid];
        });
        const overlay = (previous.layers || []).filter((l: any) => OVERLAY_SOURCES.includes(l.source));
        const baseLayers = (next.layers || []).filter((l: any) => !OVERLAY_SOURCES.includes(l.source));
        return { ...next, sources, layers: [...baseLayers, ...overlay] };
      }
    } as any);

    // 'style.load' does not fire when MapLibre diffs two styles, so finish on the first
    // styledata event where the new style is usable.
    let finished = false;
    const finish = () => {
      if (finished) return;
      if (!map.isStyleLoaded()) return;
      finished = true;
      map.off('styledata', finish);
      map.jumpTo({ center, zoom, bearing, pitch });
      try {
        applyCustomLayerStyles(map, layerStylesRef.current);
      } catch (e) {
        console.warn('Layer styling skipped:', e);
      }
      attachRouteLayers(map);
      updateFrameGeographics();
    };
    map.on('styledata', finish);
    map.once('idle', finish);
    return () => {
      map.off('styledata', finish);
    };
  }, [currentStyleId]);

  // Apply custom layer styles dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (map && isMapLoaded) {
      applyCustomLayerStyles(map, layerStyles);
    }
  }, [layerStyles, isMapLoaded]);

  // Synchronize GPX tracks & markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    attachRouteLayers(map);
  }, [tracks, routeStyle.showStartMarker, routeStyle.showFinishMarker, routeStyle.startMarkerColor, routeStyle.finishMarkerColor, isMapLoaded, attachRouteLayers]);

  // Update Route Visual Paint Properties
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (map.getLayer('gpx-route-line')) {
      map.setPaintProperty('gpx-route-line', 'line-color', routeStyle.color);
      map.setPaintProperty('gpx-route-line', 'line-opacity', routeStyle.opacity);
    }

    if (map.getLayer('gpx-route-glow')) {
      map.setPaintProperty('gpx-route-glow', 'line-color', routeStyle.glowColor || '#ea580c');
      map.setPaintProperty('gpx-route-glow', 'line-opacity', routeStyle.glow ? 0.4 : 0);
    }
  }, [routeStyle.color, routeStyle.opacity, routeStyle.glow, routeStyle.glowColor, isMapLoaded]);

  // Sync aspect ratio when frame.widthMm / heightMm changes from input
  useEffect(() => {
    if (frame.screenRect.width === 0) return;
    const currentW = frame.screenRect.width;
    const targetAspect = frame.widthMm / frame.heightMm;
    const newH = Math.round(currentW / targetAspect);

    if (Math.abs(newH - frame.screenRect.height) > 1) {
      const updatedRect = {
        ...frame.screenRect,
        height: newH
      };
      screenRectRef.current = updatedRect;
      setFrame((prev) => ({
        ...prev,
        screenRect: updatedRect
      }));
      updateFrameGeographics(updatedRect);
    }
  }, [frame.widthMm, frame.heightMm]);

  // Handlers for frame dragging & resizing
  const onFrameMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingFrame(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialRect: { ...screenRectRef.current }
    };
  };

  const onHandleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResizingHandle(handle);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialRect: { ...screenRectRef.current }
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingFrame) {
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;
        const init = dragStartRef.current.initialRect;

        const maxW = containerSize.width || window.innerWidth;
        const maxH = (containerSize.height || window.innerHeight) - 48;

        const newX = Math.max(10, Math.min(maxW - init.width - 10, init.x + dx));
        const newY = Math.max(10, Math.min(maxH - init.height - 10, init.y + dy));

        const updatedRect = {
          ...screenRectRef.current,
          x: Math.round(newX),
          y: Math.round(newY)
        };
        screenRectRef.current = updatedRect;

        setFrame((prev) => ({
          ...prev,
          screenRect: updatedRect
        }));
      } else if (resizingHandle) {
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;
        const init = dragStartRef.current.initialRect;
        const targetAspect = frame.widthMm / frame.heightMm;

        let newW = init.width;
        let newH = init.height;
        let newX = init.x;
        let newY = init.y;

        if (resizingHandle === 'se') {
          newW = Math.max(80, init.width + dx);
          newH = frame.aspectLocked ? newW / targetAspect : Math.max(80, init.height + dy);
        } else if (resizingHandle === 'nw') {
          newW = Math.max(80, init.width - dx);
          newH = frame.aspectLocked ? newW / targetAspect : Math.max(80, init.height - dy);
          newX = init.x + (init.width - newW);
          newY = init.y + (init.height - newH);
        } else if (resizingHandle === 'ne') {
          newW = Math.max(80, init.width + dx);
          newH = frame.aspectLocked ? newW / targetAspect : Math.max(80, init.height - dy);
          newY = init.y + (init.height - newH);
        } else if (resizingHandle === 'sw') {
          newW = Math.max(80, init.width - dx);
          newH = frame.aspectLocked ? newW / targetAspect : Math.max(80, init.height + dy);
          newX = init.x + (init.width - newW);
        }

        const updatedRect = {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH)
        };
        screenRectRef.current = updatedRect;

        setFrame((prev) => ({
          ...prev,
          screenRect: updatedRect
        }));
      }
    };

    const onMouseUp = () => {
      if (isDraggingFrame || resizingHandle) {
        setIsDraggingFrame(false);
        setResizingHandle(null);
        // Commit permanent geographic coordinates on release
        updateFrameGeographics(screenRectRef.current);
      }
    };

    if (isDraggingFrame || resizingHandle) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingFrame, resizingHandle, containerSize, frame.aspectLocked, frame.widthMm, frame.heightMm, updateFrameGeographics, setFrame]);

  const { x, y, width, height } = frame.screenRect;

  return (
    <div className="relative flex-1 h-[calc(100vh-3.5rem)] bg-slate-950 overflow-hidden select-none">
      {/* MapLibre WebGL Canvas Container (Always interactive: pan, drag, zoom) */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Floating Left Panel Re-open Pill */}
      {!isLeftPanelOpen && (
        <button
          onClick={() => setIsLeftPanelOpen(true)}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-xl backdrop-blur-md text-xs font-medium transition"
          title="Open Map Controls & Styles"
        >
          <PanelLeftOpen className="w-4 h-4 text-emerald-400" />
          <span>Styles & Frame</span>
        </button>
      )}

      {/* Floating Right Panel Re-open Pill */}
      {!isRightPanelOpen && (
        <button
          onClick={() => setIsRightPanelOpen(true)}
          className="absolute top-4 right-16 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-xl backdrop-blur-md text-xs font-medium transition"
          title="Open Stats & Exports"
        >
          <PanelRightOpen className="w-4 h-4 text-emerald-400" />
          <span>Stats & Exports</span>
        </button>
      )}

      {/* Dimmer Overlay outside the Frame (pointer-events-none so map pan works everywhere) */}
      {isFrameVisible && width > 0 && height > 0 && (
        <div className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200">
          <svg className="w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id="frame-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect x={x} y={y} width={width} height={height} rx="2" fill="black" />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(15, 23, 42, 0.45)"
              mask="url(#frame-mask)"
            />
          </svg>
        </div>
      )}

      {/* Interactive Physical Frame Overlay:
          Crucial: pointer-events-none on root container allows map clicks & dragging inside the frame!
          Only the 'Move Frame' handle, borders, and corner resize squares capture pointer events. */}
      {isFrameVisible && width > 0 && height > 0 && (
        <div
          style={{
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`
          }}
          className={`absolute z-10 pointer-events-none border-2 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.25)] transition-colors ${
            isDraggingFrame ? 'border-emerald-400 bg-emerald-500/5' : 'hover:border-emerald-400'
          }`}
        >
          {/* Unified Floating Top Control Pill (Move Frame + Physical mm - zero overlap) */}
          <div
            onMouseDown={onFrameMouseDown}
            className="pointer-events-auto absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-emerald-500/80 text-emerald-300 text-xs font-semibold cursor-grab active:cursor-grabbing shadow-2xl hover:bg-slate-800 hover:border-emerald-400 transition select-none z-20 whitespace-nowrap"
            title="Click and drag to reposition print frame"
          >
            <Move className="w-3.5 h-3.5 text-emerald-400" />
            <span>Move Frame</span>
            <span className="text-slate-600 font-normal">|</span>
            <span className="font-mono text-white text-[11px] font-bold">
              {frame.widthMm} × {frame.heightMm} {frame.unit}
            </span>
          </div>

          {/* Interactive Edge Drag Borders (allows moving frame by grabbing edges) */}
          <div
            onMouseDown={onFrameMouseDown}
            className="pointer-events-auto absolute -top-1 left-4 right-4 h-3 cursor-move z-10"
            title="Drag border to move frame"
          />
          <div
            onMouseDown={onFrameMouseDown}
            className="pointer-events-auto absolute -bottom-1 left-4 right-4 h-3 cursor-move z-10"
            title="Drag border to move frame"
          />
          <div
            onMouseDown={onFrameMouseDown}
            className="pointer-events-auto absolute top-4 bottom-4 -left-1 w-3 cursor-move z-10"
            title="Drag border to move frame"
          />
          <div
            onMouseDown={onFrameMouseDown}
            className="pointer-events-auto absolute top-4 bottom-4 -right-1 w-3 cursor-move z-10"
            title="Drag border to move frame"
          />

          {/* Subtle Frame Focus Center Dot (Minimal, unobtrusive) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>

          {/* Corner Resize Handles */}
          <div
            data-handle="nw"
            onMouseDown={(e) => onHandleMouseDown('nw', e)}
            className="pointer-events-auto absolute -top-2.5 -left-2.5 w-5 h-5 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-20"
            title="Resize frame"
          />
          <div
            data-handle="ne"
            onMouseDown={(e) => onHandleMouseDown('ne', e)}
            className="pointer-events-auto absolute -top-2.5 -right-2.5 w-5 h-5 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform z-20"
            title="Resize frame"
          />
          <div
            data-handle="se"
            onMouseDown={(e) => onHandleMouseDown('se', e)}
            className="pointer-events-auto absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-20"
            title="Resize frame"
          />
          <div
            data-handle="sw"
            onMouseDown={(e) => onHandleMouseDown('sw', e)}
            className="pointer-events-auto absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform z-20"
            title="Resize frame"
          />
        </div>
      )}

      {/* Floating Map Zoom / Compass Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-xl backdrop-blur-md">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-800 my-0.5" />
        <button
          onClick={() => mapRef.current?.resetNorthPitch()}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Reset North & Pitch"
        >
          <Compass className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-800 my-0.5" />
        <button
          onClick={() => setIsFrameVisible((v) => !v)}
          className={`p-2 rounded-lg transition ${
            isFrameVisible ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          }`}
          title={isFrameVisible ? 'Hide Print Frame' : 'Show Print Frame'}
        >
          <Frame className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
