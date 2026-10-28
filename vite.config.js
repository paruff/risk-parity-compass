import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const commit = process.env.GITHUB_SHA || 'local';

// GitHub Pages cannot set response headers, so the production build carries its CSP in a
// <meta> tag. Dev is excluded because Vite's React refresh injects an inline script.
// connect-src must list every host the app fetches from.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://query1.finance.yahoo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspMeta = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: html =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
    ),
};

export default defineConfig({
  base: '/risk-parity-compass/',
  plugins: [react(), cspMeta],
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version),
    __COMMIT__: JSON.stringify(commit),
    __COMMIT_SHORT__: JSON.stringify(commit.slice(0, 7)),
  },
});
