"use client";

import { cn } from "@/lib/utils";

// A labeled text field shared by the deposit and keeper panels. Amounts and
// addresses are both plain text: amounts are parsed with parseUnits so decimals
// are exact, addresses are parsed into a PublicKey by the caller.
export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono,
  disabled,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  disabled?: boolean;
  inputMode?: "decimal" | "text";
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none disabled:opacity-50",
          mono && "font-mono text-xs",
        )}
      />
      {hint ? (
        <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
