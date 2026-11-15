"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function LiveLoading({
  label = "Opening your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="live-loading" role="status">
      <LoaderCircle size={20} aria-hidden="true" />
      <span className="text-balance">{label}</span>
    </div>
  );
}
export function LiveEmpty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="live-empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function LiveField({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  return (
    <label className="live-field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
