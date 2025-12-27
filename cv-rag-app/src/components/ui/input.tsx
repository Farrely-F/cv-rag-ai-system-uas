"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = Omit<
  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
  "size"
> & {
  size?: "sm" | "default" | "lg" | number;
  unstyled?: boolean;
};

function Input({
  className,
  size = "default",
  unstyled = false,
  ...props
}: InputProps) {
  return (
    <span
      className={
        cn(
          !unstyled &&
            "relative inline-flex w-full border-b-2 border-input bg-transparent text-base transition-colors focus-within:border-primary focus-within:shadow-[0_1px_10px_rgba(var(--primary),0.2)] disabled:opacity-50 sm:text-sm",
          className
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
    >
      <InputPrimitive
        className={cn(
          "h-10 w-full min-w-0 bg-transparent px-3 py-2 outline-none placeholder:text-muted-foreground/50",
          size === "sm" && "h-8 px-2 text-xs",
          size === "lg" && "h-12 px-4 text-lg",
          props.type === "search" &&
            "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
          props.type === "file" &&
            "text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm"
        )}
        data-slot="input"
        size={typeof size === "number" ? size : undefined}
        {...props}
      />
    </span>
  );
}

export { Input, type InputProps };
