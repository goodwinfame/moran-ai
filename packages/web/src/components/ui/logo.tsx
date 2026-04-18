import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 24, className, ...props }: LogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 512 512" 
      fill="none" 
      className={className}
      {...props}
    >
      <defs>
        <radialGradient id="core" cx="256" cy="244" r="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A202C" stopOpacity="1.0"/>
          <stop offset="0.8" stopColor="#1A202C" stopOpacity="0.92"/>
          <stop offset="1" stopColor="#2D3748" stopOpacity="0.80"/>
        </radialGradient>
        <radialGradient id="ring1" cx="256" cy="250" r="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A202C" stopOpacity="0.55"/>
          <stop offset="0.7" stopColor="#2D3748" stopOpacity="0.28"/>
          <stop offset="1" stopColor="#2D3748" stopOpacity="0.12"/>
        </radialGradient>
        <radialGradient id="ring2" cx="256" cy="256" r="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2D3748" stopOpacity="0.32"/>
          <stop offset="0.6" stopColor="#3D5A6E" stopOpacity="0.16"/>
          <stop offset="1" stopColor="#3D5A6E" stopOpacity="0.04"/>
        </radialGradient>
        <radialGradient id="ring3" cx="256" cy="260" r="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D5A6E" stopOpacity="0.18"/>
          <stop offset="0.5" stopColor="#4A6B7A" stopOpacity="0.08"/>
          <stop offset="1" stopColor="#4A6B7A" stopOpacity="0.02"/>
        </radialGradient>
      </defs>
      <path d="M256 52 Q420 172, 460 256 Q420 340, 256 460 Q92 340, 52 256 Q92 172, 256 52 Z" fill="url(#ring3)"/>
      <path d="M256 96 Q392 186, 416 256 Q392 326, 256 416 Q120 326, 96 256 Q120 186, 256 96 Z" fill="url(#ring2)"/>
      <path d="M256 152 Q348 204, 360 256 Q348 308, 256 360 Q164 308, 152 256 Q164 204, 256 152 Z" fill="url(#ring1)"/>
      <path d="M256 196 Q304 224, 316 256 Q304 288, 256 316 Q208 288, 196 256 Q208 224, 256 196 Z" fill="url(#core)"/>
    </svg>
  );
}

interface LogoTextProps extends React.SVGProps<SVGSVGElement> {
  height?: number;
  className?: string;
}

export function LogoText({ height = 32, className, ...props }: LogoTextProps) {
  const width = height * 4.5;
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 360 80" 
      fill="none" 
      className={className}
      {...props}
    >
      <defs>
        <radialGradient id="ib_core" cx="40" cy="38" r="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A202C" stopOpacity="1.0"/>
          <stop offset="1" stopColor="#2D3748" stopOpacity="0.80"/>
        </radialGradient>
        <radialGradient id="ib_r1" cx="40" cy="39" r="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A202C" stopOpacity="0.50"/>
          <stop offset="1" stopColor="#2D3748" stopOpacity="0.10"/>
        </radialGradient>
        <radialGradient id="ib_r2" cx="40" cy="40" r="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3D5A6E" stopOpacity="0.28"/>
          <stop offset="1" stopColor="#3D5A6E" stopOpacity="0.03"/>
        </radialGradient>
      </defs>

      <g transform="translate(0, 0)">
        <path d="M40 8 Q68 26, 72 40 Q68 54, 40 72 Q12 54, 8 40 Q12 26, 40 8 Z" fill="url(#ib_r2)"/>
        <path d="M40 16 Q60 30, 64 40 Q60 50, 40 64 Q20 50, 16 40 Q20 30, 40 16 Z" fill="url(#ib_r1)"/>
        <path d="M40 28 Q50 34, 52 40 Q50 46, 40 52 Q30 46, 28 40 Q30 34, 40 28 Z" fill="url(#ib_core)"/>
      </g>

      <text x="88" y="42" fontFamily="'Noto Serif SC', 'Source Han Serif SC', serif" fontSize="34" fontWeight="600" fill="#1A202C" letterSpacing="6">墨染</text>
      <text x="90" y="64" fontFamily="'Manrope', 'Inter', sans-serif" fontSize="14" fontWeight="400" fill="#1A202C" fillOpacity="0.45" letterSpacing="8">MORAN</text>
    </svg>
  );
}