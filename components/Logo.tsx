
import React from 'react';

interface LogoProps {
  className?: string;
  classNameText?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12", classNameText = "text-xl", showText = true }) => {
  return (
    <div className="flex items-center gap-3 select-none group cursor-default">
      {/* SVG Logo Mark */}
      <div className={`relative ${className} transition-transform duration-500 ease-out group-hover:scale-110 flex items-center justify-center`}>
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="nv-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="nv-shine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
            </linearGradient>
          </defs>
          {/* Hexagonal base */}
          <path d="M32 2L58 17V47L32 62L6 47V17L32 2Z" fill="url(#nv-grad)" />
          {/* Shine overlay */}
          <path d="M32 2L58 17V47L32 62L6 47V17L32 2Z" fill="url(#nv-shine)" />
          {/* "N" letterform */}
          <path d="M22 44V20L30 20L42 38V20L22 44Z" fill="white" opacity="0.95" />
          <path d="M42 20V44L34 44L22 26V44L42 20Z" fill="white" opacity="0.7" />
          {/* Center accent line */}
          <path d="M22 44L42 20" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <span className={`font-black tracking-tight leading-none text-slate-900 dark:text-white ${classNameText}`}>
            Norvexis <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-blue-500">Core</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
