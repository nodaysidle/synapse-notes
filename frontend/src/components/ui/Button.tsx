import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'hover:bg-white/[0.08] text-white px-4 py-2 rounded-xl transition-all',
  icon: 'btn-icon',
}

const sizes = {
  sm: 'text-sm px-4 py-2.5 min-h-[44px]',
  md: 'text-[1rem] leading-6 px-6 py-3 min-h-[48px]',
  lg: 'text-lg px-8 py-4 min-h-[56px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseClasses = variant === 'icon' ? variants.icon : `${variants[variant]} ${sizes[size]}`

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </span>
        ) : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
