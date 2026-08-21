/** Compact variant of ProjectIntelligenceVisual for smaller panel contexts. */
export default function ProjectIntelligenceVisualCompact({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      role="img"
      aria-label="Compact project intelligence node diagram"
    >
      <defs>
        <radialGradient id="pic-glow" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#009FE3" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#009FE3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="160" height="160" fill="url(#pic-glow)" />
      <g stroke="currentColor" strokeOpacity="0.14" strokeWidth="1">
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`v${i}`} x1={20 + i * 30} y1="20" x2={20 + i * 30} y2="140" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="20" y1={20 + i * 30} x2="140" y2={20 + i * 30} />
        ))}
      </g>
      <rect x="35" y="40" width="55" height="45" rx="8" fill="#009FE3" fillOpacity="0.1" stroke="#009FE3" strokeOpacity="0.4" />
      <rect x="80" y="70" width="45" height="50" rx="8" fill="#0EAA9B" fillOpacity="0.1" stroke="#0EAA9B" strokeOpacity="0.4" />
      <path d="M 60 60 C 75 75, 90 80, 100 90" stroke="#009FE3" strokeWidth="1.5" fill="none" opacity="0.6" />
      <circle cx="60" cy="60" r="3.5" fill="#009FE3" />
      <circle cx="100" cy="90" r="3.5" fill="#0EAA9B" />
      <circle cx="45" cy="105" r="3" fill="#C99A3D" />
    </svg>
  );
}
