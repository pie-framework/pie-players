# AWS Polly Setup Guide for TTS

This guide sets up AWS Polly credentials for server-side text-to-speech with
speech marks, the word timings that drive highlighting. It is for contributors
running the pie-players section demos against Polly, and for host teams
provisioning credentials for their own Polly-backed TTS route.

## Prerequisites

- An AWS account ([sign up](https://aws.amazon.com/))
- Basic familiarity with AWS IAM (Identity and Access Management)

## Step 1: Create IAM User

1. Log in to the [AWS Console](https://console.aws.amazon.com/)
2. Navigate to the **IAM** service
3. Click **Users** in the left sidebar
4. Click **Create user**
5. Set the username: `pie-tts-service` (or your preferred name)
6. Click **Next**

## Step 2: Attach Minimal Permissions Policy

### Option A: Provided Policy (Recommended)

1. On the permissions page, select **Attach policies directly**
2. Click **Create policy**
3. Switch to the **JSON** tab
4. Paste the contents of [`aws-polly-iam-policy.json`](./aws-polly-iam-policy.json):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PollySynthesisOnly",
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech",
        "polly:DescribeVoices"
      ],
      "Resource": "*"
    }
  ]
}
```

5. Click **Next**
6. Set the policy name: `PIE-TTS-PollyAccess`
7. Click **Create policy**
8. Go back to the user creation tab and refresh the policies list
9. Search for and select `PIE-TTS-PollyAccess`
10. Click **Next**

### Option B: AWS Managed Policy

`AmazonPollyReadOnlyAccess` grants broader access than synthesis needs, so it
does not belong in production:

1. Search for `AmazonPollyReadOnlyAccess`
2. Select it
3. Click **Next**

## Step 3: Create Access Keys

1. After creating the user, click the username
2. Go to the **Security credentials** tab
3. Scroll to **Access keys**
4. Click **Create access key**
5. Select **Application running outside AWS**
6. Click **Next**
7. (Optional) Add a description tag: `PIE TTS Development`
8. Click **Create access key**

## Step 4: Save Credentials

AWS shows the secret access key once; save both values before leaving the page.

1. Click **Download .csv file** or copy the values
2. Store them in your password manager
3. Click **Done**

The credentials are:

- **Access key ID**: `AKIA...` (20 characters)
- **Secret access key**: `wJalr...` (40 characters)

## Step 5: Configure Environment Variables

In a pie-players checkout:

1. Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...your_key_here
AWS_SECRET_ACCESS_KEY=wJalr...your_secret_here
# Temporary credentials (AWS SSO, an assumed role) also need:
# AWS_SESSION_TOKEN=...
```

`.env` is in `.gitignore`; never commit it.

## Step 6: Test the Setup

Run the section demos:

```bash
bun run dev:section
```

Open a demo and start a read-aloud. The browser request to the demo TTS API
succeeds, audio plays, and words highlight when the response includes speech
marks. The server log shows `[TTS API] Polly provider initialized successfully`.

## Security

- Grant only `polly:SynthesizeSpeech` and `polly:DescribeVoices`, through the
  policy above; never use root account credentials.
- Rotate access keys regularly (every 90 days).
- Use IAM roles in production (see [Production Deployment](#production-deployment)).
- Enable CloudTrail logging and billing alerts to monitor Polly usage.
- Keep credentials out of source code, version control, email and chat.

## Cost Management

A read with highlighting makes two SynthesizeSpeech requests (audio and speech
marks), each billed by characters
([current rates](https://aws.amazon.com/polly/pricing/)).

- **Cache synthesis results on the server.** The section-demos routes call Polly
  on every request. A production route checks a cache before calling Polly;
  `@pie-players/tts-server-core` exports the `ITTSCache` interface, a
  `MemoryCache` and `generateHashedCacheKey` for it.
- **Use standard voices in development.** Standard voices are billed at a lower
  rate than neural ones. The demo routes take the engine from each request's
  `engine` field (`"standard"` or `"neural"`, default `"neural"`).
- **Monitor usage** with CloudWatch metrics for `SynthesizeSpeech` calls and
  billing alerts.

## Production Deployment

### IAM Roles

In production, an IAM role replaces access keys: attach a role with the
`PIE-TTS-PollyAccess` policy to the EC2 instance, the ECS or Fargate task
definition, or the Lambda function, or use IRSA (IAM Roles for Service Accounts)
on EKS. A host route that omits `credentials` from
`PollyServerProvider.initialize` gets the AWS SDK's default credential chain,
which picks up the role, so the deployment sets no `AWS_ACCESS_KEY_ID` or
`AWS_SECRET_ACCESS_KEY`. The section-demos routes always read keys from `.env`.

### Secrets

Where a deployment needs keys, they come from the platform's secrets store:
Docker or Kubernetes Secrets, AWS Systems Manager Parameter Store or Secrets
Manager, or the hosting platform's environment variable settings.

## Troubleshooting

### Credentials Not Configured

The section-demos route reports `AWS credentials not configured` when
`AWS_REGION`, `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` is unset; a host
route on the AWS SDK reports `Could not load credentials from any providers`.

**Fix**:

1. Verify that `.env` exists in the project root
2. Check that the three variables are set
3. Run scripts through `dotenvx run --`; the root `dev:section` script does

### AccessDeniedException

**Cause**: the IAM user lacks the required permissions.

**Fix**:

1. Verify that the IAM policy includes `polly:SynthesizeSpeech`
2. Check that the policy is attached to the user
3. Wait 5 minutes for IAM changes to propagate

### Unsupported Region

**Cause**: Polly is not available in the configured region.

**Fix**: use a supported region (for example `us-east-1`, `us-west-2` or
`eu-west-1`):

```bash
AWS_REGION=us-east-1
```

### Unexpected Charges

1. Check CloudTrail logs for `SynthesizeSpeech` calls
2. Cache synthesis results to reduce duplicate requests
3. Check for loops or automated tests calling the API

## Additional Resources

- [AWS Polly integration guide](../../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md): the server routes that call Polly
- [TTS deep dive](./tts-deep-dive.md): how PIE requests and plays speech
- [AWS Polly Documentation](https://docs.aws.amazon.com/polly/)
- [AWS Polly Speech Marks](https://docs.aws.amazon.com/polly/latest/dg/speechmarks.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Pricing Calculator](https://calculator.aws/)
