import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`text-center py-10 sm:py-12 px-4 bg-white rounded-lg border border-[#e8decb] shadow-2xs ${className}`}
    >
      {icon && (
        <div className="mx-auto w-10 h-10 text-[#9c826e] flex items-center justify-center mb-2.5 opacity-70">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-bold text-[#24160c]">{title}</h3>
      {description && (
        <p className="text-xs text-[#7d6553] max-w-md mx-auto mt-1">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = 'Loading data...',
  className = '',
}: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      <div className="w-7 h-7 border-2 border-[#8f6541] border-t-transparent rounded-full animate-spin mb-3" />
      <span className="text-xs font-medium text-[#7d6553]">{message}</span>
    </div>
  );
}
