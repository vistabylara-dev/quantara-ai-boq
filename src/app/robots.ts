import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/settings/',
        '/templates/',
      ],
    },
    sitemap: 'https://quantara.vistabylara.com/sitemap.xml',
  };
}
