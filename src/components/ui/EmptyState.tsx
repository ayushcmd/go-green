import React from 'react';
import { cn } from '@/utils/cn';
import { AlertCircle, WifiOff, HardDriveDownload, ServerCrash } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  type?: 'disconnected' | 'no_workers' | 'no_data' | 'unavailable' | 'waiting';
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  type = 'no_data',
  actionLabel,
  onAction,
  className,
  icon,
}) => {
  const getIcon = () => {
    if (icon) return icon;
    switch (type) {
      case 'disconnected':
      case 'waiting':
        return <WifiOff className="w-8 h-8 text-gogreen-text-secondary/60" />;
      case 'no_workers':
        return <ServerCrash className="w-8 h-8 text-gogreen-text-secondary/60" />;
      case 'unavailable':
        return <AlertCircle className="w-8 h-8 text-gogreen-warning/80" />;
      case 'no_data':
      default:
        return <HardDriveDownload className="w-8 h-8 text-gogreen-text-secondary/60" />;
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center bg-gogreen-bg-panel/40 border border-gogreen-border/60 rounded-md',
        className
      )}
    >
      <div className="p-3 bg-gogreen-bg-elevated/80 border border-gogreen-border rounded-lg mb-3">
        {getIcon()}
      </div>
      <h4 className="font-mono text-sm font-semibold text-gogreen-text-primary uppercase tracking-wide">
        {title}
      </h4>
      <p className="text-xs text-gogreen-text-secondary max-w-sm mt-1.5 leading-relaxed font-sans">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
