/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // web3.js and some wallet libs reference Node built-ins that do not exist
    // in the browser. Stub them so the client bundle builds.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: false,
      stream: false,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;
