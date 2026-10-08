# Notes for coding agents

Project: Vite 6 + React 19 + TypeScript + standalone PWA. Prefer mobile-first behavior and maintain the warm, simple aesthetic in `docs/DESIGN.md`. Head office receives WhatsApp plain text and enters numbers elsewhere; avoid building complicated analytics.

Hard rules: New India calendar day has **no copied workforce counts**. Never treat an untouched site as zero. Edits make a site a draft until confirmed; only completed sites are eligible for official reports. Preserve archived site history and notes. Never store any Supabase secret/service_role key in frontend environment variables. All remote access must follow RLS from `supabase/setup.sql`.

Run `npm run check`, `npm run test`, and `npm run build` before deploying. No live data is seeded. Keep site management rare and daily reporting extremely easy. Ensure all controls are touch-friendly and accessible.
