# Site Diary — Design System and Screen Guide

## Product direction

A **friendly digital notebook**, not enterprise resource planning. The only recurring job is fresh daily head counts, optional remarks, and sharing a legible message with head office. Large touch targets, positive feedback and no technical jargon are core to the experience.

## Visual language

| Element | Design |
|---|---|
| Canvas | Warm ivory `#FFFBF5` |
| Ink | Soft navy `#26364A` |
| Confirmation / Share | Mint green gradient `#13B786` → `#0AA876` |
| Add site | Honey yellow `#FFD477` → `#FFC15A` |
| Number plus control | Blue gradient `#71C4FF` → `#389BFA` |
| Site status | Mint for complete; pastel coral, sky, peach, lavender for waiting |
| Corners | Generously rounded 12–23px |
| Typography | Rounded system fonts, strong readable headings, 12–16px labels |
| Artwork | Original flat SVG construction city and happy clipboard worker |
| Motion | Soft entry and progress animation; reduced-motion preference honored |

No stock photos, no fake progress data, no distracting dashboard charts.

## Screen map

**Today → Site Entry → Review & Share → WhatsApp**

Additional tabs: **History** and **My Sites**. A simple cog opens **Settings**.

### Today
- Fixed persistent site list, each row shows status (pending/draft/complete).
- All active sites are included. Each day starts blank, never auto-filled from yesterday.
- Completion progress and total count of **completed sites only**.
- **Review & Share** is disabled until all current active sites are finished.

### Site Entry
- One worker category per readable row; +/− steppers and editable number for big values.
- Blank counts displayed with a dash; positive counts included in report.
- Custom category/contractor addition accessible on the same page.
- Per-site remarks can be Hindi or English; mobile keyboard voice input is supported by the device, not custom app recording.
- Zero workers can be explicitly confirmed.
- Any change reopens the site as a draft until Finish is pressed again.

### Report Preview
- Date, completed site count, total workers, individual sites and remarks.
- Plain-text WhatsApp message for easy head office data entry.
- Share opens `wa.me` prefilled text; it **does not** automatically send or choose a recipient.
- Copy button allows sharing via another channel.

### History
- Chronological reports ordered newest first.
- Opening a site allows a correction for that selected date.
- Site and category names saved as snapshots at completion so historical message labels stay legible after renaming.

### My Sites / Settings
- Add site, rename, archive, reactivate. No destructive delete action.
- Customize team names, icons and active status.
- JSON export/import (replace with confirmation) and optional passwordless Supabase sign-in.

## Illustrations and app icons

Artwork is stored as editable SVG in `public/illustrations/` and `public/icons/app-icon.svg`; export PNGs are included for iOS/Android/PWA. No fonts or external images are required at runtime.

The design reference at `docs/approved-concept.png` provides the original eight-screen visual direction. The live app is a responsive implementation with improved zero/blank handling and safe reporting checks.
