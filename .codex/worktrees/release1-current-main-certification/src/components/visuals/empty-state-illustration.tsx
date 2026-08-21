/** Original SVG illustration for premium empty states: a dashed connective node diagram, not a cartoon. */
export default function EmptyStateIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} role="img" aria-label="Illustration representing an empty workspace, ready for new data">
      <defs>
        <radialGradient id="es-glow" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#009FE3" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#009FE3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="120" height="90" fill="url(#es-glow)" />
      <rect x="24" y="24" width="34" height="26" rx="5" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
      <rect x="66" y="40" width="30" height="24" rx="5" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
      <path d="M 46 40 C 52 46, 58 46, 66 50" stroke="#009FE3" strokeOpacity="0.5" strokeWidth="1.5" fill="none" />
      <circle cx="46" cy="40" r="3" fill="#009FE3" fillOpacity="0.7" />
      <circle cx="66" cy="50" r="3" fill="#0EAA9B" fillOpacity="0.7" />
    </svg>
  );
}
