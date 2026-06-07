import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'elevated' | 'interactive'
}

export const Card = forwardRef<HTMLElement, CardProps>(
  ({ className = '', variant = 'default', children, onClick, ...props }, ref) => {
    const variants = {
      default: 'glass p-5',
      elevated: 'glass-elevated p-5',
      interactive: 'card cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50',
    }

    if (variant === 'interactive') {
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          className={`${variants.interactive} ${className} w-full text-left`}
          onClick={onClick}
          {...(props as HTMLAttributes<HTMLButtonElement>)}
        >
          {children}
        </button>
      )
    }

    return (
      <div ref={ref as React.Ref<HTMLDivElement>} className={`${variants[variant]} ${className}`} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
