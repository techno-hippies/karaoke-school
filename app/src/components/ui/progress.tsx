"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-secondary",
  {
    variants: {
      size: {
        sm: "h-2",
        default: "h-4",
        lg: "h-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const indicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-primary",
        gradient: "bg-[image:var(--gradient-primary)]",
        success: "bg-[image:var(--gradient-success)]",
        fire: "bg-[image:var(--gradient-fire)]",
        gold: "bg-[image:var(--gradient-gold)]",
      },
      animated: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      animated: false,
    },
  }
)

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof indicatorVariants> {}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, size, variant, animated, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(progressVariants({ size }), className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        indicatorVariants({ variant }),
        "relative"
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    >
      {animated && (
        <div className="absolute inset-0 animate-shimmer" />
      )}
    </ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
