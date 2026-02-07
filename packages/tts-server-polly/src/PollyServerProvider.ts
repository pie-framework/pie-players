/**
 * AWS Polly server-side TTS provider
 * @module @pie-players/tts-server-polly
 */

import {
  PollyClient,
  SynthesizeSpeechCommand,
  DescribeVoicesCommand,
  Engine,
  OutputFormat,
  VoiceId,
  SpeechMarkType,
  type DescribeVoicesCommandInput,
} from '@aws-sdk/client-polly';

import {
  BaseTTSProvider,
  type SynthesizeRequest,
  type SynthesizeResponse,
  type Voice,
  type GetVoicesOptions,
  type ServerProviderCapabilities,
  type SpeechMark,
  type TTSServerConfig,
  TTSError,
  TTSErrorCode,
} from '@pie-players/tts-server-core';

/**
 * AWS Polly provider configuration
 */
export interface PollyProviderConfig extends TTSServerConfig {
  /** AWS region (e.g., 'us-east-1') */
  region: string;

  /** AWS credentials */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };

  /** Engine type: 'neural' (default) or 'standard' */
  engine?: 'neural' | 'standard';

  /** Default voice ID if not specified in requests */
  defaultVoice?: string;
}

/**
 * AWS Polly Server Provider
 *
 * Provides high-quality neural text-to-speech with precise word-level timing
 * through AWS Polly speech marks.
 *
 * Features:
 * - Native speech marks support (millisecond precision)
 * - Neural and standard voices
 * - 25+ languages
 * - Full SSML support
 * - Parallel audio + speech marks requests
 */
export class PollyServerProvider extends BaseTTSProvider {
  readonly providerId = 'aws-polly';
  readonly providerName = 'AWS Polly';
  readonly version = '1.0.0';

  private client!: PollyClient;
  private engine: 'neural' | 'standard' = 'neural';
  private defaultVoice = 'Joanna';

  /**
   * Initialize the AWS Polly provider
   */
  async initialize(config: PollyProviderConfig): Promise<void> {
    if (!config.region) {
      throw new TTSError(
        TTSErrorCode.INITIALIZATION_ERROR,
        'AWS region is required',
        undefined,
        this.providerId
      );
    }

    this.config = config;
    this.engine = config.engine || 'neural';
    this.defaultVoice = config.defaultVoice || 'Joanna';

    try {
      this.client = new PollyClient({
        region: config.region,
        credentials: config.credentials,
      });

      this.initialized = true;
    } catch (error) {
      throw new TTSError(
        TTSErrorCode.INITIALIZATION_ERROR,
        `Failed to initialize AWS Polly: ${error instanceof Error ? error.message : String(error)}`,
        { error },
        this.providerId
      );
    }
  }

  /**
   * Synthesize speech with AWS Polly
   */
  async synthesize(request: SynthesizeRequest): Promise<SynthesizeResponse> {
    this.ensureInitialized();

    const capabilities = this.getCapabilities();
    this.validateRequest(request, capabilities);

    const voice = request.voice || this.defaultVoice;
    const startTime = Date.now();

    try {
      // Make parallel requests for audio and speech marks
      const [audioResponse, speechMarksResponse] = await Promise.all([
        this.synthesizeAudio(request, voice),
        request.includeSpeechMarks !== false
          ? this.synthesizeSpeechMarks(request, voice)
          : Promise.resolve([]),
      ]);

      const duration = (Date.now() - startTime) / 1000;

      return {
        audio: audioResponse.audio,
        contentType: audioResponse.contentType,
        speechMarks: speechMarksResponse,
        metadata: {
          providerId: this.providerId,
          voice,
          duration,
          charCount: request.text.length,
          cached: false,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new TTSError(
        TTSErrorCode.PROVIDER_ERROR,
        `AWS Polly synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
        { error, request },
        this.providerId
      );
    }
  }

  /**
   * Synthesize audio stream
   */
  private async synthesizeAudio(
    request: SynthesizeRequest,
    voice: string
  ): Promise<{ audio: Buffer; contentType: string }> {
    // Detect if text contains SSML tags
    const isSsml = request.text.includes('<speak') ||
                   request.text.includes('<emphasis') ||
                   request.text.includes('<break') ||
                   request.text.includes('<prosody') ||
                   request.text.includes('<phoneme') ||
                   request.text.includes('<amazon:') ||
                   request.text.includes('<aws-');

    const textType = isSsml ? 'ssml' : 'text';

    if (isSsml) {
      console.log('[PollyServerProvider] Detected SSML content, using TextType: ssml');
    }

    const command = new SynthesizeSpeechCommand({
      Engine: this.engine === 'neural' ? Engine.NEURAL : Engine.STANDARD,
      OutputFormat: OutputFormat.MP3,
      Text: request.text,
      TextType: textType,
      VoiceId: voice as VoiceId,
      SampleRate: String(request.sampleRate || 24000),
    });

    const response = await this.client.send(command);

    if (!response.AudioStream) {
      throw new Error('No audio stream received from AWS Polly');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.AudioStream;

    if (Symbol.asyncIterator in stream) {
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
    } else if (stream instanceof Uint8Array) {
      chunks.push(stream);
    }

    const audioBuffer = Buffer.concat(chunks);

    return {
      audio: audioBuffer,
      contentType: response.ContentType || 'audio/mpeg',
    };
  }

  /**
   * Synthesize speech marks
   */
  private async synthesizeSpeechMarks(request: SynthesizeRequest, voice: string): Promise<SpeechMark[]> {
    // Detect if text contains SSML tags (same logic as audio synthesis)
    const isSsml = request.text.includes('<speak') ||
                   request.text.includes('<emphasis') ||
                   request.text.includes('<break') ||
                   request.text.includes('<prosody') ||
                   request.text.includes('<phoneme') ||
                   request.text.includes('<amazon:') ||
                   request.text.includes('<aws-');

    const textType = isSsml ? 'ssml' : 'text';

    const command = new SynthesizeSpeechCommand({
      Engine: this.engine === 'neural' ? Engine.NEURAL : Engine.STANDARD,
      OutputFormat: OutputFormat.JSON,
      Text: request.text,
      TextType: textType,
      VoiceId: voice as VoiceId,
      SpeechMarkTypes: [SpeechMarkType.WORD],
    });

    const response = await this.client.send(command);

    if (!response.AudioStream) {
      return [];
    }

    // Convert stream to text
    const chunks: Uint8Array[] = [];
    const stream = response.AudioStream;

    if (Symbol.asyncIterator in stream) {
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
    } else if (stream instanceof Uint8Array) {
      chunks.push(stream);
    }

    const marksText = Buffer.concat(chunks).toString('utf-8');

    // Parse NDJSON (newline-delimited JSON)
    // Each line is a separate JSON object
    const speechMarks = marksText
      .trim()
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const mark = JSON.parse(line);
        return {
          time: mark.time,
          type: 'word' as const,
          start: mark.start,
          end: mark.end,
          value: mark.value,
        };
      });

    return speechMarks;
  }

  /**
   * Get available voices from AWS Polly
   */
  async getVoices(options?: GetVoicesOptions): Promise<Voice[]> {
    this.ensureInitialized();

    try {
      const input: DescribeVoicesCommandInput = {
        Engine: this.engine === 'neural' ? Engine.NEURAL : Engine.STANDARD,
      };

      if (options?.language) {
        input.LanguageCode = options.language as any;
      }

      const command = new DescribeVoicesCommand(input);
      const response = await this.client.send(command);

      if (!response.Voices) {
        return [];
      }

      return response.Voices.map((voice) => ({
        id: voice.Id!,
        name: voice.Name!,
        language: voice.LanguageName!,
        languageCode: voice.LanguageCode!,
        gender: voice.Gender?.toLowerCase() as 'male' | 'female' | 'neutral' | undefined,
        quality: (this.engine === 'neural' ? 'neural' : 'standard') as 'neural' | 'standard' | 'premium',
        supportedFeatures: {
          ssml: true,
          emotions: false,
          styles: false,
        },
        providerMetadata: {
          supportedEngines: voice.SupportedEngines,
          additionalLanguageCodes: voice.AdditionalLanguageCodes,
        },
      })).filter((voice) => {
        // Apply filters
        if (options?.gender && voice.gender !== options.gender) {
          return false;
        }
        if (options?.quality && voice.quality !== options.quality) {
          return false;
        }
        return true;
      });
    } catch (error) {
      throw new TTSError(
        TTSErrorCode.PROVIDER_ERROR,
        `Failed to get voices: ${error instanceof Error ? error.message : String(error)}`,
        { error },
        this.providerId
      );
    }
  }

  /**
   * Get AWS Polly capabilities
   */
  getCapabilities(): ServerProviderCapabilities {
    return {
      supportsSpeechMarks: true, // ✅ Native support via WORD speech marks
      supportsSSML: true, // ✅ Full SSML support
      supportsPitch: false, // ❌ Use SSML prosody tag instead
      supportsRate: true, // ✅ Via SSML prosody tag
      supportsVolume: false, // ❌ Use client-side audio volume
      supportsMultipleVoices: true, // ✅ 25+ languages, 60+ voices
      maxTextLength: 3000, // AWS Polly limit
      supportedFormats: ['mp3'], // MP3 only for now
    };
  }

  /**
   * Clean up AWS Polly client
   */
  async destroy(): Promise<void> {
    if (this.client) {
      this.client.destroy();
    }
    await super.destroy();
  }
}
