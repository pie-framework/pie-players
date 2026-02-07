/**
 * @pie-players/pie-legacy-player
 *
 * Web component wrapper for the legacy @pie-framework/pie-player-components.
 * Loads the pie-player custom element from jsdelivr CDN for backwards compatibility.
 */

// Import the Svelte component to register the custom element
import PieLegacyPlayer from './PieLegacyPlayer.svelte';

export { PieLegacyPlayer };
export default PieLegacyPlayer;
