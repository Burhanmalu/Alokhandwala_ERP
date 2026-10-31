import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_MAP = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export function Card({
  children,
  className = '',
  padding = 'md',
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-[#e8decb] shadow-2xs ${PADDING_MAP[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className = '',
}: CardHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between border-b border-[#f0e8db] pb-3 mb-4 gap-2 ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-[#8f6541] shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-[#24160c] uppercase tracking-wider truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-[#7d6553] truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
