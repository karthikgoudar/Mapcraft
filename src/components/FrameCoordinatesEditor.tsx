import React, { useEffect, useState } from 'react';
import { Crosshair, RotateCcw } from 'lucide-react';
import { MapFrame } from '../types';

export interface FrameEdges {
  north: number;
  south: number;
  west: number;
  east: number;
}

interface Props {
  frame: MapFrame;
  onPlaceByEdges: (edges: FrameEdges) => void;
  onPlaceByCenter: (lat: number, lon: number) => void;
}

type EdgeKey = 'north' | 'south' | 'west' | 'east' | 'cLat' | 'cLon';
type Draft = Record<EdgeKey, string>;

const DP = 5; // ~1 m precision

/** Frame is an axis-aligned rectangle, so 4 corners collapse to 4 edges. */
const draftFromFrame = (f: MapFrame): Draft => ({
  north: f.corners.nw[1].toFixed(DP),
  south: f.corners.sw[1].toFixed(DP),
  west: f.corners.nw[0].toFixed(DP),
  east: f.corners.ne[0].toFixed(DP),
  cLat: f.center[1].toFixed(DP),
  cLon: f.center[0].toFixed(DP)
});

const CORNERS: { label: string; lat: EdgeKey; lon: EdgeKey }[] = [
  { label: 'NW Corner', lat: 'north', lon: 'west' },
  { label: 'NE Corner', lat: 'north', lon: 'east' },
  { label: 'SW Corner', lat: 'south', lon: 'west' },
  { label: 'SE Corner', lat: 'south', lon: 'east' }
];

export const FrameCoordinatesEditor: React.FC<Props> = ({ frame, onPlaceByEdges, onPlaceByCenter }) => {
  const [draft, setDraft] = useState<Draft>(() => draftFromFrame(frame));
  const [dirty, setDirty] = useState<'none' | 'corners' | 'center'>('none');
  const [error, setError] = useState<string | null>(null);

  // Follow the live frame while the user is not editing
  useEffect(() => {
    if (dirty === 'none') setDraft(draftFromFrame(frame));
  }, [frame.corners, frame.center, dirty]);

  const rotated = Math.abs(frame.bearing) > 0.01 || Math.abs(frame.pitch) > 0.01;

  const setField = (key: EdgeKey, value: string, latKey?: EdgeKey, lonKey?: EdgeKey) => {
    // Paste "lat, lon" into either box of a pair to fill both
    const pair = value.split(/[,\s]+/).filter(Boolean);
    if (latKey && lonKey && pair.length === 2 && pair.every((p) => !isNaN(parseFloat(p)))) {
      setDraft((d) => ({ ...d, [latKey]: pair[0], [lonKey]: pair[1] }));
    } else {
      setDraft((d) => ({ ...d, [key]: value }));
    }
    setDirty(key === 'cLat' || key === 'cLon' ? 'center' : 'corners');
    setError(null);
  };

  const apply = () => {
    if (dirty === 'center') {
      const lat = parseFloat(draft.cLat);
      const lon = parseFloat(draft.cLon);
      if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
        setError('Centre needs lat between -85 and 85, lon between -180 and 180');
        return;
      }
      onPlaceByCenter(lat, lon);
    } else if (dirty === 'corners') {
      const e = {
        north: parseFloat(draft.north),
        south: parseFloat(draft.south),
        west: parseFloat(draft.west),
        east: parseFloat(draft.east)
      };
      if (Object.values(e).some(isNaN)) return setError('Every corner needs a number');
      if (e.north <= e.south) return setError('North latitude must be greater than south');
      if (e.east <= e.west) return setError('East longitude must be greater than west');
      if (Math.abs(e.north) > 85 || Math.abs(e.south) > 85) return setError('Latitude must be between -85 and 85');
      if (Math.abs(e.west) > 180 || Math.abs(e.east) > 180) return setError('Longitude must be between -180 and 180');
      onPlaceByEdges(e);
    }
    setDirty('none');
    setError(null);
  };

  const revert = () => {
    setDirty('none');
    setError(null);
    setDraft(draftFromFrame(frame));
  };

  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Enter') apply();
    if (ev.key === 'Escape') revert();
  };

  const inputCls = (active: boolean) =>
    `w-full min-w-0 bg-slate-900 border rounded px-1 py-0.5 text-[9px] font-mono text-slate-200 outline-none focus:border-emerald-500 ${
      active ? 'border-amber-500/70' : 'border-slate-700/70'
    }`;

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-800/60">
      <div className="text-[10px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between gap-2">
        <span>Geographic Coordinates</span>
        <div className="flex items-center gap-0.5 font-mono text-[9px]">
          <span className="text-slate-500">C</span>
          <input
            value={draft.cLat}
            onChange={(e) => setField('cLat', e.target.value, 'cLat', 'cLon')}
            onKeyDown={onKey}
            className={`${inputCls(dirty === 'center')} w-[62px] text-emerald-400`}
            title="Centre latitude"
          />
          <input
            value={draft.cLon}
            onChange={(e) => setField('cLon', e.target.value, 'cLat', 'cLon')}
            onKeyDown={onKey}
            className={`${inputCls(dirty === 'center')} w-[62px] text-emerald-400`}
            title="Centre longitude"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-[9px] font-mono">
        {CORNERS.map((c) => (
          <div key={c.label}>
            <span className="text-slate-500 block mb-0.5">{c.label}</span>
            <div className="flex gap-1">
              <input
                value={draft[c.lat]}
                onChange={(e) => setField(c.lat, e.target.value, c.lat, c.lon)}
                onKeyDown={onKey}
                className={inputCls(dirty === 'corners')}
                title="Latitude"
                placeholder="lat"
              />
              <input
                value={draft[c.lon]}
                onChange={(e) => setField(c.lon, e.target.value, c.lat, c.lon)}
                onKeyDown={onKey}
                className={inputCls(dirty === 'corners')}
                title="Longitude"
                placeholder="lon"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-slate-500 mt-1 leading-snug">
        Lat, lon in decimal degrees. Corners share edges, so NW/NE share a latitude and NW/SW share a longitude.
        Paste "lat, lon" into either box to fill both.
      </p>
      {rotated && (
        <p className="text-[9px] text-amber-400 mt-0.5">Map is rotated or tilted; placing will reset it to north-up.</p>
      )}
      {error && <p className="text-[9px] text-red-400 mt-0.5">{error}</p>}

      {dirty !== 'none' && (
        <div className="flex gap-1.5 mt-1.5">
          <button
            onClick={apply}
            className="flex-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-[10px] flex items-center justify-center gap-1"
          >
            <Crosshair className="w-3 h-3" />
            {dirty === 'center' ? 'Move Frame to Centre' : 'Place Frame on Corners'}
          </button>
          <button
            onClick={revert}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1"
            title="Discard edits (Esc)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
