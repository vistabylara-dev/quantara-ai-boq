/** Original SVG line-art illustration: an abstract architectural floor plan, for the drawings empty state. */
export default function ArchitecturalDrawingVisual({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={className} role="img" aria-label="Line-art illustration of an architectural floor plan, ready for your first drawing upload">
      <rect x="20" y="20" width="160" height="100" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <line x1="90" y1="20" x2="90" y2="70" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" />
      <line x1="90" y1="70" x2="180" y2="70" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" />
      <line x1="130" y1="70" x2="130" y2="120" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" />
      <path d="M 20 40 A 20 20 0 0 1 40 20" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <path d="M 90 70 A 15 15 0 0 1 105 85" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <g stroke="#009FE3" strokeOpacity="0.5" strokeWidth="1">
        <line x1="20" y1="10" x2="90" y2="10" />
        <line x1="20" y1="7" x2="20" y2="13" />
        <line x1="90" y1="7" x2="90" y2="13" />
      </g>
      <circle cx="55" cy="45" r="2" fill="#0EAA9B" />
      <circle cx="150" cy="95" r="2" fill="#C99A3D" />
      <text x="30" y="35" fontSize="6" fill="currentColor" fillOpacity="0.3" fontFamily="monospace">A-101</text>
    </svg>
  );
}
