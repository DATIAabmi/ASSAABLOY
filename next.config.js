/** @type {import("next").NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: {
    // Needed for the ASSA ABLOY logo (public/assaabloy-logo.svg) — Next's
    // Image Optimizer blocks SVGs by default.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};
module.exports = nextConfig;
