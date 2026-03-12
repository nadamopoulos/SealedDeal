export default function SealedDealLogo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Seal mark — outer ring with notch detail */}
      <circle cx="18" cy="18" r="16" fill="#0f477b" />
      <circle cx="18" cy="18" r="11.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      {/* Check mark — the "sealed" confirmation */}
      <path
        d="M12 18.5l4 4 8.5-9"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* "SealedDeal" wordmark */}
      <text
        x="42"
        y="23"
        fontFamily="Geist, -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize="17"
        fontWeight="700"
        letterSpacing="-0.02em"
        fill="#171717"
      >
        Sealed
        <tspan fill="#0f477b">Deal</tspan>
      </text>
    </svg>
  );
}
