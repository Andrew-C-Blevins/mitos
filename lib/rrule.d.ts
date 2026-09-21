// rrule 2.8.1 exposes incompatible package entry points to Node ESM and bundlers.
// Use its CommonJS distribution consistently in Next, Vitest and local scripts.
declare module 'rrule/dist/es5/rrule.js' {
  const distribution: typeof import('rrule');
  export default distribution;
}
