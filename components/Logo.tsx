
import React from 'react';

interface LogoProps {
  className?: string;
  classNameText?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12", classNameText = "text-xl", showText = true }) => {
  return (
    <div className="flex items-center gap-3 select-none group cursor-default">
      {/* Icon Container */}
      <div className={`relative ${className} transition-transform duration-500 ease-out group-hover:scale-110 flex items-center justify-center`}>
        <img
          src="/logo.png"
          alt="Norvexis Core"
          className="w-full h-full object-contain"
        />
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <span className={`font-black tracking-tight leading-none text-slate-900 dark:text-white ${classNameText}`}>
            Norvexis <span className="text-transparent bg-clip-text bg-gradient-to-r from-medical-500 to-blue-600">Core</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
