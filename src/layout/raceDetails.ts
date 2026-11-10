/** Race details typed into the Layout Studio, plus the maths that turns them into poster text. */

export type DistancePreset = 'marathon' | 'half' | '10k' | '5k' | 'custom';
export type Unit = 'km' | 'mi';

export interface RaceDetails {
  raceName: string;
  city: string; // "City" or "City, State"
  athleteName: string;
  bib: string;
  date: string; // yyyy-mm from <input type="month">, '' if unset
  finishTime: string; // h:mm:ss or mm:ss as typed
  distancePreset: DistancePreset;
  customDistance: string; // number in distanceUnit when preset is custom
  distanceUnit: Unit;
  paceUnit: Unit;
  paceManual: boolean;
  paceText: string; // used when paceManual, e.g. "5:13"
  raceNameAsTitle: boolean; // only matters when both race name and city are filled
  nameLabel: 'runner' | 'athlete' | 'custom'; // label above the athlete's name (A4 designs)
  nameLabelCustom: string;
}

export const DEFAULT_RACE_DETAILS: RaceDetails = {
  raceName: 'Tata Mumbai Marathon',
  city: 'Mumbai',
  athleteName: 'Your Name',
  bib: '12345',
  date: '2026-02',
  finishTime: '3:40:18',
  distancePreset: 'marathon',
  customDistance: '',
  distanceUnit: 'km',
  paceUnit: 'km',
  paceManual: false,
  paceText: '',
  raceNameAsTitle: false,
  nameLabel: 'runner',
  nameLabelCustom: ''
};

/** Label printed above the athlete's name. */
export function nameLabelText(d: RaceDetails): string {
  if (d.nameLabel === 'athlete') return 'Athlete';
  if (d.nameLabel === 'custom') return d.nameLabelCustom.trim();
  return 'Runner';
}

const KM_PER_MI = 1.609344;

export const DISTANCE_PRESETS: { id: DistancePreset; label: string; km: number }[] = [
  { id: 'marathon', label: 'Marathon (42.195 km)', km: 42.195 },
  { id: 'half', label: 'Half Marathon (21.0975 km)', km: 21.0975 },
  { id: '10k', label: '10K', km: 10 },
  { id: '5k', label: '5K', km: 5 },
  { id: 'custom', label: 'Custom', km: 0 }
];

/** Conventional display values, so a marathon reads 42.195 km / 26.2 mi rather than 26.219 mi. */
const PRESET_DISPLAY: Record<Exclude<DistancePreset, 'custom'>, { km: string; mi: string }> = {
  marathon: { km: '42.195', mi: '26.2' },
  half: { km: '21.1', mi: '13.1' },
  '10k': { km: '10', mi: '6.2' },
  '5k': { km: '5', mi: '3.1' }
};

/** Race distance in km, or null when a custom distance is missing/invalid. */
export function distanceKm(d: RaceDetails): number | null {
  if (d.distancePreset !== 'custom') return DISTANCE_PRESETS.find((p) => p.id === d.distancePreset)!.km;
  const v = parseFloat(d.customDistance);
  if (!isFinite(v) || v <= 0) return null;
  return d.distanceUnit === 'mi' ? v * KM_PER_MI : v;
}

const trimNum = (n: number, dp: number) => String(Number(n.toFixed(dp)));

/** Distance number as printed, before the unit. maxDp limits decimals (tall poster uses 1). */
export function distanceNumber(d: RaceDetails, maxDp = 3): string {
  if (d.distancePreset !== 'custom') {
    const s = PRESET_DISPLAY[d.distancePreset][d.distanceUnit];
    return trimNum(parseFloat(s), maxDp);
  }
  const v = parseFloat(d.customDistance);
  return isFinite(v) && v > 0 ? trimNum(v, Math.min(2, maxDp)) : '';
}

/** Parses "3:40:18", "03:40:18" or "45:12" into seconds. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

/** Finish time as printed. padHours: "03:40:18" (A4) vs "3:40:18" (tall). Unparseable text is shown as typed. */
export function formatFinishTime(text: string, padHours: boolean): string {
  const secs = parseDuration(text);
  if (secs === null) return text.trim();
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const p2 = (n: number) => String(n).padStart(2, '0');
  if (h === 0 && !padHours) return `${m}:${p2(s)}`;
  return `${padHours ? p2(h) : h}:${p2(m)}:${p2(s)}`;
}

/** Auto pace "m:ss" per paceUnit, or null if time or distance is missing. */
export function autoPace(d: RaceDetails): string | null {
  const secs = parseDuration(d.finishTime);
  const km = distanceKm(d);
  if (secs === null || km === null) return null;
  const perUnit = d.paceUnit === 'mi' ? secs / (km / KM_PER_MI) : secs / km;
  let total = Math.round(perUnit);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Pace number as printed, before the unit ("5:13"). */
export function paceNumber(d: RaceDetails): string {
  if (d.paceManual) return d.paceText.trim();
  return autoPace(d) ?? '';
}

/** "Feb 2026" or "FEBRUARY 2026" style date from yyyy-mm. */
export function formatDate(yyyymm: string, style: 'short' | 'long'): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyymm);
  if (!m) return '';
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return dt.toLocaleString('en-GB', { month: style === 'short' ? 'short' : 'long', year: 'numeric' });
}

/**
 * Title rule:
 * - only one of race name / city filled: that one is the title
 * - both filled: city is the title unless "race name as title" is ticked
 * The other one becomes the subtitle.
 */
export function resolveTitle(d: RaceDetails): { title: string; subtitle: string } {
  const race = d.raceName.trim();
  const city = d.city.trim();
  if (race && !city) return { title: race, subtitle: '' };
  if (city && !race) return { title: city, subtitle: '' };
  if (!race && !city) return { title: '', subtitle: '' };
  return d.raceNameAsTitle ? { title: race, subtitle: city } : { title: city, subtitle: race };
}
