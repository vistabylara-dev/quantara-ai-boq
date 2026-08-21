/** Original SVG illustration: abstract blueprint with a scan-line accent, for drawing-analysis contexts. */
export default function DrawingAnalysisVisual({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} role="img" aria-label="Abstract technical drawing being scanned for data extraction">
      <rect x="14" y="10" width="92" height="70" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.25" />
      <g stroke="currentColor" strokeOpacity="0.12" strokeWidth="1">
        <line x1="14" y1="30" x2="106" y2="30" />
        <line x1="14" y1="50" x2="106" y2="50" />
        <line x1="14" y1="65" x2="106" y2="65" />
        <line x1="40" y1="10" x2="40" y2="80" />
        <line x1="72" y1="10" x2="72" y2="80" />
      </g>
      <rect x="22" y="18" width="14" height="8" rx="2" fill="#0EAA9B" fillOpacity="0.35" />
      <rect x="46" y="34" width="20" height="12" rx="2" fill="#009FE3" fillOpacity="0.3" />
      <rect x="78" y="54" width="18" height="10" rx="2" fill="#C99A3D" fillOpacity="0.25" />
      <rect x="14" y="42" width="92" height="3" fill="#009FE3" fillOpacity="0.55" />
    </svg>
  );
}
