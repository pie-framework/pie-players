# AWS Polly Setup Guide for TTS

This guide walks through setting up AWS Polly credentials for server-side Text-to-Speech with speech marks support.

## Prerequisites

- AWS Account ([Sign up here](https://aws.amazon.com/))
- Basic familiarity with AWS IAM (Identity and Access Management)

## Step 1: Create IAM User

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **IAM** service
3. Click **Users** in the left sidebar
4. Click **Create user**
5. Set username: `pie-tts-service` (or your preferred name)
6. Click **Next**

## Step 2: Attach Minimal Permissions Policy

### Option A: Use the Provided Policy (Recommended)

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
6. Set policy name: `PIE-TTS-PollyAccess`
7. Click **Create policy**
8. Go back to the user creation tab and refresh the policies list
9. Search for and select `PIE-TTS-PollyAccess`
10. Click **Next**

### Option B: Use AWS Managed Policy (Less Secure)

If you prefer to use an AWS managed policy (not recommended for production):

1. Search for `AmazonPollyReadOnlyAccess`
2. Select it (this gives broader access than needed)
3. Click **Next**

## Step 3: Create Access Keys

1. After creating the user, click on the username
2. Go to the **Security credentials** tab
3. Scroll to **Access keys**
4. Click **Create access key**
5. Select **Application running outside AWS**
6. Click **Next**
7. (Optional) Add a description tag: `PIE TTS Development`
8. Click **Create access key**

## Step 4: Save Credentials Securely

**CRITICAL**: Save these credentials immediately - you cannot view the secret key again!

1. Click **Download .csv file** or copy the values
2. Store in your password manager (recommended)
3. Click **Done**

You'll have:
- **Access key ID**: `AKIA...` (20 characters)
- **Secret access key**: `wJalr...` (40 characters)

## Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...your_key_here
AWS_SECRET_ACCESS_KEY=wJalr...your_secret_here
```

3. **NEVER commit `.env`** - it's already in `.gitignore`

## Step 6: Test the Setup

Run a demo to verify TTS works:

```bash
bun run dev:example
```

Visit the demo and try the TTS feature. Check the browser console for:

```
[PollyServerProvider] Initialized with voice: Joanna
[TTS API] Synthesis complete: 150ms
```

## Security Best Practices

### ✅ DO

- **Use IAM users with minimal permissions** (only `polly:SynthesizeSpeech` and `polly:DescribeVoices`)
- **Rotate access keys regularly** (every 90 days)
- **Use IAM roles in production** (EC2, ECS, Lambda - no hardcoded keys)
- **Enable CloudTrail logging** to monitor Polly API usage
- **Set up billing alerts** to monitor costs

### ❌ DON'T

- **Don't commit `.env` files** to version control
- **Don't use root account credentials**
- **Don't grant admin or broad permissions**
- **Don't share credentials via email, Slack, etc.**
- **Don't hardcode credentials in source code**

## Cost Management

### Pricing (as of 2024)

- **Standard voices**: $4 per 1M characters
- **Neural voices**: $16 per 1M characters
- **Speech marks**: Included (no extra charge)

### Example Costs

**Scenario**: 1000 students, each listening to 5 passages of 500 words

- Characters: 1000 × 5 × 500 words × 5 chars/word = **12.5M characters**
- Cost (neural): ~$200 without caching
- Cost (neural + 80% cache hit): ~$40

### Reduce Costs

1. **Enable Redis caching** (see `.env.example`)
   - 24-hour TTL
   - 70-90% cost reduction for repeated content

2. **Use standard voices in development**
   ```bash
   POLLY_ENGINE=standard
   ```

3. **Monitor usage in AWS Console**
   - CloudWatch metrics for `polly:SynthesizeSpeech` calls
   - Set up billing alerts

## Production Deployment

### Use IAM Roles (Recommended)

Instead of access keys, use IAM roles for:

- **EC2**: Attach role to instance
- **ECS/Fargate**: Attach role to task definition
- **Lambda**: Attach role to function
- **EKS**: Use IRSA (IAM Roles for Service Accounts)

**Example for EC2**:

1. Create IAM role with `PIE-TTS-PollyAccess` policy
2. Attach role to EC2 instance
3. Remove `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from `.env`
4. AWS SDK will automatically use the instance role

### Environment Variables in Production

- **Docker**: Use secrets management (Docker Secrets, Kubernetes Secrets)
- **AWS**: Use Systems Manager Parameter Store or Secrets Manager
- **Vercel/Netlify**: Use environment variable settings in dashboard

## Troubleshooting

### Error: "Missing credentials in config"

**Cause**: `.env` file not loaded or missing credentials

**Fix**:
1. Verify `.env` exists in project root
2. Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
3. Ensure running scripts with `dotenvx run --`

### Error: "AccessDeniedException"

**Cause**: IAM user lacks required permissions

**Fix**:
1. Verify IAM policy includes `polly:SynthesizeSpeech`
2. Check the policy is attached to the user
3. Wait 5 minutes for IAM changes to propagate

### Error: "InvalidRegion"

**Cause**: Polly not available in specified region

**Fix**: Use a supported region (e.g., `us-east-1`, `us-west-2`, `eu-west-1`)

```bash
AWS_REGION=us-east-1
```

### High Costs / Unexpected Charges

**Investigate**:
1. Check CloudTrail logs for `SynthesizeSpeech` calls
2. Enable Redis caching to reduce duplicate requests
3. Check for infinite loops or automated testing hitting the API

## Additional Resources

- [AWS Polly Documentation](https://docs.aws.amazon.com/polly/)
- [AWS Polly Speech Marks](https://docs.aws.amazon.com/polly/latest/dg/speechmarks.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Pricing Calculator](https://calculator.aws/)

## Support

For issues with:
- **PIE TTS integration**: See [TTS Architecture](./tts-architecture.md)
- **Server-side setup**: See [TTS Integration Guide](../packages/tts-server-polly/examples/INTEGRATION-GUIDE.md)
- **AWS account issues**: Contact AWS Support
