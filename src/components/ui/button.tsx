import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm before:absolute before:inset-y-0 before:-left-20 before:w-14 before:skew-x-[-18deg] before:bg-white/25 before:opacity-0 before:transition-all before:duration-500 hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-[var(--shadow-lifted)] hover:before:left-[120%] hover:before:opacity-100",
        outline:
          "border border-input bg-card/80 shadow-sm backdrop-blur hover:-translate-y-0.5 hover:border-ring/45 hover:bg-accent/70 hover:text-accent-foreground hover:shadow-[var(--shadow-soft)]",
        ghost:
          "hover:-translate-y-0.5 hover:bg-accent/70 hover:text-accent-foreground",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-md px-3",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
