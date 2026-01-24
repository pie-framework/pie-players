// Prerender all pages for static export (GitHub Pages)
export const prerender = true;

// Disable SSR for SPA mode
export const ssr = false;

// GitHub Pages serves directories with `index.html`; keeping trailing slashes
// avoids subtle path issues when hosting under a base path like `/pie-players/examples`.
export const trailingSlash = "always";
