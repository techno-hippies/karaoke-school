import { splitProps, type Component, type JSX } from 'solid-js'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-95',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80 hover:shadow-lg',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'bg-secondary/30 text-foreground hover:bg-secondary/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-foreground hover:bg-secondary/50',
        link: 'text-primary underline-offset-4 hover:underline',
        gradient: 'bg-[image:var(--gradient-primary)] text-white hover:brightness-110',
        'gradient-success': 'bg-[image:var(--gradient-success)] text-white hover:brightness-110',
        'gradient-fire': 'bg-[image:var(--gradient-fire)] text-white hover:brightness-110',
        'gradient-gold': 'bg-[image:var(--gradient-gold)] text-black hover:brightness-110',
        recording: 'bg-[image:var(--gradient-fire)] text-white',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-10 px-3',
        lg: 'h-12 px-8',
        xl: 'h-14 px-10 text-lg',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, ['class', 'variant', 'size', 'children'])

  return (
    <button
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    >
      {local.children}
    </button>
  )
}
