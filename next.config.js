/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Disable telemetry to prevent network requests during dev
if (process.env.NEXT_TELEMETRY_DISABLED !== '1') {
  process.env.NEXT_TELEMETRY_DISABLED = '1';
}

module.exports = nextConfig;
