import React from 'react';

interface ITPlatformTwenteLogoProps {
  className?: string;
}

export default function ITPlatformTwenteLogo({ className = 'h-10 w-auto' }: ITPlatformTwenteLogoProps) {
  return (
    <div className={`inline-flex flex-col justify-center select-none ${className}`}>
      <svg 
        viewBox="0 0 260 76" 
        className="w-full h-full overflow-visible"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="IT Platform Twente"
      >
        <text 
          x="130" 
          y="31" 
          textAnchor="middle" 
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
          fontWeight="900" 
          fontSize="32" 
          fill="#171717" 
          letterSpacing="-0.5px"
        >
          IT Platform
        </text>
        <text 
          x="130" 
          y="69" 
          textAnchor="middle" 
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
          fontWeight="900" 
          fontSize="38" 
          fill="#e30613" 
          letterSpacing="-0.5px"
        >
          Twente
        </text>
      </svg>
    </div>
  );
}
