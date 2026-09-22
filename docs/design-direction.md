# Mitos visual direction

Andrew's 2026-09-21 feedback supersedes the aesthetic restrictions in section 11
of the original brief: the stark black-and-white ledger feels dull and too close
to Mise. Keep the information architecture and useful density, but explore a
distinct personality for Mitos.

## Chosen direction

After comparing Studio, Garden and Fieldnotes, Andrew chose a refined Garden
direction with these details:

- Muted green and warm neutral surfaces, with substantially less green than the
  original Garden concept. Avoid the brown/ochre surfaces of Fieldnotes.
- Fraunces headings and wordmark, with DM Sans for body text and controls.
- Soft bronze thread accents: #87684d in light mode and #bca087 in dark mode.
  Rose, blue and the more golden brass alternatives were not selected.
- Circular controls and a fine thread connecting the next action and its steps.
- The wordmark and a small asymmetric thread to its right, with a few loops
  diminishing toward the right. No leading loop or symbol before the wordmark.
- **Omit the household name from the header.** The selected header arrangement
  is "Just Mitos + thread." The household record and individual names are
  separate from this presentation choice and remain unchanged.

The concepts use representative items with illustrative details. Their automatic
next-step progression demonstrates a visual idea; it is not approval to change
the app's item behavior. No concept interactions change stored records.

## Implementation status

The direction is implemented in the app, following Andrew's request to implement,
commit and push it. Fonts are self-hosted through next/font. The shared header
and sign-in use one decorative SVG thread beside the wordmark; no household label
is shown. Item sections retain the brief's order, with a fine connecting thread
and circular step controls. Checking a step does not automatically replace the
next action. Sign-in, capture, Settings and the home-screen icon use the same palette.

The information architecture, privacy rules and feature scope are preserved.
Ready, Due, Review and AI remain deferred. Production launch and custom DNS still
require explicit approval; mitos.twelvedegrees.studio is not configured.

Validation: production build, lint, type checks, 28 application tests and 14
Firestore rules tests pass. Browser review covers 1440px desktop and 390px phone,
the real imported list and a temporary emulator-only populated item. Step writes,
inline editing and capture were checked. Dark mode follows the browser's system
preference; light mode was checked through an ignored localhost CSS proxy, without
adding a theme override to the app. The temporary fixture and proxy are removed
after review. Application data and authentication logic are unchanged.

Published source: 548a850, pushed to main; GitHub CI run 35680033480 passed.
The updated Vercel preview is Ready and serves HTTP 200, but authorizing its new
hostname for Google sign-in was blocked by automatic approval review. The new
preview is not a usable replacement for the previous signed-in preview until
that exact hostname is approved. See CLAUDE.md for deployment addresses and the
remaining production/custom-domain approval.
