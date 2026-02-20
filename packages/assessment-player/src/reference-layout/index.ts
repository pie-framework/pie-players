/**
 * Reference Layout - Assessment Layout Implementation
 *
 * A complete reference assessment layout with:
 * - Three-column layout (passage | item | notes)
 * - Top bar with accommodations and assessment controls
 * - Navigation bar with question selector
 * - Bottom bar with item-level tools
 * - Resizable passage/item divider
 */

export { default as AssessmentContent } from "./components/AssessmentContent.svelte";
export { default as AssessmentFooter } from "./components/AssessmentFooter.svelte";
// Export sub-components for advanced use cases
export { default as AssessmentHeader } from "./components/AssessmentHeader.svelte";
export { default as AssessmentNavigation } from "./components/AssessmentNavigation.svelte";
export { default as AssessmentToolsBar } from "./components/AssessmentToolsBar.svelte";
export { default as ItemPanel } from "./components/ItemPanel.svelte";
export { default as PassagePanel } from "./components/PassagePanel.svelte";
export { default as ReferenceLayout } from "./ReferenceLayout.svelte";
