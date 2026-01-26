/**
 * Type definitions for Nano Banana (Gemini Image) MCP server
 */

export type NanoBananaModel =
  | 'gemini-3-pro-image-preview'    // Nano Banana Pro - Professional quality
  | 'gemini-2.5-flash-image';       // Nano Banana - Fast and efficient

export interface GenerateImageOptions {
  prompt: string;
  model?: NanoBananaModel;
  numberOfImages?: number;  // Typically 1-4
  outputDir?: string;
  outputPrefix?: string;
}

export interface EditImageOptions {
  imagePath: string;
  prompt: string;
  model?: NanoBananaModel;
  referenceImages?: string[];  // Optional reference images for style guidance
  outputDir?: string;
  outputPrefix?: string;
}

export interface ContinueEditingOptions {
  prompt: string;
  model?: NanoBananaModel;
  outputDir?: string;
  outputPrefix?: string;
}

export interface GeneratedImage {
  filename: string;
  path: string;
  sizeBytes: number;
}

export interface GenerateImageResult {
  success: boolean;
  images: GeneratedImage[];
  prompt: string;
  model: string;
  message: string;
}

export interface EditImageResult {
  success: boolean;
  image: GeneratedImage;
  prompt: string;
  originalImage: string;
  model: string;
  message: string;
}

export interface LastImageInfo {
  path: string;
  prompt: string;
  timestamp: number;
  model: string;
}

export interface Config {
  apiKey?: string;
  defaultModel?: NanoBananaModel;
  defaultOutputDir?: string;
}
