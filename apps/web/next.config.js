/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Kamino klend v12 and its Orca whirlpools dependency ship a wasm binding.
    // Externalize the server-only SDK chain so Next requires it from node_modules
    // at runtime instead of bundling the wasm, which breaks build-time page-data
    // collection for the api/kamino and api/nightguard routes. These packages are
    // imported only in server routes, never in a client component, so this is safe.
    serverComponentsExternalPackages: [
      "@kamino-finance/klend-sdk",
      "@solana/kit",
      "@orca-so/whirlpools",
      "@orca-so/whirlpools-client",
      "@orca-so/whirlpools-core",
      "@orca-so/tx-sender",
    ],
  },
  webpack: (config) => {
    // web3.js and some wallet libs reference Node built-ins that do not exist
    // in the browser. Stub them so the client bundle builds.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: false,
      stream: false,
      fs: false,
    };
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

module.exports = nextConfig;
