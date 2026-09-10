"use client";

import type { ButtonHTMLAttributes } from "react";

/** Submit tlačítko, co si před odesláním vyžádá potvrzení (window.confirm) — pro destruktivní akce. */
export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { confirmMessage: string }) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
