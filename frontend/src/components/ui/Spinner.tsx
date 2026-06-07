interface SpinnerProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-2',
}

export function Spinner({ label = 'Loading...', size = 'md', className = '' }: SpinnerProps) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <div className={`${sizes[size]} border-accent border-t-transparent rounded-full animate-spin`} />
      <span className="sr-only">{label}</span>
    </div>
  )
}
