export { default as PieSectionPlayer } from "./PieSectionPlayer.svelte";

// Make sure the web component is registered
// This is what makes it available as <pie-section-player> in HTML
import "./PieSectionPlayer.svelte";

// Import tool web components (side-effect imports)
// These register the custom elements globally
import "@pie-players/pie-tool-answer-eliminator";
import "@pie-players/pie-tool-tts-inline";
