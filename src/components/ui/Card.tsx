import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_MAP = {
  none: '',
  sm: 'p-4 sm:p-5',
  md: 'p-5 sm:p-7',
  lg: 'p-6 sm:p-8',
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
      className={`flex items-center justify-between border-b border-[#f0e8db] pb-4 mb-5 gap-3 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-[#8f6541] shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-[#24160c] uppercase tracking-wider truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#7d6553] truncate mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
