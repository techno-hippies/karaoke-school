import { CircleNotch } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

interface SpinnerProps extends Omit<React.ComponentProps<"svg">, "width" | "height"> {
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
}

function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  return (
    <CircleNotch
      role="status"
      aria-label="Loading"
      className={cn(sizeClasses[size], "animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
