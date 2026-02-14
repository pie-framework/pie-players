/**
 * Tool Registry
 *
 * Central registry for all assessment tools. Manages tool metadata, visibility logic,
 * and button/instance creation. Supports dynamic registration and override by integrators.
 */

import type { ToolContext, ToolLevel } from './tool-context';

/**
 * Options for creating a tool button
 */
export interface ToolButtonOptions {
  /** Whether the button should be disabled */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Callback when button is clicked */
  onClick?: () => void;

  /** Aria label override */
  ariaLabel?: string;

  /** Custom icon override */
  icon?: string;

  /** Tooltip text */
  tooltip?: string;
}

/**
 * Definition for a tool button component
 */
export interface ToolButtonDefinition {
  /** Tool ID */
  toolId: string;

  /** Display label */
  label: string;

  /** Icon (SVG string, icon name, or URL) */
  icon: string;

  /** Whether button is disabled */
  disabled: boolean;

  /** Aria label for accessibility */
  ariaLabel: string;

  /** Tooltip text */
  tooltip?: string;

  /** Click handler */
  onClick: () => void;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Options for creating a tool instance
 */
export interface ToolInstanceOptions {
  /** Initial state for the tool */
  initialState?: unknown;

  /** Callback when tool is closed/dismissed */
  onClose?: () => void;

  /** Custom configuration */
  config?: Record<string, unknown>;
}

/**
 * Tool registration interface
 */
export interface ToolRegistration {
  /** Unique tool identifier (e.g., 'calculator', 'textToSpeech') */
  toolId: string;

  /** Human-readable name */
  name: string;

  /** Description of what the tool does */
  description: string;

  /** Icon identifier or SVG string */
  icon: string | ((context: ToolContext) => string);

  /** Which levels this tool supports */
  supportedLevels: ToolLevel[];

  /**
   * PNP support IDs that enable this tool (optional)
   * Used by PNPToolResolver to determine if tool is allowed
   * Example: ['calculator', 'basic-calculator', 'scientific-calculator']
   */
  pnpSupportIds?: string[];

  /**
   * Pass 2: Tool decides if it's relevant in this context
   * Called ONLY if orchestrator has already allowed the tool (Pass 1)
   *
   * @param context - Rich context about where tool is being evaluated
   * @returns true if tool should be visible, false to hide
   */
  isVisibleInContext(context: ToolContext): boolean;

  /**
   * Create a button definition for rendering in a toolbar
   *
   * @param context - Context where button will appear
   * @param options - Button options (click handler, disabled state, etc.)
   * @returns Button definition for rendering
   */
  createButton(context: ToolContext, options: ToolButtonOptions): ToolButtonDefinition;

  /**
   * Create the actual tool instance (e.g., calculator component)
   *
   * @param context - Context where tool is being used
   * @param options - Tool-specific options
   * @returns HTMLElement containing the tool
   */
  createToolInstance(context: ToolContext, options: ToolInstanceOptions): HTMLElement;
}

/**
 * Tool Registry
 *
 * Manages tool registrations and provides query/lookup functionality
 */
export class ToolRegistry {
  private tools = new Map<string, ToolRegistration>();
  private pnpIndex = new Map<string, Set<string>>(); // pnpSupportId → Set<toolId>

  /**
   * Register a tool
   *
   * @param registration - Tool registration
   * @throws Error if toolId is already registered
   */
  register(registration: ToolRegistration): void {
    if (this.tools.has(registration.toolId)) {
      throw new Error(`Tool '${registration.toolId}' is already registered`);
    }

    this.tools.set(registration.toolId, registration);

    // Index PNP support IDs
    if (registration.pnpSupportIds) {
      for (const pnpId of registration.pnpSupportIds) {
        if (!this.pnpIndex.has(pnpId)) {
          this.pnpIndex.set(pnpId, new Set());
        }
        this.pnpIndex.get(pnpId)!.add(registration.toolId);
      }
    }
  }

  /**
   * Override an existing tool registration
   *
   * @param registration - New tool registration (must have existing toolId)
   */
  override(registration: ToolRegistration): void {
    if (!this.tools.has(registration.toolId)) {
      throw new Error(`Cannot override non-existent tool '${registration.toolId}'`);
    }

    // Remove old PNP index entries
    const oldReg = this.tools.get(registration.toolId)!;
    if (oldReg.pnpSupportIds) {
      for (const pnpId of oldReg.pnpSupportIds) {
        this.pnpIndex.get(pnpId)?.delete(registration.toolId);
      }
    }

    // Add new registration
    this.tools.set(registration.toolId, registration);

    // Re-index PNP support IDs
    if (registration.pnpSupportIds) {
      for (const pnpId of registration.pnpSupportIds) {
        if (!this.pnpIndex.has(pnpId)) {
          this.pnpIndex.set(pnpId, new Set());
        }
        this.pnpIndex.get(pnpId)!.add(registration.toolId);
      }
    }
  }

  /**
   * Unregister a tool
   *
   * @param toolId - Tool ID to remove
   */
  unregister(toolId: string): void {
    const reg = this.tools.get(toolId);
    if (!reg) return;

    // Remove PNP index entries
    if (reg.pnpSupportIds) {
      for (const pnpId of reg.pnpSupportIds) {
        this.pnpIndex.get(pnpId)?.delete(toolId);
      }
    }

    this.tools.delete(toolId);
  }

  /**
   * Get a tool registration by ID
   *
   * @param toolId - Tool ID
   * @returns Tool registration or undefined
   */
  get(toolId: string): ToolRegistration | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Check if a tool is registered
   *
   * @param toolId - Tool ID
   * @returns true if registered
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Get all registered tool IDs
   *
   * @returns Array of tool IDs
   */
  getAllToolIds(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all tool registrations
   *
   * @returns Array of tool registrations
   */
  getAllTools(): ToolRegistration[] {
    return Array.from(this.tools.values());
  }

  /**
   * Find tool IDs that support a given PNP support ID
   *
   * @param pnpSupportId - PNP support ID (e.g., 'calculator')
   * @returns Set of tool IDs that support this PNP ID
   */
  getToolsByPNPSupport(pnpSupportId: string): Set<string> {
    return this.pnpIndex.get(pnpSupportId) || new Set();
  }

  /**
   * Get tools that support a specific level
   *
   * @param level - Tool level (assessment, section, item, passage, element)
   * @returns Array of tool registrations that support this level
   */
  getToolsByLevel(level: ToolLevel): ToolRegistration[] {
    return this.getAllTools().filter(tool => tool.supportedLevels.includes(level));
  }

  /**
   * Filter tools by visibility in a given context
   *
   * Pass 2 of the two-pass model: Given a list of allowed tool IDs (from Pass 1),
   * ask each tool if it's relevant in this context.
   *
   * @param allowedToolIds - Tool IDs that passed Pass 1 (orchestrator approval)
   * @param context - Context to evaluate
   * @returns Array of visible tool registrations
   */
  filterVisibleInContext(allowedToolIds: string[], context: ToolContext): ToolRegistration[] {
    const visible: ToolRegistration[] = [];

    for (const toolId of allowedToolIds) {
      const tool = this.get(toolId);
      if (!tool) {
        console.warn(`Tool '${toolId}' is allowed but not registered`);
        continue;
      }

      // Check if tool supports this level
      if (!tool.supportedLevels.includes(context.level)) {
        continue;
      }

      // Pass 2: Ask tool if it's relevant
      try {
        if (tool.isVisibleInContext(context)) {
          visible.push(tool);
        }
      } catch (error) {
        console.error(`Error evaluating visibility for tool '${toolId}':`, error);
      }
    }

    return visible;
  }

  /**
   * Create button definitions for visible tools
   *
   * @param allowedToolIds - Tool IDs that passed Pass 1
   * @param context - Context to evaluate
   * @param buttonOptions - Options for button creation
   * @returns Array of button definitions ready for rendering
   */
  createButtons(
    allowedToolIds: string[],
    context: ToolContext,
    buttonOptions: (toolId: string) => ToolButtonOptions
  ): ToolButtonDefinition[] {
    const visibleTools = this.filterVisibleInContext(allowedToolIds, context);

    return visibleTools.map(tool => {
      const options = buttonOptions(tool.toolId);
      return tool.createButton(context, options);
    });
  }

  /**
   * Get tool metadata for building UIs
   * Useful for building PNP configuration interfaces
   *
   * @returns Array of tool metadata (id, name, description, pnpSupportIds)
   */
  getToolMetadata(): Array<{
    toolId: string;
    name: string;
    description: string;
    pnpSupportIds: string[];
    supportedLevels: ToolLevel[];
  }> {
    return this.getAllTools().map(tool => ({
      toolId: tool.toolId,
      name: tool.name,
      description: tool.description,
      pnpSupportIds: tool.pnpSupportIds || [],
      supportedLevels: tool.supportedLevels,
    }));
  }

  /**
   * Generate PNP support IDs from enabled tools
   * Useful for creating PNP profiles
   *
   * @param enabledToolIds - Tool IDs to enable
   * @returns Array of unique PNP support IDs
   */
  generatePNPSupportsFromTools(enabledToolIds: string[]): string[] {
    const pnpSupports = new Set<string>();

    for (const toolId of enabledToolIds) {
      const tool = this.get(toolId);
      if (tool?.pnpSupportIds) {
        for (const pnpId of tool.pnpSupportIds) {
          pnpSupports.add(pnpId);
        }
      }
    }

    return Array.from(pnpSupports);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.tools.clear();
    this.pnpIndex.clear();
  }
}
