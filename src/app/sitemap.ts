import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/features',
    '/security',
    '/terms',
    '/privacy',
    '/contact-sales',
    '/login',
    '/register'
  ];

  return routes.map((route) => ({
    url: `https://quantara.vistabylara.com${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
