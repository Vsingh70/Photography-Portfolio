/**
 * Lens-aware exposure helpers for the Studio's structured Settings editor.
 *
 * Pure browser/Node utilities — no React. Two jobs:
 *   1. Parse a lens label into physical guardrails (`parseLensSpec`) so the
 *      Settings editor can lock/clamp focal length and floor the aperture.
 *   2. Compose / parse the `exif.settings` string the public site renders, in
 *      the canonical "50mm · f/4 · 1/200 · ISO 500" shape.
 *
 * The four exposure fields are kept as plain strings (matching what each
 * dropdown / numeric input emits) so the editor stays trivially controlled and
 * the compose step just joins the non-blank ones with " · ".
 */

/** Physical guardrails distilled from a lens label. */
export interface LensSpec {
  /** Shortest focal length in mm (== focalMax for a prime). */
  focalMin: number;
  /** Longest focal length in mm (== focalMin for a prime). */
  focalMax: number;
  /** Widest (smallest) f-number the lens opens to — the aperture floor. */
  maxApertureN: number;
}

/** The four structured exposure fields the editor edits, as raw strings. */
export interface ExposureFields {
  /** Focal length in mm, e.g. "50". */
  focal: string;
  /** Aperture f-number, e.g. "1.4" or "4". */
  aperture: string;
  /** Shutter, e.g. "200" (=> 1/200) for fractions, or "2s" / "1/200" verbatim. */
  shutter: string;
  /** ISO, e.g. "500". */
  iso: string;
}

/** Standard whole f-stops offered in the aperture dropdown (widest → narrowest). */
export const STANDARD_APERTURES = [1.2, 1.4, 1.8, 2, 2.8, 3.5, 4, 5.6, 8, 11, 16, 22] as const;

/**
 * Standard shutter speeds offered in the dropdown, fast → slow. Stored as the
 * canonical display string the public site shows; faster-than-1s speeds are
 * "1/{n}", one-second-and-slower are "{n}s".
 */
export const STANDARD_SHUTTERS = [
  '1/8000', '1/4000', '1/2000', '1/1000', '1/500', '1/250', '1/200', '1/125',
  '1/100', '1/60', '1/30', '1/15', '1/8', '1/4',
  '1s', '2s', '4s', '8s', '15s', '30s',
] as const;

/** Standard ISO values offered in the dropdown, low → high. */
export const STANDARD_ISOS = [50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200, 102400] as const;

/**
 * Parse a lens label into focal range + aperture floor, or null if neither
 * focal nor aperture can be read (→ the editor falls back to free inputs).
 *
 * Handles, case-insensitively, the common manufacturer spellings:
 *   - Prime         "50mm F1.4 DG DN | Art 023" → {50, 50, 1.4}
 *   - Zoom          "24-70mm F2.8" / "24-70mm f/2.8" → {24, 70, 2.8}
 *   - Variable zoom "18-55mm F3.5-5.6" → {18, 55, 3.5}  (widest aperture wins)
 *
 * Focal is matched as "{min}[-{max}]mm"; aperture as the first f-number after an
 * "F" / "f/" / "f" token, taking the smallest number of a variable-aperture
 * range. Trailing marketing tokens (mount, "Art", year code) are ignored.
 */
export function parseLensSpec(label: string): LensSpec | null {
  if (!label) return null;
  const text = label.trim();

  // ── Focal: "50mm" or "24-70mm" (mm may be glued or spaced). ──
  let focalMin: number | null = null;
  let focalMax: number | null = null;
  const focalMatch = text.match(/(\d{1,4})(?:\s*-\s*(\d{1,4}))?\s*mm/i);
  if (focalMatch) {
    const a = Number(focalMatch[1]);
    const b = focalMatch[2] ? Number(focalMatch[2]) : a;
    if (Number.isFinite(a) && a > 0) {
      focalMin = Math.min(a, b);
      focalMax = Math.max(a, b);
    }
  }

  // ── Aperture: "F1.4", "f/2.8", "F3.5-5.6" → widest (smallest) number. ──
  let maxApertureN: number | null = null;
  // Match an F / f/ token followed by one or two f-numbers (variable zoom).
  const apMatch = text.match(/f\/?\s*(\d{1,2}(?:\.\d)?)(?:\s*-\s*(\d{1,2}(?:\.\d)?))?/i);
  if (apMatch) {
    const a = Number(apMatch[1]);
    const b = apMatch[2] ? Number(apMatch[2]) : a;
    const widest = Math.min(a, b);
    if (Number.isFinite(widest) && widest > 0) maxApertureN = widest;
  }

  if (focalMin === null && maxApertureN === null) return null;

  return {
    focalMin: focalMin ?? 0,
    focalMax: focalMax ?? 0,
    maxApertureN: maxApertureN ?? 0,
  };
}

/** True when the lens is a prime (single fixed focal length). */
export function isPrime(spec: LensSpec): boolean {
  return spec.focalMin > 0 && spec.focalMin === spec.focalMax;
}

/** True when the parsed spec actually constrains focal length. */
export function hasFocalGuard(spec: LensSpec): boolean {
  return spec.focalMin > 0 && spec.focalMax > 0;
}

/** True when the parsed spec actually constrains aperture. */
export function hasApertureGuard(spec: LensSpec): boolean {
  return spec.maxApertureN > 0;
}

/**
 * The aperture options a lens permits: the standard stops filtered to
 * f-number ≥ the lens's widest aperture (so an f/1.4 lens never offers f/1.2).
 * No guard / no spec → the full standard list.
 */
export function aperturesForLens(spec: LensSpec | null): number[] {
  if (!spec || !hasApertureGuard(spec)) return [...STANDARD_APERTURES];
  return STANDARD_APERTURES.filter((f) => f >= spec.maxApertureN - 1e-9);
}

/** Clamp a focal length to a zoom's [focalMin, focalMax] (no-op if no guard). */
export function clampFocal(focalMm: number, spec: LensSpec | null): number {
  if (!spec || !hasFocalGuard(spec)) return focalMm;
  return Math.min(Math.max(focalMm, spec.focalMin), spec.focalMax);
}

/**
 * Reconcile the four fields against a (possibly newly-selected) lens:
 *   - prime → focal snaps to the fixed focal length;
 *   - zoom  → focal clamps into range (blank stays blank);
 *   - aperture too wide for the lens floor → bumped up to the nearest legal stop;
 *   - no/free lens → fields returned unchanged.
 * Pure: returns a new ExposureFields, never mutates.
 */
export function reconcileWithLens(fields: ExposureFields, spec: LensSpec | null): ExposureFields {
  if (!spec) return fields;
  const next: ExposureFields = { ...fields };

  // Focal.
  if (hasFocalGuard(spec)) {
    if (isPrime(spec)) {
      next.focal = String(spec.focalMin);
    } else if (next.focal.trim()) {
      const n = Number(next.focal);
      if (Number.isFinite(n) && n > 0) next.focal = String(clampFocal(n, spec));
    }
  }

  // Aperture: if the current stop is wider than the lens allows, pick the
  // nearest legal (≥ floor) standard stop.
  if (hasApertureGuard(spec) && next.aperture.trim()) {
    const current = Number(next.aperture);
    if (Number.isFinite(current) && current < spec.maxApertureN - 1e-9) {
      const legal = aperturesForLens(spec);
      next.aperture = legal.length ? formatAperture(legal[0]) : next.aperture;
    }
  }

  return next;
}

/** Trim a float to its tidy display form: 4 → "4", 1.4 → "1.4". */
function trimNum(n: number): string {
  return String(Number(n.toFixed(2)));
}

/** Aperture f-number → its field string ("4", "1.4"). */
export function formatAperture(f: number): string {
  return trimNum(f);
}

// ── exif.settings compose / parse ───────────────────────────────────────────

/**
 * Compose the canonical `exif.settings` string from the four fields, in order
 * (focal · aperture · shutter · ISO), omitting any blank part. Returns '' when
 * everything is blank (caller writes an empty settings string).
 *
 *   { focal:"50", aperture:"4", shutter:"1/200", iso:"500" }
 *     → "50mm · f/4 · 1/200 · ISO 500"
 */
export function composeSettings(fields: ExposureFields): string {
  const parts: string[] = [];

  const focal = fields.focal.trim();
  if (focal) {
    const n = Number(focal);
    parts.push(Number.isFinite(n) ? `${trimNum(n)}mm` : `${focal}mm`);
  }

  const aperture = fields.aperture.trim();
  if (aperture) {
    const n = Number(aperture);
    parts.push(Number.isFinite(n) ? `f/${trimNum(n)}` : `f/${aperture}`);
  }

  const shutter = normalizeShutter(fields.shutter);
  if (shutter) parts.push(shutter);

  const iso = fields.iso.trim();
  if (iso) {
    const n = Number(iso);
    parts.push(Number.isFinite(n) ? `ISO ${Math.round(n)}` : `ISO ${iso}`);
  }

  return parts.join(' · ');
}

/**
 * Normalize a raw shutter field to its display form:
 *   "200" or "1/200" → "1/200";  "2" with an "s" already, or "2s" → "2s".
 * A leading "1/" or trailing "s" is honored; a bare number is treated as a
 * fraction denominator ("200" → "1/200"). Blank → ''.
 */
export function normalizeShutter(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^1\/\d+(?:\.\d+)?$/.test(s)) return s; // already "1/200"
  if (/^\d+(?:\.\d+)?s$/i.test(s)) return s.toLowerCase(); // already "2s"
  if (/^\d+(?:\.\d+)?$/.test(s)) return `1/${s}`; // bare denominator → fraction
  return s; // leave anything exotic verbatim
}

/**
 * Best-effort parse of an existing `exif.settings` string back into the four
 * fields, so reopening an image pre-fills the editor. Tolerant of the legacy
 * free-text format and arbitrary part ordering — each part is classified by
 * shape, not position. Unrecognized fragments are ignored.
 *
 *   "50mm · f/4 · 1/200 · ISO 500" → {focal:"50", aperture:"4", shutter:"1/200", iso:"500"}
 *   "f/1.4 · 1/1000 · 35mm"        → {focal:"35", aperture:"1.4", shutter:"1/1000", iso:""}
 */
export function parseSettings(settings: string | undefined): ExposureFields {
  const fields: ExposureFields = { focal: '', aperture: '', shutter: '', iso: '' };
  if (!settings) return fields;

  // Split on the canonical separator but also tolerate commas / slashes-as-
  // separators are intentionally NOT split (1/200 must survive). Whitespace-pad
  // around "·" / "," only.
  const parts = settings
    .split(/\s*[·,]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    // ISO ###
    const isoM = part.match(/^iso\s*(\d+)/i);
    if (isoM) {
      fields.iso = isoM[1];
      continue;
    }
    // f/### or f###
    const apM = part.match(/^f\/?\s*(\d+(?:\.\d+)?)$/i);
    if (apM) {
      fields.aperture = trimNum(Number(apM[1]));
      continue;
    }
    // shutter "1/###" or "###s"
    if (/^1\/\d+(?:\.\d+)?$/.test(part) || /^\d+(?:\.\d+)?s$/i.test(part)) {
      fields.shutter = normalizeShutter(part);
      continue;
    }
    // focal "###mm"
    const fM = part.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
    if (fM) {
      fields.focal = trimNum(Number(fM[1]));
      continue;
    }
    // bare number with no unit: ambiguous — only adopt as a fraction shutter if
    // nothing else claimed it. Skipped to avoid mis-tagging.
  }

  return fields;
}
