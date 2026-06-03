const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export function resolvePosterUrl(poster: string | null | undefined, size = 'w500'): string | null {
  const value = poster?.trim();

  if (!value || value === 'null' || value === 'undefined') {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  if (value.startsWith('/')) {
    return `${TMDB_IMAGE_BASE_URL}/${size}${value}`;
  }

  return `${TMDB_IMAGE_BASE_URL}/${size}/${value}`;
}
