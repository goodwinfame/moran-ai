/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Turbopack for dev
    turbo: {},
  },
};

export default nextConfig;
