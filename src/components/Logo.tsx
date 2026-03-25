import React from 'react';

export default function Logo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background Semi-circle */}
      <path d="M 20 100 A 80 80 0 0 1 180 100 Z" fill="#1e3a8a" />
      
      {/* Light Blue Wave */}
      <path d="M 20 100 Q 60 40 100 100 T 180 100 Z" fill="#7dd3fc" />
      <path d="M 100 100 A 40 40 0 0 1 180 100 Z" fill="#1e3a8a" />
      <path d="M 20 100 A 80 80 0 0 1 180 100 Z" fill="none" />
      <path d="M 20 100 L 180 100" stroke="#1e3a8a" strokeWidth="2" />
      
      {/* Girl Figure */}
      <circle cx="70" cy="45" r="8" fill="white" />
      <path d="M 70 55 L 55 80 L 85 80 Z" fill="white" />
      <rect x="62" y="80" width="4" height="15" fill="white" />
      <rect x="74" y="80" width="4" height="15" fill="white" />
      <path d="M 70 55 Q 50 60 45 70" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M 70 55 Q 90 60 95 70" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />

      {/* Boy Figure */}
      <circle cx="110" cy="35" r="8" fill="white" />
      <rect x="102" y="45" width="16" height="25" fill="white" />
      <rect x="102" y="70" width="5" height="15" fill="white" />
      <rect x="113" y="70" width="5" height="15" fill="white" />
      <path d="M 102 48 Q 85 40 80 30" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M 118 48 Q 135 40 140 30" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />

      {/* Text */}
      <text x="100" y="125" fontFamily="Georgia, serif" fontStyle="italic" fontSize="24" fill="#1e3a8a" textAnchor="middle">Al Bashaer</text>
      <text x="100" y="140" fontFamily="Arial, sans-serif" fontSize="12" fill="#1e3a8a" textAnchor="middle">Faith &amp; Knowledge</text>
    </svg>
  );
}
