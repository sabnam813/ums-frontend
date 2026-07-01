import React from 'react';

export default function CountryFlag({ country, size = 20, rounded = 4, className = '' }) {
  const flagImage = country?.flagImage;
  const flagEmoji = country?.flag;

  if (flagImage) {
    return (
      <img
        src={flagImage}
        alt={country?.name ? `${country.name} flag` : 'Flag'}
        className={`country-flag-img ${className}`}
        style={{
          width: size,
          height: Math.round(size * 0.72),
          borderRadius: rounded,
          objectFit: 'cover',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  if (flagEmoji) {
    return (
      <span
        className={`country-flag-emoji ${className}`}
        style={{ fontSize: size * 0.85, lineHeight: 1, flexShrink: 0 }}
      >
        {flagEmoji}
      </span>
    );
  }

  return (
    <svg
      width={size * 0.85} height={size * 0.85}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={className}
      style={{ flexShrink: 0, opacity: 0.6 }}
    >
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}
