"use client";

interface OmegaMusicLogoProps {
  className?: string;
  size?: number;
}

/**
 * Omega Music logo: vinyl turntable (platter + tonearm).
 */
export function OmegaMusicLogo({ className = "", size = 32 }: OmegaMusicLogoProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-black text-white ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="shrink-0"
        style={{ width: size * 0.7, height: size * 0.7 }}
      >
        {/* Turntable base */}
        <rect x="4" y="8" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
        {/* Platter / vinyl */}
        <circle cx="16" cy="17" r="8" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <circle cx="16" cy="17" r="4" fill="currentColor" opacity={0.85} />
        <circle cx="16" cy="17" r="1.5" fill="black" />
        {/* Tonearm: pivot → arm → head */}
        <circle cx="24" cy="10" r="1.2" fill="currentColor" />
        <path
          d="M24 10 L24 12.5 Q24 14 22 15 L18 16.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="18" cy="16.5" r="1" fill="currentColor" />
      </svg>
    </div>
  );
}
