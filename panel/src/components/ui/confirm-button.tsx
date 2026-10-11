"use client";

import type { ComponentProps } from "react";
import { Button } from "./button";

type ConfirmButtonProps = ComponentProps<typeof Button> & {
  message: string;
};

/** Botón de submit que pide confirmación antes de enviar el formulario. */
export function ConfirmButton({ message, children, ...props }: ConfirmButtonProps) {
  return (
    <Button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
