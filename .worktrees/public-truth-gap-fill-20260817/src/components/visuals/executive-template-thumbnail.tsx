/** Original SVG thumbnail: minimal executive cover, restrained gold accent, concise commercial-totals layout. */
export default function ExecutiveTemplateThumbnail({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className} role="img" aria-label="Executive BOQ template preview: minimal premium cover with commercial totals">
      <rect x="0" y="0" width="240" height="160" rx="12" fill="#08152E" />
      <rect x="0" y="0" width="240" height="160" rx="12" fill="none" stroke="#C99A3D" strokeOpacity="0.35" />
      <line x1="28" y1="34" x2="72" y2="34" stroke="#C99A3D" strokeWidth="2" />
      <rect x="28" y="52" width="120" height="10" rx="2" fill="#F4F8FF" fillOpacity="0.9" />
      <rect x="28" y="70" width="80" height="6" rx="2" fill="#F4F8FF" fillOpacity="0.4" />
      <rect x="28" y="104" width="184" height="1" fill="#F4F8FF" fillOpacity="0.15" />
      <rect x="28" y="118" width="90" height="6" rx="2" fill="#F4F8FF" fillOpacity="0.5" />
      <rect x="150" y="118" width="62" height="6" rx="2" fill="#C99A3D" />
      <rect x="28" y="132" width="90" height="6" rx="2" fill="#F4F8FF" fillOpacity="0.3" />
      <rect x="170" y="132" width="42" height="6" rx="2" fill="#F4F8FF" fillOpacity="0.3" />
      <circle cx="212" cy="34" r="5" fill="#C99A3D" fillOpacity="0.7" />
    </svg>
  );
}
