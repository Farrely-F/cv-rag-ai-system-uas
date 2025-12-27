import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "[&_svg]:-mx-0.5 relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border font-medium text-base outline-none transition-all duration-200 focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 px-4 sm:h-9",
        icon: "size-9 sm:size-9",
        "icon-lg": "size-10 sm:size-10",
        "icon-sm": "size-8 sm:size-8",
        "icon-xl":
          "size-11 sm:size-11 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        "icon-xs":
          "size-7 sm:size-7 not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-4 sm:not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-6 sm:h-10",
        sm: "h-8 gap-1.5 px-3 sm:h-8",
        xl: "h-11 px-8 text-lg sm:h-11 sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        xs: "h-7 gap-1 px-2 text-sm sm:h-7 sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
      },
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.3)] hover:bg-primary/90 hover:shadow-[0_0_15px_var(--color-primary)]",
        destructive:
          "border-destructive bg-destructive/20 text-destructive-foreground hover:bg-destructive/30 hover:shadow-[0_0_10px_var(--color-destructive)]",
        "destructive-outline":
          "border-destructive/50 text-destructive hover:bg-destructive/10",
        ghost:
          "border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        outline:
          "border-primary/50 bg-background hover:bg-primary/10 hover:border-primary hover:text-primary hover:shadow-[0_0_10px_var(--color-primary)]",
        secondary:
          "border-secondary bg-secondary/50 text-secondary-foreground hover:bg-secondary/70 backdrop-blur-sm",
        cyber:
          "border-x-2 border-y border-primary/60 bg-background/50 text-primary uppercase tracking-widest hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 clip-path-polygon-[0_0,100%_0,100%_70%,85%_100%,0_100%]",
      },
    },
  }
);

interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  // If variant is cyber, we might want to add some decorative elements, but for now CSS is enough
  const defaultProps = {
    className: cn(buttonVariants({ className, size, variant })),
    "data-slot": "button",
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export { Button, buttonVariants };
