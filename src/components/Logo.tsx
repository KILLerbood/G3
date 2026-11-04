/**
 * G3 mark: two rings that overlap, one forest green and one terracotta: a relationship.
 * Drawn in SVG so it follows the theme and stays sharp at any size.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="14" fill="var(--g-forest)" />
      <circle cx="19.5" cy="24" r="9.5" fill="none" stroke="var(--g-paper)" strokeWidth="3.2" />
      <circle cx="28.5" cy="24" r="9.5" fill="none" stroke="var(--g-clay-2)" strokeWidth="3.2" />
      <path d="M24 16.2a9.5 9.5 0 0 1 0 15.6" fill="none" stroke="var(--g-paper)" strokeWidth="3.2" />
    </svg>
  );
}

/** Mark + «Magmafy» with the product name «علاقات» (Relationships). */
export function Wordmark({ size = 40, suffix }: { size?: number; suffix?: string }) {
  return (
    <span className="wordmark">
      <Logo size={size} />
      <span className="wordmark__text" style={{ fontSize: size * 0.5 }}>
        <b>Magmafy</b>
        <small>{suffix || 'علاقات · Relationships'}</small>
      </span>
    </span>
  );
}
