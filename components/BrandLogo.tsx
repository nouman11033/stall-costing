'use client';

import Link from 'next/link';

/** Black Steeed mark — fixed top-left on parameter & results pages */
export default function BrandLogo() {
  return (
    <Link
      href="/"
      className="fixed top-4 left-4 z-50 inline-flex items-center rounded-lg bg-white/90 backdrop-blur-sm shadow-sm border border-[#E5DDD1]/80 px-2 py-1.5 hover:shadow-md transition-shadow"
      aria-label="Black Steeed home"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/black-steeed-logo.png"
        alt="Black Steeed"
        className="h-9 sm:h-11 w-auto object-contain"
      />
    </Link>
  );
}
