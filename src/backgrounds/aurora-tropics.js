export function createAuroraLayers(namespace) {
  return ["one", "two", "three"].map((layer) => {
    const gradient = `${namespace}-${layer}`;
    return `
      <svg class="aurora aurora--${layer}" viewBox="0 0 1440 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="${gradient}" gradientUnits="userSpaceOnUse" x1="680" y1="-40" x2="850" y2="390">
            <stop stop-color="var(--aurora-violet)" stop-opacity="0"/>
            <stop offset=".28" stop-color="var(--aurora-teal)" stop-opacity=".12"/>
            <stop offset=".58" stop-color="var(--aurora-mint)" stop-opacity=".3"/>
            <stop offset=".85" stop-color="var(--aurora-mint)" stop-opacity=".7"/>
            <stop offset="1" stop-color="var(--aurora-highlight)" stop-opacity=".8"/>
          </linearGradient>
          <filter id="${gradient}-texture" x="-10%" y="-15%" width="120%" height="130%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".045 .003" numOctaves="2" seed="12" result="noise"/>
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.5 0 0 0 -.15" result="texture"/>
            <feComposite in="SourceGraphic" in2="texture" operator="in" result="textured"/>
            <feDisplacementMap in="textured" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
        <g class="aurora__curtain" fill="url(#${gradient})" filter="url(#${gradient}-texture)">
          <path class="aurora__veil" d="M-120-80H1560V70C1370 20 1250 80 1150 180S1010 400 870 340S760 160 660 210S520 300 430 220S320 60 200 110S20 220-120 100Z"/>
          <g class="aurora__folds">
            <path d="M210-80C220 30 280 70 330 140S410 240 470 250C410 210 410 150 370 100S340-10 350-80Z" opacity=".45"/>
            <path d="M430-80C420 60 520 120 570 210S650 285 700 245C620 270 640 190 590 110S550 0 565-80Z" opacity=".7"/>
            <path d="M700-80C650 40 720 120 775 235S825 355 910 357C850 325 855 265 820 190S780 30 820-80Z"/>
            <path d="M970-80C1000 60 950 150 945 255S1005 350 1070 300C990 325 1010 225 1030 150S1080 0 1060-80Z" opacity=".8"/>
            <path d="M1240-80C1220 30 1110 90 1090 180S1100 245 1155 200C1120 215 1150 140 1190 100S1320 20 1330-80Z" opacity=".5"/>
            <g fill="none" stroke="url(#${gradient})" stroke-linecap="round" opacity=".8">
              <path d="M460-70C440 50 520 120 586 220S650 280 690 250" stroke-width="6"/>
              <path d="M520-60C485 60 580 170 610 220S658 260 680 250" stroke-width="4"/>
              <path d="M730-70C690 60 760 160 810 270S850 350 900 356" stroke-width="8"/>
              <path d="M770-60C725 60 800 190 840 275S857 330 880 347" stroke-width="5"/>
              <path d="M1010-70C1030 60 975 150 980 245S1010 330 1050 307" stroke-width="7"/>
              <path d="M1250-70C1210 55 1130 90 1115 188" stroke-width="5"/>
            </g>
          </g>
        </g>
      </svg>
    `;
  }).join("");
}

export const AURORA_LAYERS = createAuroraLayers("aurora");

export const AURORA_TROPICS_LAYERS = `
  ${AURORA_LAYERS}
  <div class="tropics"></div>
  <div class="stars"></div>
  <div class="horizon"></div>
`;

export const auroraTropics = {
  markup: AURORA_TROPICS_LAYERS
};
