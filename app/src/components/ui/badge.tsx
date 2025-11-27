import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Gradient variants
        gradient:
          "border-transparent bg-[image:var(--gradient-primary)] text-white shadow-sm",
        success:
          "border-transparent bg-[image:var(--gradient-success)] text-white shadow-sm",
        fire:
          "border-transparent bg-[image:var(--gradient-fire)] text-white shadow-sm",
        gold:
          "border-transparent bg-[image:var(--gradient-gold)] text-black shadow-sm",
        purple:
          "border-transparent bg-[image:var(--gradient-purple)] text-white shadow-sm",
        // Glowing variants
        "glow-primary":
          "border-transparent bg-primary text-primary-foreground shadow-[var(--glow-primary)]",
        "glow-success":
          "border-transparent bg-[image:var(--gradient-success)] text-white shadow-[var(--glow-success)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge }
