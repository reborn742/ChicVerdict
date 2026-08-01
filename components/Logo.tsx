
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ className = "", size = 32 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background Circle */}
      <circle cx="50" cy="50" r="48" fill="currentColor" />
      
      {/* The Hook (Verdict/Fashion) */}
      <path 
        d="M50 25C50 25 65 25 65 40C65 55 50 65 50 75" 
        stroke="white" 
        strokeWidth="4" 
        strokeLinecap="round"
      />
      
      {/* The Intertwined CV Concept */}
      <path 
        d="M35 45C35 45 35 65 50 65C65 65 65 45 65 45" 
        stroke="white" 
        strokeWidth="6" 
        strokeLinecap="round"
      />
      
      {/* Elegant Serif Accent */}
      <circle cx="50" cy="78" r="3" fill="#D4AF37" />
    </svg>
  );
};

export default Logo;
