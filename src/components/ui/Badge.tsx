import React from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'warning' | 'error' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  ...props
}) => {
  const variants = {
    primary: 'bg-gogreen-primary/15 text-gogreen-bright border border-gogreen-primary/30',
    secondary: 'bg-gogreen-secondary/15 text-gogreen-secondary border border-gogreen-secondary/30',
    warning: 'bg-gogreen-warning/15 text-gogreen-warning border border-gogreen-warning/30',
    error: 'bg-gogreen-error/15 text-gogreen-error border border-gogreen-error/30',
    neutral: 'bg-gogreen-bg-elevated text-gogreen-text-secondary border border-gogreen-border',
    outline: 'border border-gogreen-border text-gogreen-text-primary bg-transparent',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 font-mono font-medium',
    md: 'text-xs px-2.5 py-1 font-mono font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded uppercase tracking-wider',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            variant === 'primary' && 'bg-gogreen-bright',
            variant === 'secondary' && 'bg-gogreen-secondary',
            variant === 'warning' && 'bg-gogreen-warning',
            variant === 'error' && 'bg-gogreen-error',
            variant === 'neutral' && 'bg-gogreen-text-secondary',
            variant === 'outline' && 'bg-gogreen-text-primary'
          )}
        />
      )}
      {children}
    </span>
  );
};
