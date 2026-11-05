import React from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  icon,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-mono font-medium rounded transition-all focus:outline-none focus:ring-1 focus:ring-gogreen-primary active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';

  const variants = {
    primary: 'bg-gogreen-primary text-gogreen-bg-main hover:bg-gogreen-bright hover:shadow-glow-sm font-semibold',
    secondary: 'bg-gogreen-bg-elevated text-gogreen-text-primary border border-gogreen-border hover:border-gogreen-primary/60 hover:text-gogreen-bright',
    outline: 'border border-gogreen-primary text-gogreen-primary hover:bg-gogreen-primary/10',
    ghost: 'text-gogreen-text-secondary hover:text-gogreen-text-primary hover:bg-gogreen-bg-elevated/50',
    danger: 'bg-gogreen-error/20 text-gogreen-error border border-gogreen-error/40 hover:bg-gogreen-error/30',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-xs px-3.5 py-2 gap-2',
    lg: 'text-sm px-4 py-2.5 gap-2.5',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
