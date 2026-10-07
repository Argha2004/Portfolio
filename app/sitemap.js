import { projects } from "@/lib/projects";

// Served at /sitemap.xml (Next.js metadata route), generated at build time.
// The site's address comes from NEXT_PUBLIC_SITE_URL (set it to your custom domain, e.g.
// https://arghadeep.dev); on Vercel it falls back to the project's production domain.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "http://localhost:3000"
).replace(/\/$/, "");

export default function sitemap() {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    ...projects.map((p) => ({ url: `${SITE_URL}/work/${p.slug}`, lastModified, changeFrequency: "yearly", priority: 0.6 })),
  ];
}
