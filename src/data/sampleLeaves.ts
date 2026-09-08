export interface SampleLeaf {
  id: string;
  name: string;
  condition: string;
  isDiseased: boolean;
  dataUrl: string;
}

// Crisp visual SVG representations converted to base64 data URLs for immediate testing
function createLeafSvg(type: 'early-blight' | 'healthy-basil' | 'leaf-curl' | 'powdery-mildew'): string {
  let svgContent = '';

  if (type === 'early-blight') {
    // Tomato Leaf with dark brown necrotic concentric lesions and yellow halo
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <radialGradient id="halo1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#451a03" />
          <stop offset="40%" stop-color="#78350f" />
          <stop offset="75%" stop-color="#ca8a04" />
          <stop offset="100%" stop-color="#3f6212" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="halo2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#3e1a07" />
          <stop offset="50%" stop-color="#854d0e" />
          <stop offset="85%" stop-color="#eab308" />
          <stop offset="100%" stop-color="#3f6212" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="stemGrad" x1="0%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stop-color="#365314" />
          <stop offset="100%" stop-color="#4d7c0f" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="#f4f4f0" />
      <!-- Main leaf shape -->
      <path d="M 200,40 C 270,90 320,180 270,290 C 240,350 210,360 200,380 C 190,360 160,350 130,290 C 80,180 130,90 200,40 Z" fill="#4d7c0f" stroke="#365314" stroke-width="4" />
      <!-- Central vein -->
      <path d="M 200,45 Q 202,200 200,380" stroke="#a3e635" stroke-width="4" fill="none" stroke-linecap="round" />
      <!-- Lateral veins -->
      <path d="M 200,100 Q 235,85 270,120" stroke="#84cc16" stroke-width="2.5" fill="none" />
      <path d="M 200,100 Q 165,85 130,120" stroke="#84cc16" stroke-width="2.5" fill="none" />
      <path d="M 200,160 Q 245,145 285,185" stroke="#84cc16" stroke-width="2.5" fill="none" />
      <path d="M 200,160 Q 155,145 115,185" stroke="#84cc16" stroke-width="2.5" fill="none" />
      <path d="M 200,230 Q 235,220 260,260" stroke="#84cc16" stroke-width="2" fill="none" />
      <path d="M 200,230 Q 165,220 140,260" stroke="#84cc16" stroke-width="2" fill="none" />
      <!-- Early Blight Necrotic Spots with Target Rings -->
      <circle cx="230" cy="150" r="34" fill="url(#halo1)" />
      <circle cx="230" cy="150" r="22" fill="#451a03" stroke="#291102" stroke-width="1.5" />
      <circle cx="230" cy="150" r="14" fill="#78350f" stroke="#291102" stroke-width="1" />
      <circle cx="230" cy="150" r="6" fill="#1c0b02" />
      <!-- Spot 2 -->
      <circle cx="160" cy="220" r="28" fill="url(#halo2)" />
      <circle cx="160" cy="220" r="17" fill="#451a03" stroke="#291102" stroke-width="1" />
      <circle cx="160" cy="220" r="8" fill="#1c0b02" />
      <!-- Spot 3 -->
      <circle cx="215" cy="280" r="20" fill="url(#halo2)" />
      <circle cx="215" cy="280" r="11" fill="#451a03" />
      <!-- Yellowing tip / margin chlorosis -->
      <path d="M 200,40 C 220,55 240,75 240,95 C 220,80 200,70 190,60 Z" fill="#eab308" opacity="0.8" />
    </svg>`;
  } else if (type === 'healthy-basil') {
    // Vibrant healthy emerald green leaf with pristine venation
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <linearGradient id="basilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#22c55e" />
          <stop offset="60%" stop-color="#15803d" />
          <stop offset="100%" stop-color="#166534" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="#f4f4f0" />
      <!-- Oval pristine basil leaf with subtle gloss -->
      <path d="M 200,50 C 290,110 320,230 250,330 C 220,370 205,380 200,385 C 195,380 180,370 150,330 C 80,230 110,110 200,50 Z" fill="url(#basilGrad)" stroke="#14532d" stroke-width="3.5" />
      <!-- Main vein -->
      <path d="M 200,55 Q 198,220 200,385" stroke="#86efac" stroke-width="4.5" fill="none" stroke-linecap="round" />
      <!-- Fine lateral veins -->
      <path d="M 200,110 Q 240,115 270,160" stroke="#4ade80" stroke-width="2.5" fill="none" />
      <path d="M 200,110 Q 160,115 130,160" stroke="#4ade80" stroke-width="2.5" fill="none" />
      <path d="M 200,170 Q 250,185 280,235" stroke="#4ade80" stroke-width="2.5" fill="none" />
      <path d="M 200,170 Q 150,185 120,235" stroke="#4ade80" stroke-width="2.5" fill="none" />
      <path d="M 200,240 Q 240,255 260,295" stroke="#4ade80" stroke-width="2" fill="none" />
      <path d="M 200,240 Q 160,255 140,295" stroke="#4ade80" stroke-width="2" fill="none" />
      <!-- Natural leaf gloss -->
      <ellipse cx="170" cy="130" rx="25" ry="50" transform="rotate(-25 170 130)" fill="#ffffff" opacity="0.12" />
    </svg>`;
  } else if (type === 'leaf-curl') {
    // Cotton / Chilli leaf curl with distorted wavy margins and vein enation
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <radialGradient id="curlShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#14532d" />
          <stop offset="100%" stop-color="#3f6212" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="#f4f4f0" />
      <!-- Distorted curled leaf edge -->
      <path d="M 200,45 C 250,70 285,110 270,150 C 255,190 295,210 265,270 C 235,330 215,360 200,380 C 185,360 165,330 135,270 C 105,210 145,190 130,150 C 115,110 150,70 200,45 Z" fill="#65a30d" stroke="#365314" stroke-width="3" />
      <!-- Puckered curled ridges -->
      <path d="M 200,50 Q 210,210 200,380" stroke="#d9f99d" stroke-width="6" fill="none" stroke-linecap="round" />
      <path d="M 200,120 Q 260,110 250,170" stroke="#bbf7d0" stroke-width="4.5" fill="none" />
      <path d="M 200,120 Q 140,110 150,170" stroke="#bbf7d0" stroke-width="4.5" fill="none" />
      <path d="M 200,200 Q 270,195 245,260" stroke="#bbf7d0" stroke-width="4" fill="none" />
      <path d="M 200,200 Q 130,195 155,260" stroke="#bbf7d0" stroke-width="4" fill="none" />
      <!-- Thickened enations and crinkling shading -->
      <path d="M 170,140 Q 190,165 180,200" stroke="#166534" stroke-width="3" fill="none" opacity="0.6" />
      <path d="M 230,140 Q 210,165 220,200" stroke="#166534" stroke-width="3" fill="none" opacity="0.6" />
      <path d="M 255,160 C 285,185 270,230 255,250" fill="#365314" opacity="0.3" />
      <path d="M 145,160 C 115,185 130,230 145,250" fill="#365314" opacity="0.3" />
    </svg>`;
  } else {
    // Powdery Mildew: White powdery fungal dusting over green leaf
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <radialGradient id="mildew" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
          <stop offset="50%" stop-color="#f8fafc" stop-opacity="0.65" />
          <stop offset="85%" stop-color="#e2e8f0" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#15803d" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="#f4f4f0" />
      <!-- Rose leaf -->
      <path d="M 200,45 C 280,100 310,210 250,310 C 225,350 210,365 200,380 C 190,365 175,350 150,310 C 90,210 120,100 200,45 Z" fill="#2d6a4f" stroke="#1b4332" stroke-width="3.5" />
      <!-- Veins -->
      <path d="M 200,50 Q 200,200 200,380" stroke="#74c69d" stroke-width="3.5" fill="none" />
      <path d="M 200,120 Q 240,110 270,150" stroke="#52b788" stroke-width="2" fill="none" />
      <path d="M 200,120 Q 160,110 130,150" stroke="#52b788" stroke-width="2" fill="none" />
      <path d="M 200,190 Q 250,180 275,230" stroke="#52b788" stroke-width="2" fill="none" />
      <path d="M 200,190 Q 150,180 125,230" stroke="#52b788" stroke-width="2" fill="none" />
      <!-- Powdery Mildew patches -->
      <circle cx="180" cy="130" r="45" fill="url(#mildew)" />
      <circle cx="230" cy="180" r="55" fill="url(#mildew)" />
      <circle cx="160" cy="240" r="40" fill="url(#mildew)" />
      <circle cx="220" cy="270" r="35" fill="url(#mildew)" />
      <circle cx="195" cy="90" r="25" fill="url(#mildew)" />
    </svg>`;
  }

  // Base64 encode the SVG string
  const base64 = typeof btoa !== 'undefined'
    ? btoa(unescape(encodeURIComponent(svgContent)))
    : Buffer.from(svgContent).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export const SAMPLE_LEAVES: SampleLeaf[] = [
  {
    id: 'sample-early-blight',
    name: 'Tomato Leaf',
    condition: 'Early Blight (Target Spots)',
    isDiseased: true,
    dataUrl: createLeafSvg('early-blight'),
  },
  {
    id: 'sample-healthy-basil',
    name: 'Sweet Basil Leaf',
    condition: 'Healthy Leaf (No Disease)',
    isDiseased: false,
    dataUrl: createLeafSvg('healthy-basil'),
  },
  {
    id: 'sample-leaf-curl',
    name: 'Cotton / Chilli Leaf',
    condition: 'Leaf Curl Virus & Thickening',
    isDiseased: true,
    dataUrl: createLeafSvg('leaf-curl'),
  },
  {
    id: 'sample-powdery-mildew',
    name: 'Rose Leaf',
    condition: 'Powdery Mildew (White Patches)',
    isDiseased: true,
    dataUrl: createLeafSvg('powdery-mildew'),
  },
];
