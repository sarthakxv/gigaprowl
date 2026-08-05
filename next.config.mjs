/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep native/heavy deps out of the bundle; ship the vendored fonts + resvg
    // binary with the video-build function so SVG→PNG rasterization has fonts.
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "@resvg/resvg-js", "unpdf"],
    outputFileTracingIncludes: {
      "/api/video/build": ["./lib/fonts/**"],
    },
  },
};
export default nextConfig;
