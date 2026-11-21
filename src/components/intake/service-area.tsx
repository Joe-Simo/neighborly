"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LiveField } from "@/components/workspace/primitives";
import { FormActions, FormError, type Refusal } from "@/components/workspace/treasury/form-parts";
import { AREA_MILES, intakeWords, type AreaSize, type IntakeLanguage } from "@/lib/intake/intake-words";

export type ServiceArea = { address: string; size: AreaSize; miles: number };

/** The team's reach: a center from the church's address and a radius by kind of place. */
export function ServiceAreaForm({
  language,
  start,
  onSubmit,
  onCancel,
}: {
  language: IntakeLanguage;
  start?: ServiceArea;
  onSubmit: (area: ServiceArea) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const w = intakeWords[language].area;
  const [address, setAddress] = useState(start?.address ?? "");
  const [size, setSize] = useState<AreaSize>(start?.size ?? "suburb");
  const [custom, setCustom] = useState(String(start?.size === "custom" ? start.miles : 15));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const miles = size === "custom" ? Math.min(100, Math.max(1, Number(custom) || 1)) : AREA_MILES[size];
  const square = new Intl.NumberFormat(language === "es" ? "es-US" : "en-US", { maximumSignificantDigits: 2 }).format(Math.PI * miles * miles);
  // The paper circle grows with the square root of the area so City, Suburb and Rural read as different sizes without Rural filling the sheet.
  const r = 18 + Math.sqrt(miles / 100) * 62;
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!event.currentTarget.checkValidity()) return;
        setError("");
        setSaving(true);
        const refusal = await onSubmit({ address, size, miles });
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      <LiveField label={w.address} help={w.addressHelp}>
        <Input name="address" autoComplete="street-address" maxLength={200} value={address} onChange={(event) => setAddress(event.target.value)} required />
      </LiveField>
      <LiveField label={w.size}>
        <ToggleGroup type="single" value={size} onValueChange={(value) => value && setSize(value as AreaSize)} aria-label={w.size}>
          {(Object.keys(w.sizes) as AreaSize[]).map((key) => (
            <ToggleGroupItem key={key} value={key}>
              {w.sizes[key]}
              {key !== "custom" && <span className="live-muted"> · {w.miles(AREA_MILES[key])}</span>}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </LiveField>
      {size === "custom" && (
        <LiveField label={w.customLabel}>
          <Input name="miles" type="number" inputMode="numeric" min={1} max={100} value={custom} onChange={(event) => setCustom(event.target.value)} required />
        </LiveField>
      )}
      <figure className="service-area-figure">
        <svg viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">
          <circle cx="100" cy="100" r={r} fill="var(--paper-sheet, #fbf8f1)" stroke="var(--ink, #23352a)" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="100" cy="100" r="4" fill="var(--green, #35604a)" />
        </svg>
        <figcaption>{w.miles(miles)} · {w.covers(square)}</figcaption>
      </figure>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>{w.save}</FormActions>
    </form>
  );
}
