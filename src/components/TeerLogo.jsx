export default function TeerLogo({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tlBadgeBg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f0fdf4" />
        </linearGradient>
        <linearGradient id="tlGold" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="tlEmerald" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <filter id="tlShadow" x="-10%" y="-10%" width="125%" height="125%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* Outer circular badge */}
      <circle cx="24" cy="24" r="22" fill="url(#tlBadgeBg)" stroke="url(#tlGold)" strokeWidth="2" filter="url(#tlShadow)" />

      {/* Target Ring 1 (Outer Guide) */}
      <circle cx="24" cy="24" r="16.5" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="2 2" fill="none" />

      {/* Target Ring 2 (Emerald Zone) */}
      <circle cx="24" cy="24" r="12" stroke="url(#tlEmerald)" strokeWidth="2.5" fill="none" opacity="0.9" />

      {/* Target Ring 3 (Inner Gold Ring) */}
      <circle cx="24" cy="24" r="7.5" stroke="url(#tlGold)" strokeWidth="2" fill="none" />

      {/* Center Bullseye */}
      <circle cx="24" cy="24" r="4" fill="#dc2626" />
      <circle cx="24" cy="24" r="1.5" fill="#ffffff" />

      {/* Dynamic Arrow (Teer) */}
      {/* Shaft */}
      <line x1="8" y1="40" x2="35" y2="13" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
      {/* Shaft highlight */}
      <line x1="10" y1="38" x2="33" y2="15" stroke="#f59e0b" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />

      {/* Arrowhead (Piercing the target top-right) */}
      <path
        d="M40 8 L31 11.5 L34.5 15 Z"
        fill="url(#tlGold)"
        stroke="#92400e"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />

      {/* Arrow Fletching (Feathers at bottom-left) */}
      <path d="M12 36 L7 38 L9 42 Z" fill="#dc2626" />
      <path d="M15 33 L17 38 L20 35 Z" fill="url(#tlGold)" />
      <path d="M10 41 L12 44 L15 42 Z" fill="#047857" />

      {/* Hit spark at bullseye */}
      <path
        d="M24 20.5 L24.8 23.2 L27.5 24 L24.8 24.8 L24 27.5 L23.2 24.8 L20.5 24 L23.2 23.2 Z"
        fill="#fef08a"
        opacity="0.95"
      />
    </svg>
  );
}
