/** The thread is decorative; the wordmark supplies the accessible name. */
export function Brand() {
  return (
    <span className="brand" aria-label="Mitos">
      <span className="wordmark" aria-hidden="true">
        mitos
      </span>
      <svg className="brand-thread" viewBox="0 0 151 28" fill="none" aria-hidden="true">
        <path
          d="M2 17C18 1 43 1 46 13C50 27 12 27 14 16C16 5 44 8 64 17C85 28 101 18 92 12C85 7 72 11 78 17C87 25 109 18 113 14C121 7 131 12 125 16C119 20 137 19 149 9"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
