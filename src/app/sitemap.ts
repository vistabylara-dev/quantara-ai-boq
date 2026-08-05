import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/features',
    '/about',
    '/security',
    '/terms',
    '/privacy',
    '/data-processing',
    '/cookie-policy',
    '/acceptable-use',
    '/subprocessors',
    '/contact-sales',
    '/login',
    '/register',
    '/ai-boq-software',
    '/boq-software',
    '/construction-estimating-software',
    '/boq-management',
    '/pdf-boq-extraction',
    '/scanned-pdf-boq',
    '/quantity-surveying-software',
    '/boq-document-generation'
  ];

  return routes.map((route) => ({
    url: `https://quantara.vistabylara.com${route}`,
    lastModified: new Date('2026-08-05'),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
