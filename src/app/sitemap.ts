import { MetadataRoute } from 'next';
import {
  PUBLIC_CONTENT_REVIEW_DATE,
  PUBLIC_SEARCH_PAGES,
  PUBLIC_SITE_ORIGIN,
} from '@/lib/public-site/search-registry';

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SEARCH_PAGES
    .filter((entry) => entry.indexable !== false)
    .map((entry) => ({
      url: `${PUBLIC_SITE_ORIGIN}${entry.path === '/' ? '' : entry.path}`,
      lastModified: new Date(PUBLIC_CONTENT_REVIEW_DATE),
      changeFrequency: entry.changeFrequency ?? 'monthly',
      priority: entry.priority ?? 0.8,
    }));
}
