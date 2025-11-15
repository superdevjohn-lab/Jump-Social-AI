"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

type CopyButtonProps = ButtonProps & {
  text: string;
};

export function CopyButton({ text, children, ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      {...props}
    >
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" /> Copied
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" /> {children ?? "Copy"}
        </>
      )}
    </Button>
  );
}

