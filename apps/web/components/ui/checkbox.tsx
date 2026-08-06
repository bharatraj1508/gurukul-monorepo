import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={(e) => {
          onCheckedChange?.(e.target.checked)
          onChange?.(e)
        }}
        className={cn(
          "h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus:ring-primary cursor-pointer",
          className
        )}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
