import React from 'react';
import { cn } from '@/utils/cn';

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'standby' | 'warning' | 'error';
  label?: string;
  pulse?: boolean;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  pulse = true,
  className,
}) => {
  const colors = {
    online: 'bg-gogreen-bright shadow-[0_0_8px_#39FF14]',
    offline: 'bg-gogreen-border',
    standby: 'bg-gogreen-warning/80 shadow-[0_0_8px_#F2B84B]',
    warning: 'bg-gogreen-warning shadow-[0_0_8px_#F2B84B]',
    error: 'bg-gogreen-error shadow-[0_0_8px_#FF6464]',
  };

  const textColors = {
    online: 'text-gogreen-bright',
    offline: 'text-gogreen-text-secondary',
    standby: 'text-gogreen-warning',
    warning: 'text-gogreen-warning',
    error: 'text-gogreen-error',
  };

  return (
    <div className={cn('inline-flex items-center gap-2 font-mono text-xs', className)}>
      <span className="relative flex h-2 w-2">
        {pulse && status === 'online' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gogreen-bright opacity-75" />
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', colors[status])} />
      </span>
      {label && <span className={cn('font-medium', textColors[status])}>{label}</span>}
    </div>
  );
};
