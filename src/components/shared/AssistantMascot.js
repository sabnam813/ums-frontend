import React from 'react';

export default function AssistantMascot({ waving = false, size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`am-mascot-svg ${waving ? 'am-waving' : ''}`}>
      <ellipse cx="50" cy="92" rx="22" ry="4" fill="#0f2f5c" opacity="0.12" />
      <g className="am-bob">
        <rect x="30" y="52" width="40" height="30" rx="12" fill="#1565c0" />
        <rect x="36" y="58" width="28" height="18" rx="8" fill="#ffa726" opacity="0.9" />
        <circle cx="50" cy="38" r="26" fill="#1e88e5" />
        <circle cx="50" cy="38" r="20" fill="#e3f2fd" />
        <circle cx="41" cy="36" r="4.5" fill="#0d47a1" />
        <circle cx="59" cy="36" r="4.5" fill="#0d47a1" />
        <circle cx="42.5" cy="34.5" r="1.4" fill="#fff" />
        <circle cx="60.5" cy="34.5" r="1.4" fill="#fff" />
        <path d="M43 46 Q50 52 57 46" stroke="#0d47a1" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <rect x="46" y="10" width="8" height="10" rx="4" fill="#1565c0" />
        <circle cx="50" cy="8" r="5" fill="#ffa726" />
        <g className={waving ? 'am-arm-wave' : 'am-arm-idle'} style={{ transformOrigin: '26px 58px' }}>
          <rect x="16" y="54" width="10" height="22" rx="8" fill="#1e88e5" />
          <circle cx="21" cy="75" r="6" fill="#ffcc80" />
        </g>
        <rect x="74" y="58" width="10" height="20" rx="8" fill="#1e88e5" />
        <circle cx="79" cy="77" r="6" fill="#ffcc80" />
      </g>
    </svg>
  );
}
