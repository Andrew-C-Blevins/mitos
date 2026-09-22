import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Mitos',
    short_name: 'Mitos',
    description: 'A shared household action system',
    start_url: '/',
    display: 'standalone',
    background_color: '#eaeae5',
    theme_color: '#eaeae5',
    icons: [{ src: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  };
}
