import React from 'react';

interface LogoProps {
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
  textSize?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  variant?: 'standard' | 'hero';
}

export default function Logo({
  className = '',
  iconSize = 'md',
  textSize = 'md',
  iconOnly = false,
  variant = 'standard',
}: LogoProps) {
  const iconSizeMap = {
    sm: 'h-6 w-auto aspect-[29/28]',
    md: 'h-8 w-auto aspect-[29/28]',
    lg: 'h-10 w-auto aspect-[29/28]',
  };

  const textClassMap = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
  };

  const isHero = variant === 'hero';
  const gapClass = isHero ? 'gap-0.5' : 'gap-2 sm:gap-2.5';

  return (
    <div className={`flex items-center ${gapClass} select-none ${className}`}>
      {/* Icon: The Match Checkmark (M-Check) */}
      <svg
        className={`${iconSizeMap[iconSize]} shrink-0 overflow-visible ${isHero ? '-translate-y-[1px]' : ''}`}
        viewBox="1.5 2 29 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Left Pillar & Descent */}
        <path
          d="M4 27.5V7C4 5.61929 5.11929 4.5 6.5 4.5H7C8.08316 4.5 9.07689 5.18526 9.38212 6.22557L16 22"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#1E1B4B] dark:text-[#F3F4F6] transition-colors duration-300"
        />
        {/* Right Pillar */}
        <path
          d="M28 13.5V27.5"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          className="text-[#1E1B4B] dark:text-[#F3F4F6] transition-colors duration-300"
        />
        {/* Integrated Emerald Checkmark */}
        <path
          d="M10 16.5L16 23L28 6"
          stroke="#2ECC71"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-colors duration-300"
        />
      </svg>

      {!iconOnly && (
        <>
          {isHero ? (
            <>
              {/* Accessible name for screen readers & text selection */}
              <span className="sr-only">Matchply</span>
              {/* Visual lockup where M-Check is the capital letter */}
              <span
                aria-hidden="true"
                className={`font-display tracking-tight ${textClassMap[textSize]} flex items-baseline leading-none`}
              >
                <span className="font-extrabold text-text transition-colors duration-300">
                  atch
                </span>
                <span className="font-medium text-[#6366F1] dark:text-[#A78BFA] ml-[1px] transition-colors duration-300">
                  ply
                </span>
              </span>
            </>
          ) : (
            <span
              className={`font-display tracking-tight ${textClassMap[textSize]} flex items-baseline leading-none`}
            >
              <span className="font-extrabold text-text transition-colors duration-300">
                match
              </span>
              <span className="font-medium text-[#6366F1] dark:text-[#A78BFA] ml-[1px] transition-colors duration-300">
                ply
              </span>
            </span>
          )}
        </>
      )}
    </div>
  );
}
