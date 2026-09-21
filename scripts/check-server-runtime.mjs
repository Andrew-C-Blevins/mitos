// Vercel's serverless Node runtime disables require(ESM). A normal local import
// misses dependency regressions such as firebase-admin 14 -> jwks-rsa 4 -> jose 6.
await import('firebase-admin/auth');
await import('firebase-admin/firestore');
console.log('Firebase Admin imports passed with require(ESM) disabled.');
