/** Original SVG thumbnail: formal consultant layout, deep navy with revision control and a signature block. */
export default function ConsultantTemplateThumbnail({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className} role="img" aria-label="Consultant BOQ template preview: formal structure with revision control and signature section">
      <rect x="0" y="0" width="240" height="160" rx="12" fill="#040A16" />
      <rect x="0" y="0" width="240" height="160" rx="12" fill="none" stroke="#DDB35E" strokeOpacity="0.25" />
      <rect x="16" y="16" width="208" height="1" fill="#DDB35E" fillOpacity="0.4" />
      <rect x="16" y="24" width="100" height="7" rx="1.5" fill="#F4F8FF" fillOpacity="0.85" />
      <rect x="176" y="24" width="48" height="7" rx="1.5" fill="#DDB35E" fillOpacity="0.6" />
      <rect x="16" y="46" width="208" height="42" rx="4" fill="#101D34" stroke="#20304D" />
      <rect x="24" y="54" width="60" height="5" rx="1.5" fill="#F4F8FF" fillOpacity="0.4" />
      <rect x="24" y="64" width="90" height="5" rx="1.5" fill="#F4F8FF" fillOpacity="0.25" />
      <rect x="24" y="74" width="70" height="5" rx="1.5" fill="#F4F8FF" fillOpacity="0.25" />
      <rect x="150" y="54" width="60" height="20" rx="3" fill="#DDB35E" fillOpacity="0.08" stroke="#DDB35E" strokeOpacity="0.4" />
      <rect x="16" y="102" width="90" height="5" rx="1.5" fill="#F4F8FF" fillOpacity="0.3" />
      <rect x="16" y="112" width="120" height="5" rx="1.5" fill="#F4F8FF" fillOpacity="0.2" />
      <line x1="16" y1="132" x2="90" y2="132" stroke="#F4F8FF" strokeOpacity="0.3" />
      <line x1="150" y1="132" x2="224" y2="132" stroke="#F4F8FF" strokeOpacity="0.3" />
      <rect x="16" y="138" width="60" height="5" rx="1.5" fill="#F4F8FF" fillOpacity="0.35" />
      <rect x="150" y="138" width="60" height="5" rx="1.5" fill="#F4F8FF" fillOpacity="0.35" />
    </svg>
  );
}
