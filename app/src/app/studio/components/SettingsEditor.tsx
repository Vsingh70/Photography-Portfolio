'use client';

/**
 * Structured, lens-aware exposure editor. Replaces the old free-text Settings
 * input with four physically-constrained fields (focal · aperture · shutter ·
 * ISO) whose options are bounded by the image's selected lens, but whose output
 * is the same `exif.settings` string the public site renders
 * ("50mm · f/4 · 1/200 · ISO 500").
 *
 * Self-contained presentation: the parent owns the four-field state
 * (`ExposureFields`) and the chosen lens label; this component renders the
 * controls and reports field changes. Composing the `exif.settings` string and
 * reconciling fields when the lens changes are the parent's job (via the
 * helpers in lib/studio/lens.ts), keeping this component a pure view that's
 * reusable both per-image (ImageTile) and for apply-to-all (StudioApp).
 *
 * Guardrails, driven off `lensSpec` (parsed from the lens label by the caller):
 *   - Focal:   prime → locked chip (read-only); zoom → Select of in-range stops
 *              plus the exact current value; no/unparseable lens → free numeric.
 *   - Aperture: Select of standard f-stops filtered to ≥ the lens's widest stop.
 *   - Shutter:  Select of standard speeds.
 *   - ISO:      Select of standard ISOs (a free typed value is preserved as an
 *              extra option so it survives a reopen).
 * Reduced-motion safe via the shared Select (forwards `reducedMotion`).
 */

import { Cap, Select } from './ui';
import {
  aperturesForLens,
  formatAperture,
  hasFocalGuard,
  isPrime,
  STANDARD_ISOS,
  STANDARD_SHUTTERS,
  type ExposureFields,
  type LensSpec,
} from '@/lib/studio/lens';

const SERIF = 'Cormorant Garamond, serif';

const numInput: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(245,243,238,0.18)',
  padding: '5px 0 7px',
  fontFamily: SERIF,
  fontSize: 16,
  color: '#f5f3ee',
  outline: 'none',
};

/** Build the focal-length option list for a zoom: in-range standard stops,
 * always including the lens endpoints + the current value so nothing is lost. */
function zoomFocalOptions(spec: LensSpec, current: string): { value: string; label: string }[] {
  const stops = new Set<number>([spec.focalMin, spec.focalMax]);
  // Common focal stops across the range (5mm steps under 100, 10mm above).
  for (let f = spec.focalMin; f <= spec.focalMax; f += f < 100 ? 5 : 10) stops.add(f);
  const n = Number(current);
  if (current.trim() && Number.isFinite(n) && n >= spec.focalMin && n <= spec.focalMax) stops.add(n);
  return [...stops]
    .sort((a, b) => a - b)
    .map((f) => ({ value: String(f), label: `${f}mm` }));
}

export interface SettingsEditorProps {
  fields: ExposureFields;
  /** Parsed guardrails from the selected lens, or null → free inputs. */
  lensSpec: LensSpec | null;
  reducedMotion: boolean;
  onChange: (patch: Partial<ExposureFields>) => void;
}

export function SettingsEditor({ fields, lensSpec, reducedMotion, onChange }: SettingsEditorProps) {
  const apertureStops = aperturesForLens(lensSpec);
  const apertureOptions = apertureStops.map((f) => ({ value: formatAperture(f), label: `f/${formatAperture(f)}` }));
  const shutterOptions = STANDARD_SHUTTERS.map((s) => ({ value: s, label: s }));

  // ISO: standard list, plus the current value if it's a non-standard typed one.
  const isoValues: number[] = [...STANDARD_ISOS];
  const isoNum = Number(fields.iso);
  if (fields.iso.trim() && Number.isFinite(isoNum) && !isoValues.includes(isoNum)) {
    isoValues.push(isoNum);
    isoValues.sort((a, b) => a - b);
  }
  const isoOptions = isoValues.map((v) => ({ value: String(v), label: `ISO ${v}` }));

  const primeLens = lensSpec && isPrime(lensSpec);
  const zoomLens = lensSpec && hasFocalGuard(lensSpec) && !primeLens;
  const noGuards = !lensSpec;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Focal */}
      <Field label="Focal">
        {primeLens ? (
          <LockedChip>{lensSpec!.focalMin}mm</LockedChip>
        ) : zoomLens ? (
          <Select
            value={fields.focal}
            options={zoomFocalOptions(lensSpec!, fields.focal)}
            placeholder={`${lensSpec!.focalMin}–${lensSpec!.focalMax}mm`}
            reducedMotion={reducedMotion}
            onChange={(v) => onChange({ focal: v })}
          />
        ) : (
          <NumberField
            value={fields.focal}
            placeholder="50"
            suffix="mm"
            onChange={(v) => onChange({ focal: v })}
          />
        )}
      </Field>

      {/* Aperture */}
      <Field label="Aperture">
        <Select
          value={fields.aperture}
          options={apertureOptions}
          placeholder="f/—"
          reducedMotion={reducedMotion}
          onChange={(v) => onChange({ aperture: v })}
        />
      </Field>

      {/* Shutter */}
      <Field label="Shutter">
        <Select
          value={fields.shutter}
          options={shutterOptions}
          placeholder="1/—"
          reducedMotion={reducedMotion}
          onChange={(v) => onChange({ shutter: v })}
        />
      </Field>

      {/* ISO */}
      <Field label="ISO">
        <Select
          value={fields.iso}
          options={isoOptions}
          placeholder="ISO —"
          reducedMotion={reducedMotion}
          onChange={(v) => onChange({ iso: v })}
        />
      </Field>

      {noGuards && (
        <Cap style={{ color: 'rgba(245,243,238,0.35)', fontSize: 8 }}>
          Pick a lens for focal/aperture guardrails
        </Cap>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Cap style={{ color: 'rgba(245,243,238,0.5)', fontSize: 8 }}>{label}</Cap>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  );
}

/** Read-only locked value chip (used for a prime lens's fixed focal length). */
function LockedChip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid rgba(245,243,238,0.18)',
        background: 'rgba(245,243,238,0.04)',
        fontFamily: SERIF,
        fontSize: 15,
        color: '#f5f3ee',
      }}
    >
      <span style={{ fontSize: 10, color: '#d4a93e' }}>🔒</span>
      {children}
    </div>
  );
}

/** Free numeric field (no lens guard) with a static unit suffix. */
function NumberField({
  value,
  placeholder,
  suffix,
  onChange,
}: {
  value: string;
  placeholder: string;
  suffix: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...numInput, flex: 1 }}
      />
      <span style={{ fontFamily: SERIF, fontSize: 14, color: 'rgba(245,243,238,0.55)' }}>{suffix}</span>
    </div>
  );
}
