"use client";

import React from "react";
import { Input, InputProps } from "./Input";

interface MoneyInputProps extends Omit<InputProps, "type" | "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

export function MoneyInput({ value, onValueChange, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      value={value}
      onChange={(event) => onValueChange(event.target.value.replace(",", "."))}
    />
  );
}
