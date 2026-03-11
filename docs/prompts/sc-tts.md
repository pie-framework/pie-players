# Text to Speech (TTS)

Text to Speech (TTS) service allows students to read text aloud while taking online tests. This service is currently used by internal student portal products. The service uses Amazon Polly which is based on deep learning technologies to synthesize natural-sounding human speech. The service helps to highlight the text that is being read aloud using the speech marks metadata. By using speech marks in conjunction with the synthesized speech audio stream, the TTS service provides applications with an enhanced visual experience.

## Features Supported

- SSML
- Multiple languages support
- Pitch
- Speed
- Voice
- Read images with alt tag
- Automatic conversion of Mathjax equations to human-readable text

## Tech Stacks

- NodeJS 18.x, 20.x

## Technology Dependencies

| Technology | Current Version | Latest Version | Licensing | Purpose |
|---|---|---|---|---|
| AWS Polly | — | — | $4.00 per 1 million characters | AWS AI to take the text and return the audio and speechmarks file |
| DynamoDB | — | — | $1.25 per million write request units / $0.25 per million read request units | Database with the metadata of the audio and speechmarks file which are stored in S3 |
| AWS S3 | — | — | First 50 TB/Month - $0.023 per GB | Audio and Speechmarks files are stored here |
| AWS CloudFront | — | — | N/A | Low latency with high transfer speed |
| @aws-sdk/client-dynamodb | 3.325.0 | 3.325.0 | Free | AWS SDK to write the audio and speech marks URLs to DynamoDB |
| @aws-sdk/client-polly | 3.325.0 | 3.325.0 | Free | AWS SDK to generate audio and speech marks files from input text |
| @aws-sdk/client-s3 | 3.325.0 | 3.325.0 | Free | AWS SDK to write audio and speech marks file to S3 bucket |
| @aws-sdk/util-dynamodb | 3.325.0 | 3.325.0 | Free | AWS SDK to marshall/unmarshall JSON metadata |
| fastify | 4.17.0 | 4.17.0 | Free | Framework to handle routing |
| fastify-no-icon | 6.0.0 | 6.0.0 | Free | Plugin to prevent 404 errors when there is no favicon.ico |
| fastify-plugin | 4.5.0 | 4.5.0 | Free | Fastify library to modularize code |
| @fastify/cors | 8.2.1 | 8.2.1 | Free | Fastify library to add cors options |
| @fastify/helmet | 10.1.0 | 10.1.0 | Free | Important security headers for Fastify |
| @fastify/jwt | 6.7.1 | 6.7.1 | Free | Fastify library to verify JWT tokens |
| speech-rule-engine | 4.1.0-beta.3 | 4.1.0-beta.3 | Free | Used to convert mathml to a sentence |

## Git Repo Path

- https://github.com/illuminateeducation/sc-texttospeech-api *(RESTRICTED)*
- https://github.com/illuminateeducation/sc-texttospeech-terraform *(RESTRICTED)*
- https://github.com/illuminateeducation/sc-texttospeech-automation *(RESTRICTED)*

## Demo Link

Access from internal simulator tooling.

> **Note:** Access requires membership in the appropriate internal access group.

## Architecture

### Hosting

- Hosted on ECS with Fargate.
- Deployment is automated; the infrastructure is deployed using Terraform.
- S3 is used for storing audio mp3 files. All mp3s are accessed via CloudFront.

## Service Endpoint

| Product | Endpoint |
|---|---|
| Product A | `https://tts.internal.example/v1.0/` |
| Product B | `https://tts.internal.example/v1.1/` |

**Method:** `POST`

### Request Payload

```json
{
  "text": "Which sentence in the fifth paragraph contains unnecessary information that should be removed?",
  "speedRate": "medium",
  "lang_id": "en-US"
}
```

### Response

TTS service returns two URLs along with the status code. One URL is the audio file which is stored in S3 and the other is the speech marks file which is used to highlight the words while reading.

## How to Integrate

### Javascript

- https://github.com/illuminateeducation/sc-suite-staff/blob/2d38fc8334996aadadb0678e55ae396258ebc884/WebContent/WEB-INF/Javascript/onlinepreview/vendor/Polly.js
- https://github.com/illuminateeducation/sc-suite-student/blob/master/StudentPortal.Web/Scripts/Common/Polly.js

The above js file has to be included on the client side and the `Polly.init("service_url")` and `Polly.buildSentence($container, "unique id")` functions called.

- `$container` is the ID of the DOM element
- `service_url` should be the URL of the service, e.g. `https://tts.internal.example/v1.0/`

> The `Polly.buildSentence()` function should be called when the entire DOM content is loaded to ensure that all the sentences are parsed by the library.

### Additional Javascript Libraries

- **getSentence.js** — used for "sentence boundary detection"
  https://github.com/illuminateeducation/sc-suite-student/blob/master/StudentPortal.Web/Scripts/External/getSentence.js

- **jquery.blast.js** — used for wrapping tags with the "thawsspan" tag, which does a good job when traversing the DOM and applying the tags
  https://github.com/illuminateeducation/sc-suite-student/blob/master/StudentPortal.Web/Scripts/External/jquery.blast.js

## Authorization

The authorization is implemented using JWT and is included as a Bearer token in the authorization header. We use the JWT shared secret method to sign and verify the JWT token.

> **Note:** The JWT payload should include the `iss` claim. This is to allow the use of multiple shared secrets based on the product that is consuming the service. Valid values are:
> - `sc`
> - `dna`

## Response Handling

Response handling is handled by the `Polly.js` library itself. No additional code is required to handle this.

## PIE Translation Notes

When integrating a custom URL-based backend through PIE server-backed TTS clients:

- Configure server transport mode as `custom` (root POST contract).
- Map backend request fields (`speedRate`, `lang_id`, `cache`) from app-level rate/language settings.
- Parse `word` JSONL speech marks into normalized word timing records for highlighting.
- Fetch `audioContent` URL and normalize it to browser-playable audio for consistent client behavior.
- Keep browser, Polly, and Google modes on the default PIE transport mode for existing behavior.

## Math

- **Math engine rule:** [Speech-Rule-Engine/speech-rule-engine](https://github.com/Speech-Rule-Engine/speech-rule-engine)
- **Math Speak Grammar:** [MathSpeak: Quick MathSpeak Tutorial](https://www.mathspeak.org)

## Dependencies / Risks

The service is used by multiple products. Enhancements and releases must be coordinated and announced to all products.
