import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export const HomeIcon = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="15" y="15" width="70" height="70" rx="20" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="3"/>
    <path d="M42 35L65 50L42 65V35Z" fill="currentColor" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M25 75C35 80 65 80 75 75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.5"/>
  </svg>
);

export const DiscoverIcon = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" strokeDasharray="8 8"/>
    <circle cx="50" cy="50" r="20" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="4"/>
    <path d="M50 38V42M50 58V62M38 50H42M58 50H62" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="50" cy="50" r="4" fill="currentColor" />
  </svg>
);

export const DownloadsIcon = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="20" y="25" width="60" height="50" rx="8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="3"/>
    <rect x="30" y="35" width="40" height="6" rx="3" fill="currentColor" />
    <rect x="30" y="48" width="25" height="6" rx="3" fill="currentColor" />
    <circle cx="70" cy="70" r="15" fill="currentColor" />
    <path d="M66 70L74 70M70 66L70 74" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export const HistoryIcon = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="20" y="45" width="10" height="10" rx="5" fill="currentColor">
      <animate attributeName="height" values="10;40;10" dur="1.5s" repeatCount="indefinite" />
      <animate attributeName="y" values="45;30;45" dur="1.5s" repeatCount="indefinite" />
    </rect>
    <rect x="45" y="25" width="10" height="50" rx="5" fill="currentColor">
      <animate attributeName="height" values="50;20;50" dur="1.2s" repeatCount="indefinite" />
      <animate attributeName="y" values="25;40;25" dur="1.2s" repeatCount="indefinite" />
    </rect>
    <rect x="70" y="40" width="10" height="20" rx="5" fill="currentColor">
      <animate attributeName="height" values="20;55;20" dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="y" values="40;22;40" dur="1.8s" repeatCount="indefinite" />
    </rect>
  </svg>
);

export const SettingsIcon = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M30 45C30 56.0457 38.9543 65 50 65C61.0457 65 70 56.0457 70 45" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <rect x="38" y="15" width="24" height="42" rx="12" fill="currentColor"/>
    <rect x="44" y="25" width="12" height="2" rx="1" fill="white" fillOpacity="0.3"/>
    <rect x="44" y="31" width="12" height="2" rx="1" fill="white" fillOpacity="0.3"/>
    <path d="M35 85H65M50 70V85" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);
