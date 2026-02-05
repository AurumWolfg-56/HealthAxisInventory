
import React from 'react';

interface LogoProps {
  className?: string;
  classNameText?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12", classNameText = "text-xl", showText = true }) => {
  return (
    <div className="flex items-center gap-3 select-none group cursor-default">
      {/* Icon Container with Hover Animation */}
      <div className={`relative ${className} transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-2 flex items-center justify-center`}>
        <img
          src="/logo.png"
          alt="HealthAxis Logo"
          className="w-full h-full object-contain filter drop-shadow-xl"
        />

        {/* Ambient Glow behind logo */}
        <div className="absolute inset-x-0 bottom-0 top-0 bg-medical-500 blur-2xl opacity-20 rounded-full -z-10 group-hover:opacity-40 transition-opacity duration-500"></div>
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <span className={`font-black tracking-tighter leading-none text-slate-900 dark:text-white ${classNameText}`}>
            HEALTH<span className="text-transparent bg-clip-text bg-gradient-to-r from-medical-500 to-blue-600">AXIS</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
