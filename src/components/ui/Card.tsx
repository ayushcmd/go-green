import React from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'bordered';
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  title,
  subtitle,
  headerAction,
  variant = 'default',
  noPadding = false,
  ...props
}) => {
  const variants = {
    default: 'bg-gogreen-bg-panel border border-gogreen-border',
    elevated: 'bg-gogreen-bg-elevated border border-gogreen-border shadow-panel',
    bordered: 'bg-gogreen-bg-main border border-gogreen-primary/30',
  };

  return (
    <div className={cn('rounded relative flex flex-col', variants[variant], className)} {...props}>
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between border-b border-gogreen-border/80 px-4 py-3 bg-gogreen-bg-secondary/40">
          <div>
            {title && (
              <h3 className="font-mono text-xs font-semibold text-gogreen-text-primary uppercase tracking-wider flex items-center gap-2">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-gogreen-text-secondary mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
        </div>
      )}
      <div className={cn(noPadding ? 'p-0' : 'p-4', 'flex-1')}>{children}</div>
    </div>
  );
};
