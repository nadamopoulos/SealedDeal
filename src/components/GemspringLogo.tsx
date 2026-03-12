export default function GemspringLogo({ className = 'h-7 w-auto' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Gemspring "gem" icon */}
      <path d="M4 16L12 4L20 16L12 28Z" fill="#0f477b" opacity="0.9" />
      <path d="M12 4L20 16L12 16Z" fill="#1a5c9e" />
      <path d="M12 16L20 16L12 28Z" fill="#0a3359" />
      {/* "GEMSPRING" wordmark */}
      <text x="28" y="14" fontFamily="Geist, -apple-system, sans-serif" fontSize="11" fontWeight="700" letterSpacing="0.08em" fill="#0f477b">
        GEMSPRING
      </text>
      <text x="28" y="26" fontFamily="Geist, -apple-system, sans-serif" fontSize="8" fontWeight="500" letterSpacing="0.15em" fill="#888888">
        CAPITAL
      </text>
    </svg>
  );
}
