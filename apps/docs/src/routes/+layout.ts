// Enable prerendering for the docs site so adapter-static emits HTML pages for GitHub Pages.
export const prerender = true;

// GitHub Pages serves directories with `index.html`; keeping trailing slashes avoids subtle path issues.
export const trailingSlash = "always";
