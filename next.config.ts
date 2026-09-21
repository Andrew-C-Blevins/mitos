import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  async rewrites() {
    // Local phone preview reaches emulators through Next. Java stays bound to
    // localhost, so it needs no inbound firewall exception. Never enabled in cloud.
    if (
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true' ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-mitos'
    )
      return [];
    return [
      {
        source: '/identitytoolkit.googleapis.com/:path*',
        destination: 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/:path*',
      },
      {
        source: '/securetoken.googleapis.com/:path*',
        destination: 'http://127.0.0.1:9099/securetoken.googleapis.com/:path*',
      },
      {
        source: '/google.firestore.v1.Firestore/:path*',
        destination: 'http://127.0.0.1:8080/google.firestore.v1.Firestore/:path*',
      },
      {
        source: '/v1/projects/demo-mitos/:path*',
        destination: 'http://127.0.0.1:8080/v1/projects/demo-mitos/:path*',
      },
    ];
  },
};
export default config;
