import { SITE_URL } from "@/lib/site";

// Served at /robots.txt (Next.js metadata route): everything may be crawled, and crawlers are
// pointed at the sitemap.
export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
