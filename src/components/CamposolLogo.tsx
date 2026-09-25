import React from 'react';

interface CamposolLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'emblem' | 'banner' | 'icon' | 'full';
  alt?: string;
}

export const CamposolLogo: React.FC<CamposolLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'emblem',
  alt = 'CAMPOSOL',
}) => {
  if (variant === 'banner') {
    return (
      <img
        src="/Transporte-Camposol/camposol-banner.png"
        alt={alt}
        referrerPolicy="no-referrer"
        className={`inline-block object-contain rounded-xl select-none ${className}`}
      />
    );
  }

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28',
  };

 const src = variant === 'icon' ? '/Transporte-Camposol/icon.svg' : '/Transporte-Camposol/camposol-emblem.png';

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`inline-block object-contain rounded-full shadow-xs shrink-0 select-none ${sizeClasses[size] || ''} ${className}`}
    />
  );
};
