# Security policy

Risk Parity Compass is a static site that runs entirely in your browser. It has no server, no accounts and no analytics, and it makes no requests to third parties: prices are static files served from the same site.

## Reporting a vulnerability

Please use GitHub's private reporting: **Security → Report a vulnerability** on <https://github.com/paruff/risk-parity-compass>. Do not open a public issue for a security problem. This is a hobby project, so expect a reply within a few days, not hours.

## Scope notes

- The production build ships a Content-Security-Policy `<meta>` tag (see `vite.config.js`). GitHub Pages cannot set response headers, so frame-ancestors and similar header-only directives are not available.
- Your plan lives in `localStorage` on your device. Anyone with access to your browser profile can read it; use Export plan for backups.
- `npm audit` is clean. Lighthouse CI is not a project dependency (its Puppeteer chain has an unpatched `extract-zip` advisory); CI runs a pinned `npx @lhci/cli` on ephemeral runners only.
