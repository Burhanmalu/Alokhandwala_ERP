import React from 'react';

interface LogoProps {
  variant?: 'full' | 'icon';
  theme?: 'dark' | 'light' | 'accent';
  className?: string;
  height?: number;
  alt?: string;
}

export function Logo({
  variant = 'full',
  theme = 'light',
  className = '',
  alt = 'ALOKHANDWALA',
}: LogoProps) {
  let src = '/logo.png';

  if (variant === 'icon') {
    if (theme === 'dark') {
      src = '/logo-icon-white.png';
    } else if (theme === 'accent') {
      src = '/logo-icon-accent.png';
    } else {
      src = '/logo-icon.png';
    }
  } else {
    if (theme === 'dark') {
      src = '/logo-white.png';
    } else if (theme === 'accent') {
      src = '/logo-accent.png';
    } else {
      src = '/logo.png';
    }
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain ${className}`}
    />
  );
}
