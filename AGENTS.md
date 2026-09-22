<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mitos release expectation

Andrew clarified on 2026-09-22 that a request to commit and push Mitos changes
also authorizes and expects a live release at https://mitos.twelvedegrees.studio.
Carry the requested work through its production deployment and verification;
GitHub push alone does not complete the release. Routine releases do not need
another confirmation when this standing authorization covers the changes.

Automatic main-branch deployment remains disabled in vercel.json. Use an explicit
Vercel production deployment, deploy matching Firebase rules when needed, and
apply required migrations within the approved feature scope. Confirm Vercel Ready
and check the custom domain before reporting that changes are live. If automatic
approval review blocks an action, report the exact action and stated reason.
