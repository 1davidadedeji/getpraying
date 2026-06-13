"use client";

import { FormField } from "@/components/dashboard/FormField";
import { inputCls } from "@/components/dashboard/form-styles";

export function ScriptureField({
  value,
  onChange,
  disabled,
  className,
  placeholder = "Optional, e.g. John 15:5",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  return (
    <FormField label="Scripture (optional)" className={className}>
      <input
        className={inputCls}
        type="text"
        name="scripture"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}
