/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native modules — keep external from the server bundle so webpack
  // doesn't try to parse their `.node` binaries.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "@resvg/resvg-js"],
  },
};

export default nextConfig;
