import React from 'react';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'default' | 'highlight' | 'warning' | 'danger' | 'success';
  className?: string;
}

const VARIANT_MAP = {
  default: {
    bg: 'bg-white',
    border: 'border-[#e8decb]',
    text: 'text-[#24160c]',
    hint: 'text-[#7d6553]',
    iconBg: 'bg-[#faf6ee] text-[#8f6541]',
  },
  highlight: {
    bg: 'bg-[#24160c]',
    border: 'border-[#3d2616]',
    text: 'text-white',
    hint: 'text-[#debfa6]',
    iconBg: 'bg-[#3d2616] text-[#c79e7c]',
  },
  warning: {
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    text: 'text-amber-950',
    hint: 'text-amber-800',
    iconBg: 'bg-amber-100 text-amber-800',
  },
  danger: {
    bg: 'bg-rose-50/70',
    border: 'border-rose-200',
    text: 'text-rose-950',
    hint: 'text-rose-800',
    iconBg: 'bg-rose-100 text-rose-800',
  },
  success: {
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    text: 'text-emerald-950',
    hint: 'text-emerald-800',
    iconBg: 'bg-emerald-100 text-emerald-800',
  },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  variant = 'default',
  className = '',
}: StatCardProps) {
  const styles = VARIANT_MAP[variant];
  return (
    <div
      className={`${styles.bg} ${styles.border} border rounded-xl p-4 sm:p-5 lg:p-6 shadow-2xs flex items-center justify-between gap-4 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className={`text-xs sm:text-sm font-semibold uppercase tracking-wider ${styles.hint} truncate`}>
          {label}
        </div>
        <div className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight mt-1.5 truncate ${styles.text}`}>
          {value}
        </div>
        {hint && (
          <div className={`text-xs mt-1 truncate ${styles.hint}`}>
            {hint}
          </div>
        )}
      </div>
      {icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${styles.iconBg}`}>
          {icon}
        </div>
      )}
    </div>
  );
}
