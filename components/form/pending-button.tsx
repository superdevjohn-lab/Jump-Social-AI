"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

type PendingButtonProps = ButtonProps & {
  pendingText?: string;
};

export function PendingButton({
  pendingText = "Working...",
  children,
  ...props
}: PendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} type="submit" disabled={pending || props.disabled}>
      {pending ? pendingText : children}
    </Button>
  );
}

