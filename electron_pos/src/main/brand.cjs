function getBrandLogoSvg(variant = "gold", sizeClass = "w-24 h-24") {
  const isMono = variant === "mono";
  const uid = "logo_" + Math.random().toString(36).slice(2, 7);
  const strokeMain = isMono ? "#111111" : `url(#${uid}_grad)`;
  const fillStar = isMono ? "#111111" : "#FFF8DC";
  const fillCupStar = isMono ? "#111111" : `url(#${uid}_grad)`;
  const cupFill = isMono ? "rgba(0,0,0,0.06)" : "rgba(212,175,55,0.12)";
  return `
        <svg class="${sizeClass} mx-auto" viewBox="0 0 180 185" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${
            !isMono
              ? `
          <defs>
            <linearGradient id="${uid}_grad" x1="40" y1="15" x2="140" y2="165" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFF3C4"/>
              <stop offset="35%" stop-color="#E6C252"/>
              <stop offset="70%" stop-color="#C59B27"/>
              <stop offset="100%" stop-color="#8A6B12"/>
            </linearGradient>
          </defs>`
              : ""
          }
          <!-- S Ribbon Upper & Lower Curves -->
          <path d="M116 25C92 14 66 22 65 40C64 58 118 60 118 83C118 102 96 112 72 109C56 107 48 96 50 81C52 69 64 61 84 61" stroke="${strokeMain}" stroke-width="7.5" stroke-linecap="round"/>
          <path d="M107 34C95 30 85 35 85 43C85 50 93 53 99 53" stroke="${strokeMain}" stroke-width="3.2" stroke-linecap="round"/>
          <!-- Coffee Cup -->
          <path d="M64 71H106C106 90 96 101 85 101C74 101 64 90 64 71Z" stroke="${strokeMain}" stroke-width="4.2" fill="${cupFill}"/>
          <!-- Cup Handle -->
          <path d="M106 75H113C117.5 75 120.5 78.5 120.5 82.5C120.5 86.5 117.5 90 113 90H104" stroke="${strokeMain}" stroke-width="4" stroke-linecap="round"/>
          <!-- Decorative Outer Swirl & Bottom Point -->
          <path d="M58 68C51 81 57 98 75 107L82 115L85 107" stroke="${strokeMain}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- 4-Point Diamond Star Inside Cup -->
          <path d="M85 78L87.8 84.2L94 87L87.8 89.8L85 96L82.2 89.8L76 87L82.2 84.2L85 78Z" fill="${fillCupStar}"/>
          <!-- Top Right Sparkle Star on Tip of S -->
          <path d="M119 11L121.5 20.5L131 23L121.5 25.5L119 35L116.5 25.5L107 23L116.5 20.5L119 11Z" fill="${fillStar}"/>
          <line x1="110" y1="14" x2="128" y2="32" stroke="${fillStar}" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="128" y1="14" x2="110" y2="32" stroke="${fillStar}" stroke-width="1.2" stroke-linecap="round"/>
          <!-- Typography: café SELECTION TIZNIT -->
          <text x="90" y="133" text-anchor="middle" fill="${isMono ? "#111111" : "#E6C252"}" font-family="'Playfair Display', Georgia, serif" font-size="18" font-weight="600" letter-spacing="1">café</text>
          <text x="90" y="156" text-anchor="middle" fill="${isMono ? "#111111" : "#F3E5AB"}" font-family="'Playfair Display', Georgia, serif" font-size="22" font-weight="700" letter-spacing="2.5">SELECTION</text>
          <line x1="36" y1="171" x2="62" y2="171" stroke="${isMono ? "#333333" : "#C59B27"}" stroke-width="1.2"/>
          <text x="90" y="175" text-anchor="middle" fill="${isMono ? "#111111" : "#D4AF37"}" font-family="sans-serif" font-size="10.5" font-weight="700" letter-spacing="3.5">TIZNIT</text>
          <line x1="118" y1="171" x2="144" y2="171" stroke="${isMono ? "#333333" : "#C59B27"}" stroke-width="1.2"/>
        </svg>
      `;
}
module.exports = { getBrandLogoSvg };
