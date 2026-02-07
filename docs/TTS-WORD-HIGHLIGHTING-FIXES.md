# TTS Word Highlighting Fixes

## Date
2026-02-06

## Summary
Fixed AWS Polly word highlighting issues in the section-demos application.

## Issues Fixed

### 1. AWS Session Token Support ✅
**Problem**: The Polly provider only supported long-term IAM credentials, but the project uses temporary AWS credentials (session token).

**Error**: `The security token included in the request is invalid`

**Fix**: Updated both API routes to conditionally include `sessionToken` when `AWS_SESSION_TOKEN` is present:
- `apps/section-demos/src/routes/api/tts/synthesize/+server.ts` (lines 35-45)
- `apps/section-demos/src/routes/api/tts/voices/+server.ts` (lines 28-37)

**Result**: Now works with both:
- Long-term IAM credentials (access key + secret)
- Temporary credentials (access key + secret + session token)

### 2. Word Length Parameter Missing ✅
**Problem**: ServerTTSProvider was passing empty string for `word` parameter, and TTSService was using `word.length` (which equals 0 for empty strings), causing highlighting to fail.

**Fix**:
1. Updated callback signature to accept optional `length` parameter:
   - `packages/assessment-toolkit/src/services/tts/provider-interface.ts` (line 96)
   - `packages/tts-client-server/src/ServerTTSProvider.ts` (line 82)

2. Updated ServerTTSProvider to pass word length as third parameter:
   - `packages/tts-client-server/src/ServerTTSProvider.ts` (line 269)

3. Updated TTSService to use `length` parameter when available:
   - `packages/assessment-toolkit/src/services/TTSService.ts` (line 217-220)

**Result**: Word highlighting now receives correct word length from speech marks.

### 3. Playback Rate Not Applied to Speech Marks ✅
**Problem**: When user changes playback rate (e.g., 0.5x, 2.0x), the audio speed changed but speech mark timings remained at 1.0x, causing highlighting to be out of sync.

**Fix**: Adjusted word timings based on playback rate before playback:
- `packages/tts-client-server/src/ServerTTSProvider.ts` (lines 95-101)

```typescript
// Adjust word timing for playback rate
const playbackRate = this.config.rate || 1.0;
this.wordTimings = wordTimings.map(timing => ({
  ...timing,
  time: timing.time / playbackRate
}));
```

**Result**: Word highlighting now stays synchronized with audio at all playback rates.

### 4. Environment Variable Loading ✅
**Problem**: SvelteKit dev server wasn't loading environment variables from monorepo root `.env` file.

**Fix**: Created server hooks to load `.env` automatically:
- `apps/section-demos/src/hooks.server.ts` (new file)
- Added `dotenv` package to `apps/section-demos/package.json`

**Result**: Environment variables now load automatically regardless of how server is started.

### 5. TTS Provider Indicator ✅
**Problem**: User couldn't tell which TTS engine (AWS Polly vs Browser TTS) was active.

**Fix**: Added visual indicator to navbar showing current TTS provider:
- `apps/section-demos/src/routes/demo/[[id]]/+page.svelte` (lines 431-450)

**Result**: Green "AWS Polly" badge when using server TTS, yellow "Browser TTS" badge when falling back.

### 6. Debug Logging ✅
Added comprehensive debug logging throughout the TTS pipeline:
- Environment variable status at startup
- Speech mark count and timings
- Word boundary events with position and length
- Text node mapping results

## Files Modified

### Core TTS Packages
1. `packages/tts-client-server/src/ServerTTSProvider.ts`
   - Added playback rate adjustment for speech marks
   - Added word length parameter to callback
   - Added extensive debug logging

2. `packages/assessment-toolkit/src/services/TTSService.ts`
   - Updated callback to accept optional length parameter
   - Added fallback to word.length for browser TTS
   - Added debug logging for word highlighting

3. `packages/assessment-toolkit/src/services/tts/provider-interface.ts`
   - Updated callback signature to support optional length parameter

### Section Demos App
1. `apps/section-demos/src/hooks.server.ts` (NEW)
   - Loads .env from monorepo root
   - Logs environment variable status

2. `apps/section-demos/src/routes/api/tts/synthesize/+server.ts`
   - Added AWS_SESSION_TOKEN support
   - Added debug logging for credentials

3. `apps/section-demos/src/routes/api/tts/voices/+server.ts`
   - Added AWS_SESSION_TOKEN support

4. `apps/section-demos/src/routes/demo/[[id]]/+page.svelte`
   - Added TTS provider state tracking
   - Added provider indicator badge in navbar

5. `apps/section-demos/package.json`
   - Added `dotenv` dependency

### Documentation
1. `.env.example`
   - Added documentation for AWS_SESSION_TOKEN

## Testing

After restarting the dev server, you should see:

1. **Server startup logs**:
   ```
   [Hooks] ✅ Loaded environment variables from: /path/to/.env
   [Hooks] AWS_REGION: ✓ Set
   [Hooks] AWS_ACCESS_KEY_ID: ✓ Set
   [Hooks] AWS_SECRET_ACCESS_KEY: ✓ Set
   [Hooks] AWS_SESSION_TOKEN: ✓ Set (temporary credentials)
   ```

2. **First TTS synthesis**:
   ```
   [TTS API] Checking environment variables...
   [TTS API] AWS_REGION: ✓ Set
   [TTS API] AWS_ACCESS_KEY_ID: ✓ Set (AKIA1234...)
   [TTS API] AWS_SECRET_ACCESS_KEY: ✓ Set (hidden)
   [TTS API] Using temporary credentials (session token present)
   [TTS API] Polly provider initialized successfully
   ```

3. **Word highlighting**:
   ```
   [ServerTTSProvider] Starting word highlighting with 47 word timings
   [ServerTTSProvider] Playback rate: 1
   [ServerTTSProvider] First 3 timings: [...]
   [ServerTTSProvider] Highlighting word at charIndex: 0 length: 1 time: 100
   [TTSService] Word boundary event: "" at position 0, length 1
   [TTSService] Found location: { node: Text, start: 0, end: 1 }
   ```

4. **Visual indicator**: Green "AWS Polly" badge in navbar

## Known Limitations

1. **Pre-existing build errors**: Unrelated TypeScript errors in calculator and QTI navigation packages prevent full build. TTS packages compile correctly in isolation.

2. **HTML entity misalignment**: Text node mapping doesn't normalize HTML entities (e.g., `&nbsp;`), which can cause slight misalignment. This is a known issue documented in the codebase analysis.

3. **DOM mutation detection**: If DOM content changes during playback, highlighting may break. No validation currently in place.

## Next Steps (Optional)

1. Fix HTML entity normalization in text node mapping
2. Add DOM mutation observer to detect content changes
3. Implement fallback to estimated speech marks when server marks unavailable
4. Fix pre-existing build errors in calculator and navigation packages

## Related Documentation

- [docs/tts-architecture.md](./tts-architecture.md) - TTS system architecture
- [docs/tts-synchronization-best-practices.md](./tts-synchronization-best-practices.md) - Best practices
- [docs/SECTION-TTS-INTEGRATION-COMPLETE.md](./SECTION-TTS-INTEGRATION-COMPLETE.md) - Integration guide
- [docs/aws-polly-setup-guide.md](./aws-polly-setup-guide.md) - AWS setup
