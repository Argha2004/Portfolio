/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR lets a production build run next to `npm run dev` without overwriting its .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
