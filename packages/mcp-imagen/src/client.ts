/**
 * Nano Banana (Gemini Image) API client wrapper
 */

import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  GenerateImageOptions,
  GenerateImageResult,
  EditImageOptions,
  EditImageResult,
  ContinueEditingOptions,
  GeneratedImage,
  LastImageInfo,
  NanoBananaModel,
} from './types.js';
import { logger } from './logger.js';
import {
  AuthenticationError,
  InvalidPromptError,
  ImageGenerationError,
} from './errors.js';
import { imageToBase64, generateTimestampFilename, getPlatformDefaultOutputDir } from './utils.js';

export class NanoBananaClient {
  private ai: GoogleGenAI | null = null;
  private apiKey: string;
  private lastImageInfo: LastImageInfo | null = null;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new AuthenticationError('Google API key is required');
    }
    this.apiKey = apiKey;
  }

  private getClient(): GoogleGenAI {
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.ai;
  }

  getLastImageInfo(): LastImageInfo | null {
    return this.lastImageInfo;
  }

  async generateImages(options: GenerateImageOptions): Promise<GenerateImageResult> {
    const {
      prompt,
      model = 'gemini-3-pro-image-preview',
      numberOfImages = 1,
      outputDir,
      outputPrefix = 'nanobanana',
    } = options;

    // Use platform-aware default if not specified
    const resolvedOutputDir = outputDir || getPlatformDefaultOutputDir();

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      throw new InvalidPromptError('Prompt cannot be empty');
    }

    logger.info('Generating images with Nano Banana', {
      model,
      numberOfImages,
      promptLength: prompt.length,
      outputDir: resolvedOutputDir,
    });

    try {
      const ai = this.getClient();

      // Ensure output directory exists
      const absOutputDir = resolve(resolvedOutputDir);
      if (!existsSync(absOutputDir)) {
        await mkdir(absOutputDir, { recursive: true });
        logger.debug('Created output directory', { dir: absOutputDir });
      }

      // Generate images
      const savedImages: GeneratedImage[] = [];

      for (let i = 0; i < numberOfImages; i++) {
        // Use generateContent for Gemini image models
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        // Extract image data from response
        const imagePart = response.candidates?.[0]?.content?.parts?.find(
          (part: any) => part.inlineData?.mimeType?.startsWith('image/')
        );

        if (!imagePart?.inlineData?.data) {
          logger.warn('No image data in response', { attemptNumber: i + 1 });
          continue;
        }

        // Save image
        const imageBytes = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType;
        const extension = mimeType === 'image/png' ? 'png' : 'jpg';

        const buffer = Buffer.from(imageBytes, 'base64');
        const filename = generateTimestampFilename(`${outputPrefix}-${i + 1}`, extension);
        const filepath = join(absOutputDir, filename);

        await writeFile(filepath, buffer);

        savedImages.push({
          filename,
          path: filepath,
          sizeBytes: buffer.length,
        });

        logger.info('Saved image', { filename, path: filepath, size: buffer.length });

        // Update last image info
        this.lastImageInfo = {
          path: filepath,
          prompt,
          timestamp: Date.now(),
          model,
        };

        // Small delay between requests to avoid rate limits
        if (i < numberOfImages - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (savedImages.length === 0) {
        throw new ImageGenerationError('No images were generated');
      }

      return {
        success: true,
        images: savedImages,
        prompt,
        model,
        message: `Successfully generated ${savedImages.length} image(s) with ${model === 'gemini-3-pro-image-preview' ? 'Nano Banana Pro' : 'Nano Banana'}`,
      };
    } catch (error) {
      logger.error('Failed to generate images', { error, prompt: prompt.substring(0, 100) });

      if (error instanceof Error) {
        throw new ImageGenerationError(
          `Image generation failed: ${error.message}`
        );
      }

      throw new ImageGenerationError('Image generation failed with unknown error');
    }
  }

  async editImage(options: EditImageOptions): Promise<EditImageResult> {
    const {
      imagePath,
      prompt,
      model = 'gemini-3-pro-image-preview',
      referenceImages = [],
      outputDir,
      outputPrefix = 'edited',
    } = options;

    // Use platform-aware default if not specified
    const resolvedOutputDir = outputDir || getPlatformDefaultOutputDir();

    // Validate inputs
    if (!prompt || prompt.trim().length === 0) {
      throw new InvalidPromptError('Edit prompt cannot be empty');
    }

    if (!existsSync(imagePath)) {
      throw new InvalidPromptError(`Image file not found: ${imagePath}`);
    }

    logger.info('Editing image with Nano Banana', {
      model,
      imagePath,
      referenceImageCount: referenceImages.length,
      promptLength: prompt.length,
    });

    try {
      const ai = this.getClient();

      // Ensure output directory exists
      const absOutputDir = resolve(resolvedOutputDir);
      if (!existsSync(absOutputDir)) {
        await mkdir(absOutputDir, { recursive: true });
        logger.debug('Created output directory', { dir: absOutputDir });
      }

      // Prepare image parts for the request
      const parts: any[] = [];

      // Add the main image to edit
      const mainImage = await imageToBase64(imagePath);
      parts.push({
        inlineData: {
          data: mainImage.data,
          mimeType: mainImage.mimeType,
        },
      });

      // Add reference images if provided
      for (const refPath of referenceImages) {
        if (existsSync(refPath)) {
          const refImage = await imageToBase64(refPath);
          parts.push({
            inlineData: {
              data: refImage.data,
              mimeType: refImage.mimeType,
            },
          });
        } else {
          logger.warn('Reference image not found', { path: refPath });
        }
      }

      // Add the text prompt
      parts.push({ text: prompt });

      // Make the edit request
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts }],
      });

      // Extract edited image from response
      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part: any) => part.inlineData?.mimeType?.startsWith('image/')
      );

      if (!imagePart?.inlineData?.data) {
        throw new ImageGenerationError('No edited image in response');
      }

      // Save edited image
      const imageBytes = imagePart.inlineData.data;
      const mimeType = imagePart.inlineData.mimeType;
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';

      const buffer = Buffer.from(imageBytes, 'base64');
      const filename = generateTimestampFilename(outputPrefix, extension);
      const filepath = join(absOutputDir, filename);

      await writeFile(filepath, buffer);

      const editedImage: GeneratedImage = {
        filename,
        path: filepath,
        sizeBytes: buffer.length,
      };

      logger.info('Saved edited image', { filename, path: filepath, size: buffer.length });

      // Update last image info
      this.lastImageInfo = {
        path: filepath,
        prompt: `Edit: ${prompt}`,
        timestamp: Date.now(),
        model,
      };

      return {
        success: true,
        image: editedImage,
        prompt,
        originalImage: imagePath,
        model,
        message: `Successfully edited image with ${model === 'gemini-3-pro-image-preview' ? 'Nano Banana Pro' : 'Nano Banana'}`,
      };
    } catch (error) {
      logger.error('Failed to edit image', { error, imagePath, prompt: prompt.substring(0, 100) });

      if (error instanceof Error) {
        throw new ImageGenerationError(
          `Image editing failed: ${error.message}`
        );
      }

      throw new ImageGenerationError('Image editing failed with unknown error');
    }
  }

  async continueEditing(options: ContinueEditingOptions): Promise<EditImageResult> {
    if (!this.lastImageInfo) {
      throw new ImageGenerationError('No previous image to continue editing. Generate or edit an image first.');
    }

    const {
      prompt,
      model = 'gemini-3-pro-image-preview',
      outputDir,
      outputPrefix = 'continued',
    } = options;

    logger.info('Continuing edit on last image', {
      lastImage: this.lastImageInfo.path,
      prompt,
    });

    // Use the last generated/edited image as the base
    return this.editImage({
      imagePath: this.lastImageInfo.path,
      prompt,
      model,
      outputDir,
      outputPrefix,
    });
  }

  updateApiKey(newApiKey: string): void {
    if (!newApiKey || newApiKey.trim().length === 0) {
      throw new AuthenticationError('API key cannot be empty');
    }

    this.apiKey = newApiKey;
    this.ai = null; // Force recreation of client with new key
    logger.info('API key updated');
  }

  /**
   * Test the API key and connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.generateImages({
        prompt: 'A simple red circle on white background',
        numberOfImages: 1,
        model: 'gemini-2.5-flash-image',
        outputDir: '/tmp',
        outputPrefix: 'test',
      });
      return result.success;
    } catch (error) {
      logger.error('Connection test failed', { error });
      return false;
    }
  }
}
