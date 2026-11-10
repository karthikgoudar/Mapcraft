import React, { useState } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Maximize2, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle, 
  Download, 
  Box, 
  Globe2, 
  Mountain,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Loader2
} from 'lucide-react';
import { RouteStats, MapFrame, RouteStyle, PrintabilityReport } from '../types';

interface RightSidebarProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  stats: RouteStats | null;
  frame: MapFrame;
  routeStyle: RouteStyle;
  printReport: PrintabilityReport | null;
  insidePercent: number;
  onExportRouteSVG: () => void;
  onExportMapOnlyPoster: (dpi: number) => void;
  onExportCombinedPoster: (dpi: number) => void;
  onOpen3D: () => void;
  hasRoute: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onToggleOpen,
  stats,
  frame,
  routeStyle,
  printReport,
  insidePercent,
  onExportRouteSVG,
  onExportMapOnlyPoster,
  onExportCombinedPoster,
  onOpen3D,
  hasRoute
}) => {
  const [selectedDpi, setSelectedDpi] = useState<number>(300);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  if (!isOpen) return null;

  const isClipped = insidePercent < 99;

  const handleExportMap = async () => {
    setIsExporting('map');
    try {
      await onExportMapOnlyPoster(selectedDpi);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportCombined = async () => {
    setIsExporting('combined');
    try {
      await onExportCombinedPoster(selectedDpi);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-[calc(100vh-3.5rem)] select-none overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar text-xs z-20 pb-32">
      {/* 1. Geographic Alignment Status */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
            Alignment Status
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Geo-Synced
          </span>
        </div>

        <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Projection Engine</span>
            <span className="font-mono text-slate-200 font-semibold">Web Mercator (EPSG:3857)</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Route In Frame</span>
            <span
              className={`font-mono font-semibold flex items-center gap-1 ${
                isClipped ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {isClipped ? (
                <AlertTriangle className="w-3 h-3 text-amber-400" />
              ) : (
                <CheckCircle className="w-3 h-3 text-emerald-400" />
              )}
              {insidePercent.toFixed(0)}% visible
            </span>
          </div>

          {/* Progress bar of points in frame */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isClipped ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, insidePercent))}%` }}
            />
          </div>

          {isClipped && (
            <div className="text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 leading-relaxed">
              Route extends outside the print frame. The SVG & 3D generator will cleanly clip boundary edges using Liang-Barsky line clipping.
            </div>
          )}
        </div>
      </div>

      {/* 2. Route Statistics */}
      {stats && (
        <div className="p-3">
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Route Statistics
          </span>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-slate-800/60 rounded-lg p-2 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block mb-0.5">Total Distance</span>
              <span className="text-base font-extrabold text-white font-mono">
                {stats.totalDistanceKm} <span className="text-xs font-normal text-slate-400">km</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {(stats.totalDistanceKm * 0.621371).toFixed(1)} miles
              </span>
            </div>

            <div className="bg-slate-800/60 rounded-lg p-2 border border-slate-700/60">
              <span className="text-[10px] text-slate-400 block mb-0.5">GPS Points</span>
              <span className="text-base font-extrabold text-white font-mono">
                {stats.pointsCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {stats.segmentsCount} {stats.segmentsCount === 1 ? 'segment' : 'segments'}
              </span>
            </div>
          </div>

          {/* Elevation details */}
          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                Elevation Gain
              </span>
              <span className="font-mono text-emerald-400 font-semibold">+{stats.elevationGainM} m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Mountain className="w-3 h-3 text-cyan-400" />
                Elevation Range
              </span>
              <span className="font-mono text-slate-200">
                {stats.minElevationM}m – {stats.maxElevationM}m
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Frame Measurements */}
      <div className="p-3">
        <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5 mb-2">
          <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          Physical Frame Dimensions
        </span>

        <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Target Size</span>
            <span className="font-mono font-bold text-white">
              {frame.widthMm} × {frame.heightMm} mm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Metric (cm)</span>
            <span className="font-mono text-slate-300">
              {(frame.widthMm / 10).toFixed(1)} × {(frame.heightMm / 10).toFixed(1)} cm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Native Pixels</span>
            <span className="font-mono text-cyan-400 font-semibold">
              {Math.round((frame.widthMm / 25.4) * selectedDpi)} × {Math.round((frame.heightMm / 25.4) * selectedDpi)} px
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Aspect Ratio</span>
            <span className="font-mono text-slate-300">
              1 : {(frame.heightMm / frame.widthMm).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. High-Resolution Poster & Separate Exports (#3 & #9) */}
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            High-Res Print Exports
          </span>
          {/* DPI selector for print crispness */}
          <div className="flex items-center gap-1 bg-slate-950 rounded p-0.5 border border-slate-800">
            {[150, 300, 600].map((dpi) => (
              <button
                key={dpi}
                onClick={() => setSelectedDpi(dpi)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                  selectedDpi === dpi ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {dpi} DPI
              </button>
            ))}
          </div>
        </div>

        {/* Action A: Map-Only Poster (clean background for Canva) */}
        <div>
          <button
            onClick={handleExportMap}
            disabled={isExporting !== null}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white font-semibold flex items-center justify-between transition shadow-sm group disabled:opacity-60"
            title="Export unblurred high-res 300 DPI vector map artwork cropped to frame (without route) for Canva"
          >
            <div className="flex items-center gap-2">
              {isExporting === 'map' ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <div className="text-xs">
                  {isExporting === 'map' ? 'Rendering Vector Tiles...' : 'Map-Only Poster'}
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  {isExporting === 'map' ? `Generating ${selectedDpi} DPI image` : `Clean background for Canva (${selectedDpi} DPI)`}
                </div>
              </div>
            </div>
            {isExporting === 'map' ? (
              <span className="text-[10px] text-cyan-400 font-mono animate-pulse">Rendering</span>
            ) : (
              <Download className="w-4 h-4 text-slate-400 group-hover:text-white" />
            )}
          </button>
          <div className="mt-1 px-1 text-[10px] text-slate-400 leading-tight">
            💡 <span className="text-slate-300 font-medium">Canva Placement:</span> Drag the bottom-right corner in Canva to snap to your guidelines. Full {selectedDpi} DPI vector sharpness is preserved.
          </div>
        </div>

        {/* Action B: Route-Only Vector SVG (for 3D Print, Blender, or CAD) */}
        <button
          onClick={onExportRouteSVG}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold flex items-center justify-between transition shadow-lg shadow-emerald-500/20 group"
          title="Export vector route on transparent background (exact mm) for Blender & 3D printing"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <div className="text-xs">Trail-Only Vector (SVG)</div>
              <div className="text-[10px] text-emerald-100 font-normal">Transparent physical mm for Blender / 3D</div>
            </div>
          </div>
          <Download className="w-4 h-4 text-white" />
        </button>

        {/* Action C: Combined Poster */}
        <button
          onClick={handleExportCombined}
          disabled={isExporting !== null}
          className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium flex items-center justify-between transition text-xs disabled:opacity-60"
        >
          <div className="flex items-center gap-2">
            {isExporting === 'combined' ? (
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            ) : null}
            <div className="text-left">
              <div>{isExporting === 'combined' ? 'Rendering High-Res Poster...' : 'Combined Poster PNG'}</div>
              <div className="text-[10px] text-slate-400">Map artwork + Route overlay ({selectedDpi} DPI)</div>
            </div>
          </div>
          {isExporting === 'combined' ? (
            <span className="text-[10px] text-emerald-400 font-mono animate-pulse">Rendering</span>
          ) : (
            <Download className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {/* Action D: 3D Trail Generator Modal Trigger */}
        {hasRoute && (
          <button
            onClick={onOpen3D}
            className="w-full py-2 px-3 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/40 text-indigo-300 font-medium flex items-center justify-between transition text-xs"
          >
            <div className="flex items-center gap-1.5">
              <Box className="w-4 h-4 text-indigo-400" />
              <span>3D Trail Mesh Preview (STL)</span>
            </div>
            <span className="text-[10px] font-mono bg-indigo-500/20 px-1.5 py-0.5 rounded">3D</span>
          </button>
        )}
      </div>
    </aside>
  );
};
