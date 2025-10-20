Stint Table Theme — Reference and Extract

Purpose
- This file documents the exact visual rules and JS class mappings used by the RadianPlanner "Stints" table so you can extract and re-use the look in other pages or projects.
- Includes: list of classes, how JS maps state → classes, required assets (fonts/icons), and a ready-to-use CSS theme you can drop into `public/css/stint-table-theme.css`.

Important IDs / elements (must remain present in target markup)
- Table container: any <table> element styled with the provided CSS. In the project the main table uses utility classes and a <tbody id="stint-table-body">.
- Row/pit markers: rows created by JS have ids like `stint-row-<i>` and pit rows use class `pit-stop-row` (or `pit-row`).
- Daylight cell: per-row daylight cell has id `daylight-cell-<i>` and the JS applies daylight-* classes to it.
- Driver selects: each row has selects with ids `stint-driver-<i>` and `stint-backup-driver-<i>`.

Which JS outputs which classes (quick mapping)
- Driver strip (vertical colour assigned to a cell/column): JS may add `driver-color-N` (where N is 0..7 or default). Apply these to the vertical strip cell or a dedicated column cell.
- Pit stop rows: JS creates a row with class `pit-stop-row`.
- Daylight classification: JS should set one of these classes on the daylight cell: `daylight-night`, `daylight-pre-dawn`, `daylight-dawn`, `daylight-post-dawn`, `daylight-day`, `daylight-midday`, `daylight-pre-dusk`, `daylight-dusk`, `daylight-post-dusk`.
- Legacy fallback helper classes used by some code: `.text-yellow-400`, `.text-blue-400`, `.text-orange-400` (simple color text classes).

Required assets (recommended)
- Tailwind (optional) — the project uses utility classes; adding the CDN helps if you want the same spacing/utilities.
  - <script src="https://cdn.tailwindcss.com"></script>
- RoadRage font (optional, only changes typography): defined with @font-face in the backup. If you can't host it, default system fonts are acceptable.
- Font Awesome (optional): for icons used in the complete UI.

How to use this theme
1. Copy the CSS block below into a new file `public/css/stint-table-theme.css`.
2. Add a link to it in your page head after Tailwind (if used):
   <link rel="stylesheet" href="/public/css/stint-table-theme.css">
3. Ensure table markup uses the same IDs or that your JS maps to the class names listed above.
4. If your JS uses different class names for daylight/driver colours, either change the JS to use these names or add equivalent selectors to the theme file.

Extracted CSS (drop into `public/css/stint-table-theme.css`)

```css
/* Stint table theme extracted from backup/index.html + project CSS */
/* Table base */
.stint-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
.stint-table th, .stint-table td { padding: 8px 12px; border-right: 1px solid rgba(255,255,255,0.04); text-align: center; }
.stint-table thead th { background-color: #111827; /* dark header */ color: #ffc800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
.stint-table tbody tr { background-color: #171717; }

/* Pit rows */
.pit-stop-row, .pit-row { background-color: rgb(42, 42, 42) !important; font-size: 0.9em; }

/* Current/selected states */
.current-stint { background-color: #585500; color: #fff; }
.current-pit { background-color: #8B4000; color: #fff; }

/* Driver color strips (vertical colour used to mark driver allocations) */
.driver-color-7 { background-color: rgba(59, 130, 246, 0.2) !important; } /* Blue */
.driver-color-6 { background-color: rgba(16, 185, 129, 0.2) !important; } /* Green */
.driver-color-5 { background-color: rgba(245, 101, 101, 0.2) !important; } /* Red */
.driver-color-4 { background-color: rgba(251, 191, 36, 0.2) !important; } /* Yellow */
.driver-color-1 { background-color: rgba(168, 85, 247, 0.2) !important; } /* Purple */
.driver-color-2 { background-color: rgba(236, 72, 153, 0.2) !important; } /* Pink */
.driver-color-0 { background-color: rgba(6, 182, 212, 0.2) !important; } /* Cyan */
.driver-color-3 { background-color: rgba(34, 197, 94, 0.2) !important; } /* Lime */
.driver-color-default { background-color: rgba(115, 115, 115, 0.2) !important; } /* Default Gray */

/* Daylight gradient / column classes */
.daylight-night { background: #141450 !important; color: #9ca3af !important; opacity: 0.9; }
.daylight-pre-dawn { background: #3f0d8a !important; color: #e5e7eb !important; opacity: 0.9; }
.daylight-dawn { background: #7300a0 !important; color: #f9fafb !important; opacity: 0.95; }
.daylight-post-dawn { background: #ffaa00 !important; color: #1f2937 !important; opacity: 0.95; }
.daylight-day { background: #ffea29 !important; color: #1f2937 !important; opacity: 0.95; }
.daylight-midday { background: #fffcc4 !important; color: #1f2937 !important; opacity: 0.95; }
.daylight-pre-dusk { background: #ffaa00 !important; color: #1f2937 !important; opacity: 0.92; }
.daylight-dusk { background: #7300a0 !important; color: #f9fafb !important; opacity: 0.92; }
.daylight-post-dusk { background: #3f0d8a !important; color: #f3f4f6 !important; opacity: 0.9; }

/* Small utility helpers (used by legacy JS) */
.text-yellow-400 { color: #f59e0b; }
````markdown
Stint Table Theme — Reference and Extract

Updated: 2025-10-20 — added a ready-to-copy JS snippet (updateStintRowColor), @font-face note and clarified the link path used by the legacy page.

Purpose
- This file documents the exact visual rules and JS class mappings used by the RadianPlanner "Stints" table so you can extract and re-use the look in other pages or projects.
- Includes: list of classes, how JS maps state → classes, required assets (fonts/icons), and a ready-to-use CSS theme you can drop into `public/css/stint-table-theme.css`.

Important IDs / elements (must remain present in target markup)
- Table container: any <table> element styled with the provided CSS. In the project the main table uses utility classes and a <tbody id="stint-table-body">.
- Row/pit markers: rows created by JS have ids like `stint-row-<i>` and pit rows use class `pit-stop-row` (or `pit-row`).
- Daylight cell: per-row daylight cell has id `daylight-cell-<i>` and the JS applies daylight-* classes to it.
- Driver selects: each row has selects with ids `stint-driver-<i>` and `stint-backup-driver-<i>`.

Which JS outputs which classes (quick mapping)
- Driver strip (vertical colour assigned to a cell/column): JS may add `driver-color-N` (where N is 0..7 or default). Apply these to the vertical strip cell or a dedicated column cell (in the backup JS these are applied to the whole `tr`).
- Pit stop rows: JS creates a row with class `pit-stop-row`.
- Daylight classification: JS should set one of these classes on the daylight cell: `daylight-night`, `daylight-pre-dawn`, `daylight-dawn`, `daylight-post-dawn`, `daylight-day`, `daylight-midday`, `daylight-pre-dusk`, `daylight-dusk`, `daylight-post-dusk`.
- Legacy fallback helper classes used by some code: `.text-yellow-400`, `.text-blue-400`, `.text-orange-400` (simple color text classes).

Required assets (recommended)
- Tailwind (optional) — the project uses utility classes; adding the CDN helps if you want the same spacing/utilities.
  - <script src="https://cdn.tailwindcss.com"></script>
- RoadRage font (optional, only changes typography): defined with @font-face in the backup. If you can't host it, default system fonts are acceptable. See the @font-face block below to host locally.
- Font Awesome (optional): for icons used in the complete UI.

How to use this theme
1. Copy the CSS block below into a new file `public/css/stint-table-theme.css`.
2. Add a link to it in your page head after Tailwind (if used). The legacy page in this repo currently links the base CSS as `/public/css/stint-table.css` so the theme file should use the same prefix:
   <link rel="stylesheet" href="/public/css/stint-table-theme.css">
3. Ensure table markup uses the same IDs or that your JS maps to the class names listed above.
4. If your JS uses different class names for daylight/driver colours, either change the JS to use these names or add equivalent selectors to the theme file.

Extracted CSS (drop into `public/css/stint-table-theme.css`)

```css
/* Stint table theme extracted from backup/index.html + project CSS */
/* Table base */
.stint-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
.stint-table th, .stint-table td { padding: 8px 12px; border-right: 1px solid rgba(255,255,255,0.04); text-align: center; }
.stint-table thead th { background-color: #111827; /* dark header */ color: #ffc800; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
.stint-table tbody tr { background-color: #171717; }

/* Pit rows */
.pit-stop-row, .pit-row { background-color: rgb(42, 42, 42) !important; font-size: 0.9em; }

/* Current/selected states */
.current-stint { background-color: #585500; color: #fff; }
.current-pit { background-color: #8B4000; color: #fff; }

/* Driver color strips (vertical colour used to mark driver allocations) */
.driver-color-7 { background-color: rgba(59, 130, 246, 0.2) !important; } /* Blue */
.driver-color-6 { background-color: rgba(16, 185, 129, 0.2) !important; } /* Green */
.driver-color-5 { background-color: rgba(245, 101, 101, 0.2) !important; } /* Red */
.driver-color-4 { background-color: rgba(251, 191, 36, 0.2) !important; } /* Yellow */
.driver-color-1 { background-color: rgba(168, 85, 247, 0.2) !important; } /* Purple */
.driver-color-2 { background-color: rgba(236, 72, 153, 0.2) !important; } /* Pink */
.driver-color-0 { background-color: rgba(6, 182, 212, 0.2) !important; } /* Cyan */
.driver-color-3 { background-color: rgba(34, 197, 94, 0.2) !important; } /* Lime */
.driver-color-default { background-color: rgba(115, 115, 115, 0.2) !important; } /* Default Gray */

/* Daylight gradient / column classes */
.daylight-night { background: #141450 !important; color: #9ca3af !important; opacity: 0.9; }
.daylight-pre-dawn { background: #3f0d8a !important; color: #e5e7eb !important; opacity: 0.9; }
.daylight-dawn { background: #7300a0 !important; color: #f9fafb !important; opacity: 0.95; }
.daylight-post-dawn { background: #ffaa00 !important; color: #1f2937 !important; opacity: 0.95; }
.daylight-day { background: #ffea29 !important; color: #1f2937 !important; opacity: 0.95; }
.daylight-midday { background: #fffcc4 !important; color: #1f2937 !important; opacity: 0.95; }
.daylight-pre-dusk { background: #ffaa00 !important; color: #1f2937 !important; opacity: 0.92; }
.daylight-dusk { background: #7300a0 !important; color: #f9fafb !important; opacity: 0.92; }
.daylight-post-dusk { background: #3f0d8a !important; color: #f3f4f6 !important; opacity: 0.9; }

/* Small utility helpers (used by legacy JS) */
.text-yellow-400 { color: #f59e0b; }
.text-blue-400 { color: #60a5fa; }
.text-orange-400 { color: #fb923c; }

/* Compact table tweaks for the visual match */
.stint-table td.px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
.stint-table .road-rage-font { font-family: 'RoadRage', sans-serif; }

/* Accessibility: ensure select and inputs are visible on dark bg */
.stint-table select, .stint-table input { background: rgba(255,255,255,0.03); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.04); }

/* End of theme */
```

Additional artifacts you may want to copy

1) RoadRage @font-face (copy from backup assets into your `assets/` folder):

```css
@font-face {
  font-family: 'RoadRage';
  src: url('/public/dev/assets/RoadRage.woff2') format('woff2'),
       url('/public/dev/assets/RoadRage.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
.road-rage-font { font-family: 'RoadRage', sans-serif; }
```

Notes and rationale
- The driver-color-* classes create the vertical stripe you see on the right of the time columns in the main UI. The JS should add a driver-color-N class to whichever element represents that strip for the given stint row (in the backup page the whole `tr` is assigned the class).
- The daylight-* classes set both background and text contrast for the daylight column. These were inline in the backup page; copying them into a separate theme file keeps the styles portable.
- We intentionally use `!important` on the driver/daylight classes to ensure they override utility classes loaded earlier (Tailwind) when necessary.
- If you need exact font parity include the RoadRage font files and the @font-face from the backup. If not available, fallback fonts still preserve layout and color.

Optional JS snippet (copy into page JS or a small `stint-table-theme.js` file)

```js
// Assigns a driver-color class to a stint row — copy of the function from backup/index.html
function updateStintRowColor(stintIndex, driverName, drivers) {
  const row = document.getElementById(`stint-row-${stintIndex}`);
  if (!row) return;

  // Remove existing driver-color classes
  for (let i = 0; i < 8; i++) row.classList.remove(`driver-color-${i}`);
  row.classList.remove('driver-color-default');

  if (!driverName) {
    row.classList.add('driver-color-default');
    return;
  }

  const driverIndex = drivers.findIndex(d => d.name === driverName);
  if (driverIndex !== -1) {
    row.classList.add(`driver-color-${driverIndex % 8}`);
  } else {
    row.classList.add('driver-color-default');
  }
}

// Usage notes:
// - Call this when you populate or restore driver selects. In the backup page the driver-select 'change' event calls this function.
// - If your driver selects are created dynamically, attach an event listener:
//     driverSelect.addEventListener('change', () => updateStintRowColor(i, driverSelect.value, selectedDrivers));

```

Quick checklist to apply this theme to another table
- [ ] Add the theme CSS file to the page/head after any utility CSS (Tailwind): <link rel="stylesheet" href="/public/css/stint-table-theme.css">
- [ ] Ensure the table markup has a daylight cell you can target (add `id="daylight-cell-<i>"` or a column class) and the JS sets the daylight-* classes on it.
- [ ] Ensure the driver-strip cell gets `driver-color-N` applied by JS (or add those classes directly if static). If you need runtime assignment, also include the `updateStintRowColor` JS snippet above and wire the driver select 'change' events.
- [ ] Click the page's update/refresh function so JS re-runs and applies classes to rows.

If you want, I can: create `public/css/stint-table-theme.css` with the exact CSS above and add the <link> to `public/dev/stint-table-legacy.html`. Say "apply theme file" and I will create the CSS file and link it into the legacy HTML (non-destructive edit).
````