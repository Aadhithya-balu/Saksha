import React from 'react';

export const IntelligenceIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 720 640"
    role="img"
    aria-label="SAKSHA secure intelligence core connected to network, case intelligence, geo intelligence and prediction modules"
    className={`lx-intel ${className || ''}`}
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <pattern id="lx-grid" width="28" height="28" patternUnits="userSpaceOnUse">
        <path d="M28 0H0V28" fill="none" stroke="var(--lx-grid)" strokeWidth="1" />
      </pattern>
      <radialGradient id="lx-halo" cx="50%" cy="46%" r="44%">
        <stop offset="0" stopColor="var(--lx-halo-b)" />
        <stop offset="0.52" stopColor="var(--lx-halo-a)" />
        <stop offset="1" stopColor="transparent" />
      </radialGradient>
      <radialGradient id="lx-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="var(--lx-glow-b)" />
        <stop offset="1" stopColor="var(--lx-glow-a)" />
      </radialGradient>
      <linearGradient id="lx-plinth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--lx-plinth)" />
        <stop offset="1" stopColor="var(--lx-plinth-deep)" />
      </linearGradient>
      <linearGradient id="lx-top" x1="0.08" y1="0" x2="0.95" y2="1">
        <stop offset="0" stopColor="var(--lx-face-top-a)" />
        <stop offset="0.5" stopColor="var(--lx-face-top-mid)" />
        <stop offset="1" stopColor="var(--lx-face-top-b)" />
      </linearGradient>
      <linearGradient id="lx-front" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--lx-face-front-a)" />
        <stop offset="0.4" stopColor="var(--lx-face-front-mid)" />
        <stop offset="1" stopColor="var(--lx-face-front-b)" />
      </linearGradient>
      <linearGradient id="lx-side" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--lx-face-side-a)" />
        <stop offset="1" stopColor="var(--lx-face-side-b)" />
      </linearGradient>
      <linearGradient id="lx-shield" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--lx-shield-a)" />
        <stop offset="1" stopColor="var(--lx-shield-b)" />
      </linearGradient>
      <linearGradient id="lx-recess" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--lx-recess-a)" />
        <stop offset="1" stopColor="var(--lx-recess-b)" />
      </linearGradient>
      <linearGradient id="lx-vent" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--lx-face-side-a)" />
        <stop offset="1" stopColor="var(--lx-face-side-b)" />
      </linearGradient>
      <linearGradient id="lx-core-glow-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--lx-glow-b)" />
        <stop offset="1" stopColor="var(--lx-accent)" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="lx-ao" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--lx-shade)" />
        <stop offset="1" stopColor="var(--lx-shade)" stopOpacity="0" />
      </linearGradient>
      <filter id="lx-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <filter id="lx-blur-soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.8" />
      </filter>
      <filter id="lx-blur-h" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>

    {/* Background layers */}
    <rect width="720" height="640" fill="url(#lx-grid)" opacity="0.5" />
    <ellipse cx="358" cy="300" rx="310" ry="260" fill="url(#lx-halo)" />
    <circle cx="358" cy="285" r="222" fill="none" stroke="var(--lx-ring)" strokeDasharray="2 7" className="lx-orbit" />

    {/* Corner brackets */}
    <g stroke="var(--lx-grid)" strokeWidth="1" opacity="0.65">
      <path d="M38 38l10 10M48 38l-10 10" />
      <path d="M676 38l10 10M686 38l-10 10" />
      <path d="M38 596l10 10M48 596l-10 10" />
      <path d="M676 596l10 10M686 596l-10 10" />
      <path d="M30 330v-14M716 330v-14" />
    </g>

    {/* ── Platform plinth ── */}
    <g>
      {/* Back rim shadow */}
      <path d="M214 472a144 22 0 0 0 288 0" fill="none" stroke="var(--lx-bevel-lo)" strokeWidth="1.8" opacity="0.5" />
      {/* Deep platform */}
      <ellipse cx="358" cy="484" rx="172" ry="28" fill="var(--lx-plinth-deep)" />
      {/* Top platform */}
      <ellipse cx="358" cy="472" rx="172" ry="28" fill="url(#lx-plinth)" stroke="var(--lx-edge)" strokeWidth="1.2" />
      {/* Inner bevel */}
      <ellipse cx="358" cy="472" rx="158" ry="23" fill="none" stroke="var(--lx-bevel-hi)" strokeWidth="0.8" opacity="0.45" />
      {/* Inner rotating ring */}
      <ellipse cx="358" cy="472" rx="120" ry="17" fill="none" stroke="var(--lx-ring)" strokeDasharray="2 7" className="lx-orbit-inner" />
      {/* Platform LED dots */}
      <circle cx="196" cy="472" r="1.6" fill="var(--lx-teal)" opacity="0.5" />
      <circle cx="216" cy="459" r="1.6" fill="var(--lx-accent)" opacity="0.4" />
      <circle cx="500" cy="459" r="1.6" fill="var(--lx-teal)" opacity="0.5" />
      <circle cx="520" cy="472" r="1.6" fill="var(--lx-accent)" opacity="0.4" />
      <circle cx="296" cy="446" r="1.6" fill="var(--lx-teal)" opacity="0.45" />
      <circle cx="420" cy="446" r="1.6" fill="var(--lx-teal)" opacity="0.45" />
      {/* Status panel on platform */}
      <rect x="298" y="495" width="14" height="7" rx="3.5" fill="var(--lx-face-side-b)" stroke="var(--lx-edge-soft)" />
      <circle cx="303" cy="498.5" r="1.4" fill="var(--lx-teal)" className="lx-led-pulse" />
      <rect x="354" y="502" width="14" height="7" rx="3.5" fill="var(--lx-face-side-b)" stroke="var(--lx-edge-soft)" />
      <rect x="410" y="495" width="14" height="7" rx="3.5" fill="var(--lx-face-side-b)" stroke="var(--lx-edge-soft)" />
      <circle cx="417" cy="498.5" r="1.4" fill="var(--lx-accent)" opacity="0.6" />
    </g>

    {/* Drop shadow under cube */}
    <ellipse cx="358" cy="432" rx="106" ry="15" fill="var(--lx-core-shadow)" opacity="0.8" filter="url(#lx-shadow)" className="lx-shadow" />

    {/* ── Core cube — isometric solid with real lighting ── */}
    <g className="lx-core-float">
      {/* Energy aura + rotating data ring behind the core */}
      <circle cx="358" cy="340" r="132" fill="none" stroke="var(--lx-ring)" strokeWidth="1" strokeDasharray="3 11" className="lx-halo-pulse" />
      <circle cx="358" cy="340" r="106" fill="none" stroke="var(--lx-ring)" strokeWidth="0.6" opacity="0.7" className="lx-orbit-core" />

      {/* Side face (shadow side — darkest) */}
      <path d="M432 306L484 264V358L432 400Z" fill="url(#lx-side)" />
      {/* Front face (mid tone — turns toward light) */}
      <path d="M280 306L432 306V400L280 400Z" fill="url(#lx-front)" />
      {/* Top face (light catch — brightest) */}
      <path d="M280 306L328 264L484 264L432 306Z" fill="url(#lx-top)" />

      {/* Ambient occlusion — soft shade just under the top lip */}
      <path d="M280 306L432 306V330L280 330Z" fill="url(#lx-ao)" />
      <path d="M432 306L484 264V284L432 328Z" fill="url(#lx-ao)" />

      {/* Edge lighting — clean catch & shade, never hard black */}
      <path d="M280 306L328 264" stroke="var(--lx-catch)" strokeWidth="1.8" />
      <path d="M280 306L432 306" stroke="var(--lx-catch)" strokeWidth="1.5" />
      <path d="M432 306L484 264" stroke="var(--lx-catch)" strokeWidth="1.2" opacity="0.8" />
      <path d="M280 306V400" stroke="var(--lx-catch)" strokeWidth="1.1" opacity="0.5" />
      <path d="M432 306V400" stroke="var(--lx-shade)" strokeWidth="1.2" />
      <path d="M280 400L432 400" stroke="var(--lx-shade)" strokeWidth="1.1" />
      <path d="M484 264V358L432 400" stroke="var(--lx-shade)" strokeWidth="1.1" />
      {/* Reflected rim light along the front bottom edge */}
      <path d="M280 400L432 400" stroke="var(--lx-rim)" strokeWidth="0.9" opacity="0.7" transform="translate(0 -1)" />

      {/* Top face embossed inner edge */}
      <path d="M296 306L338 272L470 272L428 306Z" fill="none" stroke="var(--lx-bevel-hi)" strokeWidth="0.7" opacity="0.4" />

      {/* Side face vertical ribbing */}
      <path d="M464 278V352L444 380L436 372L456 344V280Z" fill="var(--lx-etched)" opacity="0.4" />
      <path d="M450 280v68M456 280v68" stroke="var(--lx-shade)" strokeWidth="0.6" opacity="0.35" />
      <circle cx="454" cy="370" r="2" fill="var(--lx-teal)" opacity="0.7" className="lx-led" />
      <circle cx="462" cy="365" r="1.5" fill="var(--lx-accent)" opacity="0.5" />

      {/* Front face — recessed instrument frame (creates panel depth) */}
      <rect x="288" y="312" width="136" height="80" rx="6" fill="url(#lx-recess)" stroke="var(--lx-edge-soft)" />
      <rect x="296" y="320" width="120" height="64" rx="4" fill="url(#lx-front)" stroke="var(--lx-edge-soft)" opacity="0.9" />

      {/* Glass window with inner glow */}
      <rect x="302" y="322" width="84" height="26" rx="5" fill="url(#lx-recess)" stroke="var(--lx-glass-edge)" />
      <rect x="302" y="322" width="84" height="26" rx="5" fill="url(#lx-core-glow-g)" className="lx-emblem-glow" />
      <path d="M310 329v12" stroke="var(--lx-catch)" strokeWidth="1.4" opacity="0.5" className="lx-scan" />
      <text x="324" y="340" fontSize="5.6" letterSpacing="1.2" fill="var(--lx-label-sub)" fontFamily="var(--font-mono)">CORE-07</text>

      {/* Status LEDs + vent block */}
      <circle cx="312" cy="361" r="2.2" fill="var(--lx-teal)" className="lx-led-pulse" />
      <circle cx="326" cy="361" r="2.2" fill="var(--lx-accent)" />
      <circle cx="340" cy="361" r="2.2" fill="var(--lx-etched)" />
      <text x="356" y="364.5" fontSize="5.4" letterSpacing="1.3" fill="var(--lx-label-sub)" fontFamily="var(--font-mono)">SEC-07</text>
      <rect x="384" y="322" width="34" height="26" rx="5" fill="var(--lx-face-side-b)" stroke="var(--lx-edge-soft)" />
      <path d="M390 330h22M390 336h22M390 342h22" stroke="var(--lx-vent)" strokeWidth="1.3" strokeLinecap="round" />

      {/* Corner rivets */}
      <rect x="280" y="300" width="7" height="7" rx="2" fill="var(--lx-screw)" />
      <rect x="425" y="300" width="7" height="7" rx="2" fill="var(--lx-screw)" />
      <rect x="280" y="393" width="7" height="7" rx="2" fill="var(--lx-screw)" />
      <rect x="425" y="393" width="7" height="7" rx="2" fill="var(--lx-screw)" />
      <rect x="331" y="258" width="7" height="7" rx="2" fill="var(--lx-screw)" />
      <rect x="479" y="258" width="7" height="7" rx="2" fill="var(--lx-screw)" />

      {/* Top edge activity bar */}
      <rect x="294" y="306" width="124" height="2.5" rx="1" fill="var(--lx-accent)" opacity="0.18" />
      <rect x="336" y="306" width="40" height="2.5" rx="1" fill="var(--lx-teal)" opacity="0.45" />

      {/* ── Shield medallion — layered badge floating on the podium ── */}
      <g>
        <circle cx="381" cy="275" r="27" fill="url(#lx-glow)" className="lx-emblem-glow" filter="url(#lx-blur-soft)" />
        <ellipse cx="381" cy="275" rx="30" ry="22" fill="var(--lx-glass)" stroke="var(--lx-edge)" strokeWidth="1" />
        <ellipse cx="381" cy="275" rx="25.5" ry="17.5" fill="none" stroke="var(--lx-ring)" strokeWidth="0.9" />
        <path d="M357 283c2.2-4.6 10-8 24-8M357 267c2.2 4.6 10 8 24 8" fill="none" stroke="var(--lx-teal)" strokeWidth="0.9" opacity="0.5" strokeLinecap="round" />
        <path d="M381 262.5l9.5 4.2V278c0 6.6-4.3 10-9.5 11.6-5.2-1.6-9.5-5-9.5-11.6v-11.3z" fill="url(#lx-shield)" stroke="var(--lx-edge)" strokeWidth="0.8" />
        <path d="M374.8 276.5c2.7-3.7 8.1-3.7 10.8 0-2.7 3.7-8.1 3.7-10.8 0z" fill="none" stroke="var(--lx-teal)" strokeWidth="1.3" />
        <circle cx="380" cy="276.5" r="3.3" fill="var(--lx-accent-strong)" />
        <circle cx="380" cy="276.5" r="1.2" fill="var(--lx-core-dark)" />
        <circle cx="378.2" cy="275" r="0.9" fill="white" opacity="0.35" />
      </g>
    </g>

    {/* ── Module cards ── */}
    <g fontFamily="var(--font-mono)">
      {/* NETWORK card */}
      <g transform="translate(54 120)">
        <rect width="132" height="56" rx="10" fill="var(--lx-card-bg)" stroke="var(--lx-card-bd)" />
        <rect x="0" y="0" width="132" height="2.5" rx="10" fill="var(--lx-teal)" opacity="0.5" />
        <g transform="translate(14 16)">
          <circle cx="3" cy="3" r="3.2" fill="none" stroke="var(--lx-teal)" strokeWidth="1.2" />
          <circle cx="18" cy="10" r="3.2" fill="none" stroke="var(--lx-teal)" strokeWidth="1.2" />
          <circle cx="10" cy="22" r="3.2" fill="none" stroke="var(--lx-teal)" strokeWidth="1.2" />
          <path d="M3 3L18 10M18 10L10 22" fill="none" stroke="var(--lx-teal)" strokeWidth="1.1" />
        </g>
        <text x="44" y="22" fontSize="8" letterSpacing="1.4" fill="var(--lx-label)">NETWORK</text>
        <text x="44" y="36" fontSize="6.2" letterSpacing="1" fill="var(--lx-label-sub)">LINK ANALYSIS</text>
      </g>

      {/* CASE INTEL card */}
      <g transform="translate(534 120)">
        <rect width="132" height="56" rx="10" fill="var(--lx-card-bg)" stroke="var(--lx-card-bd)" />
        <rect x="0" y="0" width="132" height="2.5" rx="10" fill="var(--lx-accent)" opacity="0.45" />
        <rect x="12" y="18" width="22" height="22" rx="2.5" fill="none" stroke="var(--lx-accent)" strokeWidth="1.3" />
        <path d="M14 26h18M14 32h12M14 20h8" stroke="var(--lx-accent)" strokeWidth="1" strokeLinecap="round" />
        <text x="44" y="22" fontSize="8" letterSpacing="1.4" fill="var(--lx-label)">CASE INTEL</text>
        <text x="44" y="36" fontSize="6.2" letterSpacing="1" fill="var(--lx-label-sub)">CASE CORRELATION</text>
      </g>

      {/* GEO INTEL card */}
      <g transform="translate(54 462)">
        <rect width="132" height="56" rx="10" fill="var(--lx-card-bg)" stroke="var(--lx-card-bd)" />
        <rect x="0" y="0" width="132" height="2.5" rx="10" fill="var(--lx-accent)" opacity="0.45" />
        <circle cx="29" cy="29" r="10" fill="none" stroke="var(--lx-accent)" strokeWidth="1.3" />
        <path d="M29 14v-3M29 47v-3M14 29h-3M47 29h-3" stroke="var(--lx-accent)" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="29" cy="29" r="2.6" fill="var(--lx-accent)" />
        <text x="48" y="22" fontSize="8" letterSpacing="1.4" fill="var(--lx-label)">GEO INTEL</text>
        <text x="48" y="36" fontSize="6.2" letterSpacing="1" fill="var(--lx-label-sub)">LOCATION INTEL</text>
      </g>

      {/* PREDICTION card */}
      <g transform="translate(534 462)">
        <rect width="132" height="56" rx="10" fill="var(--lx-card-bg)" stroke="var(--lx-card-bd)" />
        <rect x="0" y="0" width="132" height="2.5" rx="10" fill="var(--lx-teal)" opacity="0.5" />
        <path d="M15 36L26 27l7 6L42 18" fill="none" stroke="var(--lx-teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M37 18h5v5" fill="none" stroke="var(--lx-teal)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="48" y="22" fontSize="8" letterSpacing="1.4" fill="var(--lx-label)">PREDICTION</text>
        <text x="48" y="36" fontSize="6.2" letterSpacing="1" fill="var(--lx-label-sub)">PATTERN FORECAST</text>
      </g>
    </g>

    {/* ── Data pathways (fiber-optic style) ── */}
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Base pathways */}
      <g stroke="var(--lx-path)" strokeWidth="2.2">
        <path d="M120 176v36h64v32h176v22" />
        <path d="M600 176v36h-96v32h-52v22" />
        <path d="M120 490v-34h100v-90h88v-22" />
        <path d="M600 490v-34h-100v-90h-96v-22" />
      </g>
      {/* Animated flow overlay */}
      <g stroke="var(--lx-path-glow)" strokeWidth="1.2" className="lx-flow" strokeDasharray="4 28">
        <path d="M120 176v36h64v32h176v22" />
        <path d="M600 176v36h-96v32h-52v22" />
        <path d="M120 490v-34h100v-90h88v-22" />
        <path d="M600 490v-34h-100v-90h-96v-22" />
      </g>
      {/* Junction nodes with pulsing rings */}
      <g>
        <circle cx="120" cy="176" r="4" fill="var(--lx-accent)" opacity="0.85" />
        <circle cx="120" cy="176" r="7" fill="none" stroke="var(--lx-accent)" strokeWidth="0.7" opacity="0.25" className="lx-pulse-ring-a" />
        <circle cx="360" cy="266" r="4.5" fill="var(--lx-accent)" />
        <circle cx="360" cy="266" r="8" fill="none" stroke="var(--lx-accent)" strokeWidth="0.7" opacity="0.2" className="lx-pulse-ring-b" />
        <circle cx="600" cy="176" r="4" fill="var(--lx-accent)" opacity="0.85" />
        <circle cx="600" cy="176" r="7" fill="none" stroke="var(--lx-accent)" strokeWidth="0.7" opacity="0.25" className="lx-pulse-ring-a" />
        <circle cx="456" cy="266" r="4.5" fill="var(--lx-accent)" />
        <circle cx="456" cy="266" r="8" fill="none" stroke="var(--lx-accent)" strokeWidth="0.7" opacity="0.2" className="lx-pulse-ring-b" />
        <circle cx="120" cy="490" r="4" fill="var(--lx-accent)" opacity="0.85" />
        <circle cx="120" cy="490" r="7" fill="none" stroke="var(--lx-accent)" strokeWidth="0.7" opacity="0.25" className="lx-pulse-ring-a" />
        <circle cx="310" cy="306" r="4.5" fill="var(--lx-accent)" />
        <circle cx="310" cy="306" r="8" fill="none" stroke="var(--lx-accent)" strokeWidth="0.7" opacity="0.2" className="lx-pulse-ring-b" />
        <circle cx="600" cy="490" r="4" fill="var(--lx-accent)" opacity="0.85" />
        <circle cx="600" cy="490" r="7" fill="none" stroke="var(--lx-accent)" strokeWidth="0.7" opacity="0.25" className="lx-pulse-ring-a" />
        <circle cx="410" cy="306" r="4.5" fill="var(--lx-accent)" />
        <circle cx="410" cy="306" r="8" fill="none" stroke="var(--lx-accent)" strokeWidth="0.7" opacity="0.2" className="lx-pulse-ring-b" />
      </g>
    </g>

    {/* ── Caption ── */}
    <g textAnchor="middle" fontFamily="var(--font-mono)">
      <text x="358" y="550" fontSize="8.5" letterSpacing="3" fill="var(--lx-label)">SECURE INTELLIGENCE CORE</text>
      <text x="358" y="564" fontSize="6.4" letterSpacing="2.2" fill="var(--lx-label-sub)">SESSION SECURE&nbsp;&nbsp;/&nbsp;&nbsp;IDENTITY VERIFIED</text>
    </g>
  </svg>
);

export default IntelligenceIllustration;