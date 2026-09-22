# September 22 feedback release

Status: live in production from app commit 79c5338. Firebase rules/indexes and
the approved household roles are deployed; the private checklist import is applied.
This is a usability and permissions correction to the existing milestone. AI,
Ready/Due/Review, external handoff, and section 7 remain unimplemented.

## Behavior changes

- Capture accepts 50,000 characters and preserves the exact source in the
  immutable capture log. Its first line provides a short title. Inputs do not
  silently cut pasted text at an HTML maxlength.
- Existing steps, needs, questions and decisions have an explicit Delete action
  in their inline editor. Blank saves show a readable message. Existing-entry
  writes retain transaction preconditions and array transforms.
- Inbox Keep/Edit/Delete have matching alignment and 44px touch targets.
- Category labels are written out. One actions button replaces duplicate click
  targets and drag grips. Move before/Bottom works with touch or keyboard and
  switches the list to manual order. Swipe/long-press actions remain available.
- Right swipe completes; left swipe snoozes one week. The Complete hint now sits
  on the revealed left edge; a shared last-child rule previously hid it on the right.
- Unbuilt navigation/actions are hidden. Notes & history is collapsed by default;
  optional fields remain available through Add details and Item settings.
- Settings has an X, Done link, toggleable gear, and in-context saved/error feedback.
- Household roles live in adminUids; multiple admins are allowed and the last
  active admin cannot be archived or demoted. Admins manage members; each active
  member controls only their own color. Active colors must be unique.
- Archived people are behind a collapsed admin-only disclosure. Archiving a
  login removes household membership. Restore grants user membership; an admin
  can then promote. Deletion is limited to unused archived records without logins.
  Admin status does not bypass private-item ownership.

## Validation

- Final lint, typecheck, item-write boundary, Firebase runtime checks and production
  build pass. No package versions changed.
- 37 domain/route tests pass; the existing deterministic-rules coverage gate
  remains at 100% lines, branches and functions.
- 20 emulator security tests pass, including concurrent color selection and
  concurrent admin demotion, membership revocation/restoration, referenced-person
  protection, direct-client-write denial, step deletion and long capture bounds.
- Browser checks at 393 × 852 and 1440 × 1000: an 8,168-character, 20-part sample
  paste survives capture unchanged; Inbox buttons align; blank step messages and
  deletion work; Move persists; own color persists after reload; duplicate colors
  are unavailable; regular users lack management controls; last-admin demotion
  fails with an explanatory message; the gear closes Settings.
- The browser is Chromium with a phone-sized viewport. Physical iPhone/Safari
  confirmation remains a user check after release.
- An old restored-emulator sign-in failed token validation; signing out/in fixed
  it. A 401 now gives a sign-in-again message rather than a generic authorization error.

## Applied data changes

The existing household was initialized with Andrew as admin and Karen as user,
using the current identity records and preserving membership. No broad seed was
rerun. The archived seed record is hidden from routine Settings.

The approved private import added 20 concise steps to the existing Inbox entry.
It replaced its one truncated step, preserved
the capture and old step in history, and appended the complete source in numbered
notes. It remains private to Andrew under Finance & Admin in Everything.
No deadlines were inferred. The item version and source hash were checked before
applying, and every step plus the complete preserved source was verified afterward.
No personal claim content belongs in GitHub, deployment source, or these notes.

The tested application and updated Firestore rules were published together, with
adminUids initialized before the application deployment. No project creation, DNS,
new cloud variables, model subscriptions or account provisioning was needed.

Production deployment: dpl_8PMjjhibdcAHSErwY1TeG6x5GGt3, Ready at
https://mitos.twelvedegrees.studio. Settings and public assets return 200, while
unauthenticated session/export/people requests return 401. The bounded deployment
error-log query returned no errors. Production signed-in UI verification stopped
at Google sign-in/browser control; the full UI flow was verified against emulators.
Andrew's clarified commit-and-push expectation includes a live release and is
recorded in AGENTS.md.

## Proposed next interaction

The core experience should be title, checklist and notes. A future “Organize this”
action should accept a large paste, propose one task or several, produce concise
editable steps, retain the source, and let the user approve the result. Questions,
needs and decisions should appear only when useful, without forcing a form-filling
exercise. Separate suggestions from extracted instructions. Do not invent dates,
owners or completion state. Keep must remain a predictable non-AI action.

Shape is the deferred AI proposal action. Work on this is the deferred context
handoff. Ready is an availability/context filter; Due is the real deadline view;
Review is for pending proposals and items needing attention. These are not enabled
by this release.
