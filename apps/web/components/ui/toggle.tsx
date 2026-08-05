import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  size?: "default" | "sm" | "lg"
}

const Toggle = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, pressed, onPressedChange, onClick, size = "default", ...props }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        aria-pressed={pressed}
        data-state={pressed ? "on" : "off"}
        onClick={(e) => {
          onPressedChange?.(!pressed)
          onClick?.(e)
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50",
          pressed && "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
          size === "default" && "h-9 px-3",
          size === "sm" && "h-8 w-8 p-0",
          size === "lg" && "h-10 px-3",
          className
        )}
        {...props}
      />
    )
  }
)
Toggle.displayName = "Toggle"

export { Toggle }
