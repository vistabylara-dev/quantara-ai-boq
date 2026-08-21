/**
 * Original, hand-authored SVG illustration (not a photo or generative-model
 * output — this environment has no image-generation tool). Abstract
 * floor-plan grid with project nodes and measurement lines, translating the
 * "layered glass / cyan illumination / gold accent" brief into a real,
 * theme-aware, infinitely-scalable web asset instead of a raster stock image.
 */
export default function ProjectIntelligenceVisual({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 480"
      className={className}
      role="img"
      aria-label="Abstract construction project intelligence visualization: a floor-plan grid connected by data nodes"
    >
      <defs>
        <radialGradient id="pi-glow" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#009FE3" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#009FE3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pi-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#009FE3" />
          <stop offset="100%" stopColor="#0EAA9B" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="480" height="480" fill="url(#pi-glow)" />

      {/* Floor-plan grid */}
      <g stroke="currentColor" strokeOpacity="0.14" strokeWidth="1">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={60 + i * 45} y1="60" x2={60 + i * 45} y2="420" />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h${i}`} x1="60" y1={60 + i * 45} x2="420" y2={60 + i * 45} />
        ))}
      </g>

      {/* Layered glass panels representing project zones */}
      <rect x="90" y="100" width="140" height="100" rx="14" fill="#009FE3" fillOpacity="0.08" stroke="#009FE3" strokeOpacity="0.35" />
      <rect x="255" y="150" width="130" height="150" rx="14" fill="#0EAA9B" fillOpacity="0.08" stroke="#0EAA9B" strokeOpacity="0.35" />
      <rect x="120" y="255" width="110" height="110" rx="14" fill="#C99A3D" fillOpacity="0.06" stroke="#C99A3D" strokeOpacity="0.3" />

      {/* Connective data lines between nodes */}
      <path d="M 160 150 C 200 190, 260 190, 320 225" stroke="url(#pi-line)" strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M 175 305 C 220 280, 260 260, 300 240" stroke="url(#pi-line)" strokeWidth="1.5" fill="none" opacity="0.6" />

      {/* Nodes */}
      <circle cx="160" cy="150" r="5" fill="#009FE3" />
      <circle cx="320" cy="225" r="5" fill="#0EAA9B" />
      <circle cx="175" cy="305" r="4" fill="#C99A3D" />
      <circle cx="300" cy="240" r="4" fill="#009FE3" />

      {/* Measurement tick marks */}
      <g stroke="currentColor" strokeOpacity="0.25" strokeWidth="1">
        <line x1="90" y1="90" x2="230" y2="90" />
        <line x1="90" y1="85" x2="90" y2="95" />
        <line x1="230" y1="85" x2="230" y2="95" />
      </g>
    </svg>
  );
}
