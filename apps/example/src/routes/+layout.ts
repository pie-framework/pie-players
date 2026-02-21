// Demo app is runtime-hosted (adapter-node), not statically prerendered.
export const prerender = false;

// Disable SSR for SPA mode
export const ssr = false;

// GitHub Pages serves directories with `index.html`; keeping trailing slashes
// avoids subtle path issues when hosting under a base path like `/pie-players/examples`.
export const trailingSlash = "always";
