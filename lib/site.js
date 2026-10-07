// The site's public address, used by the sitemap and robots.txt.
// Set NEXT_PUBLIC_SITE_URL to your custom domain (e.g. https://your-domain.com); on Vercel it
// falls back to the project's production domain, and locally to localhost.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "http://localhost:3000"
).replace(/\/$/, "");
