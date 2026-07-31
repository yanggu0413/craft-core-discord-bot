import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-semibold tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-md cursor-pointer",
          // Variants
          variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs",
          variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs",
          variant === "outline" && "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground hover:border-primary/40",
          variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          variant === "ghost" && "hover:bg-secondary hover:text-secondary-foreground",
          variant === "link" && "text-primary underline-offset-4 hover:underline",
          // Sizes
          size === "default" && "h-9 px-4 py-2",
          size === "sm" && "h-8 px-3 text-[11px]",
          size === "lg" && "h-10 px-8",
          size === "icon" && "h-9 w-9",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
