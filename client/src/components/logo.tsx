export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Визор" role="img">
      <rect x="2" y="2" width="28" height="28" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <rect x="9" y="17" width="3.5" height="6" rx="1" fill="currentColor" />
      <rect x="14.25" y="12" width="3.5" height="11" rx="1" fill="currentColor" />
      <rect x="19.5" y="8" width="3.5" height="15" rx="1" fill="currentColor" />
    </svg>
  );
}
