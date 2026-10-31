import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const MAX_WIDTH_MAP = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  '2xl': 'max-w-[1500px]',
  full: 'max-w-full',
};

export function PageContainer({
  children,
  className = '',
  maxWidth = '2xl',
}: PageContainerProps) {
  return (
    <div className={`w-full mx-auto min-w-0 space-y-5 ${MAX_WIDTH_MAP[maxWidth]} ${className}`}>
      {children}
    </div>
  );
}
