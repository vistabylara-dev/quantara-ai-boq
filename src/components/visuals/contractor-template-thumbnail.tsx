/** Original SVG thumbnail: dense item-heavy contractor layout, industrial cyan/teal accents. */
export default function ContractorTemplateThumbnail({ className = "" }: { className?: string }) {
  const rows = Array.from({ length: 6 });
  return (
    <svg viewBox="0 0 240 160" className={className} role="img" aria-label="Detailed Contractor BOQ template preview: item-dense technical table with labor and material columns">
      <rect x="0" y="0" width="240" height="160" rx="12" fill="#091326" />
      <rect x="0" y="0" width="240" height="160" rx="12" fill="none" stroke="#21C7F3" strokeOpacity="0.3" />
      <rect x="16" y="16" width="208" height="16" rx="3" fill="#21C7F3" fillOpacity="0.18" />
      <rect x="22" y="21" width="40" height="6" rx="1.5" fill="#21C7F3" />
      <rect x="150" y="21" width="24" height="6" rx="1.5" fill="#29D5C0" />
      <rect x="182" y="21" width="34" height="6" rx="1.5" fill="#29D5C0" />
      {rows.map((_, i) => (
        <g key={i}>
          <rect x="16" y={40 + i * 18} width="208" height="14" rx="2" fill="#F4F8FF" fillOpacity={i % 2 === 0 ? 0.04 : 0.02} />
          <rect x="22" y={44 + i * 18} width="70" height="5" rx="1.5" fill="#F4F8FF" fillOpacity="0.35" />
          <rect x="150" y={44 + i * 18} width="22" height="5" rx="1.5" fill="#21C7F3" fillOpacity="0.6" />
          <rect x="182" y={44 + i * 18} width="30" height="5" rx="1.5" fill="#29D5C0" fillOpacity="0.6" />
        </g>
      ))}
    </svg>
  );
}
