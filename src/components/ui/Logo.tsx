import React from 'react';

interface LogoProps {
  className?: string;
  iconSize?: 'sm' | 'md';
  textSize?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
}

export default function Logo({
  className = '',
  iconSize = 'md',
  textSize = 'md',
  iconOnly = false,
}: LogoProps) {
  const iconHeightClass = iconSize === 'sm' ? 'h-6' : 'h-8 pb-0.5';
  const leftBarSizeClass = iconSize === 'sm' ? 'w-[7px] h-[13px]' : 'w-[9px] h-[18px]';
  const rightBarSizeClass = iconSize === 'sm' ? 'w-[7px] h-[19px]' : 'w-[9px] h-[26px]';
  const gapClass = iconSize === 'sm' ? 'gap-[3px]' : 'gap-[4px]';

  const textClassMap = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
  };

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Icon: Two rounded rectangles aligning at the bottom */}
      <div className={`flex items-end ${gapClass} ${iconHeightClass} shrink-0`}>
        {/* Shorter left rectangle */}
        <div
          className={`${leftBarSizeClass} rounded-[2.5px] bg-[#4E46E5] dark:bg-[#B4A9FB] transition-colors duration-300`}
        />
        {/* Taller right rectangle */}
        <div
          className={`${rightBarSizeClass} rounded-[2.5px] bg-[#8F84F8] dark:bg-[#B4A9FB] transition-colors duration-300`}
        />
      </div>

      {!iconOnly && (
        <span className={`font-display font-semibold tracking-tight ${textClassMap[textSize]} flex items-baseline leading-none`}>
          <span className="font-extrabold text-text transition-colors duration-300">
            match
          </span>
          <span className="font-light text-[#8F84F8] dark:text-[#B4A9FB] ml-[1px] transition-colors duration-300">
            ply
          </span>
        </span>
      )}
    </div>
  );
}
