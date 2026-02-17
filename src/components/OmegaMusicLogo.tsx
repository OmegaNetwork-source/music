"use client";

interface OmegaMusicLogoProps {
  className?: string;
  size?: number;
}

/** Logo for Omega Music: equalizer bars (sound) — distinct from Apple Music’s note. */
export function OmegaMusicLogo({ className = "", size = 32 }: OmegaMusicLogoProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg ring-2 ring-white/10 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="white"
        className="opacity-95"
        style={{ width: size * 0.6, height: size * 0.6 }}
      >
        {/* Equalizer bars — suggests music without a note icon */}
        <rect x="3" y="14" width="3" height="6" rx="1.5" />
        <rect x="8" y="10" width="3" height="10" rx="1.5" />
        <rect x="13" y="6" width="3" height="14" rx="1.5" />
        <rect x="18" y="10" width="3" height="10" rx="1.5" />
      </svg>
    </div>
  );
}
