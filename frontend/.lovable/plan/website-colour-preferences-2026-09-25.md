# Website colour preferences

## What will change
- Add an **Appearance** section in Settings with several accessible colour themes shown as swatches.
- Apply the selected theme immediately across navigation, panels, buttons, charts, and page backgrounds.
- Save the selection in the browser so it remains active on later visits.
- Keep the existing Emerald theme as the default and preserve all current settings behavior.

## Technical details
- Use a `data-theme` attribute on the document root and semantic colour variables in the global stylesheet.
- Restore the saved theme during app startup to avoid reverting between pages.
- Verify Settings selection, page navigation, saved preference, mobile layout, and current build health.
