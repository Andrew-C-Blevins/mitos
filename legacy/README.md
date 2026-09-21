# Legacy preservation

Run `python scripts/export-legacy.py --source <legacy-app-directory>` to export
effective data without importing or modifying the Flask app. It uses the app's
read loaders and serializes `DEFAULT_DAYS` when no Santa Rosa schedule file exists.

`legacy-export.json` and `MANIFEST.md` contain private family data and are ignored
by Git. Keep a copy in a private backup before retirement. The prototype uses the
local Windows snapshot; a checked manifest and current Pi export are still needed
before shutting down Flask. No shutdown or tunnel change is automated here.

Only personal-projects and home-projects enter the prototype. The Santa Rosa task
list and all trip schedules remain in the export for later review. Ambiguous
shopping/errands mappings and actionable Diana tasks are held for human review.
