import { projects } from "@/lib/projects";
import { SITE_URL } from "@/lib/site";

// Served at /sitemap.xml (Next.js metadata route), generated at build time.
export default function sitemap() {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    ...projects.map((p) => ({ url: `${SITE_URL}/work/${p.slug}`, lastModified, changeFrequency: "yearly", priority: 0.6 })),
  ];
}
