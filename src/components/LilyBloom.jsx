// Animated blooming lily (pure SVG + CSS). Petals breathe open/closed in a
// staggered loop so loading screens feel alive.
export default function LilyBloom({ size = 120 }) {
  const petals = [0, 60, 120, 180, 240, 300];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className="bloom-svg"
      role="img"
      aria-label="blooming lily"
    >
      <defs>
        <radialGradient id="bloomPetal" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="55%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#9f1239" />
        </radialGradient>
        <radialGradient id="bloomCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>

      {/* stem + leaves */}
      <path
        d="M100 118 C 101 145, 98 165, 92 185"
        stroke="#4ade80"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M99 150 C 80 145, 66 148, 56 160 C 72 162, 90 160, 99 150" fill="#22c55e" opacity="0.85" />
      <path d="M100 162 C 118 156, 132 158, 142 170 C 126 173, 109 171, 100 162" fill="#16a34a" opacity="0.85" />

      {/* petals */}
      {petals.map((a, i) => (
        <g key={a} transform={`rotate(${a} 100 108)`}>
          <ellipse
            className="bloom-petal"
            cx="100"
            cy="66"
            rx="21"
            ry="44"
            fill="url(#bloomPetal)"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        </g>
      ))}

      {/* glowing heart */}
      <circle className="bloom-core" cx="100" cy="108" r="13" fill="url(#bloomCore)" />
      <circle cx="100" cy="108" r="5" fill="#881337" />
    </svg>
  );
}
