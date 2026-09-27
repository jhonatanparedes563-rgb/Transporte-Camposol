import React from 'react';

/**
 * Retorna la URL correcta de un recurso público respetando el BASE_URL de Vite
 * (por ejemplo '/Transporte-Camposol/' en GitHub Pages o '/' en desarrollo local).
 */
export const getPublicAssetUrl = (assetPath: string): string => {
  const clean = assetPath.replace(/^\/+/, '');
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  return base.endsWith('/') ? `${base}${clean}` : `${base}/${clean}`;
};

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
        src={getPublicAssetUrl('camposol-banner.png')}
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.includes('.svg')) {
            target.src = getPublicAssetUrl('camposol-banner.svg');
          }
        }}
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

  const primaryAsset = variant === 'icon' ? 'icon.svg' : 'camposol-emblem.png';
  const fallbackAsset = variant === 'icon' ? 'pwa-192x192.png' : 'camposol-emblem.svg';

  return (
    <img
      src={getPublicAssetUrl(primaryAsset)}
      onError={(e) => {
        const target = e.currentTarget;
        if (!target.src.includes(fallbackAsset)) {
          target.src = getPublicAssetUrl(fallbackAsset);
        }
      }}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`inline-block object-contain rounded-full shadow-xs shrink-0 select-none ${sizeClasses[size] || ''} ${className}`}
    />
  );
};

