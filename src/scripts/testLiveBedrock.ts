import 'dotenv/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
} from '@aws-sdk/client-bedrock-runtime';

async function main() {
  console.log('='.repeat(70));
  console.log('  FirstFix MCP - Amazon Bedrock Nova Pro Live Smoke Test');
  console.log('='.repeat(70));

  const region = process.env.AWS_REGION || 'us-east-1';
  const modelId = process.env.BEDROCK_VISION_MODEL_ID || 'us.amazon.nova-pro-v1:0';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  console.log(`Target Region:   ${region}`);
  console.log(`Target Model ID: ${modelId}`);

  // Check if live credentials exist
  if (!accessKeyId || !secretAccessKey || accessKeyId === 'mock' || accessKeyId.includes('YOUR_')) {
    console.log('\n[INFO] No live AWS Credentials detected in environment or .env.');
    console.log('\n--- Step-by-Step Guide to Enable Live Amazon Bedrock Nova Pro ---');
    console.log('1. Log into your AWS Console (https://aws.amazon.com/console).');
    console.log('2. Navigate to Amazon Bedrock -> "Model access" in us-east-1 (N. Virginia).');
    console.log('3. Ensure "Amazon Nova Pro" (model ID: us.amazon.nova-pro-v1:0) access is requested and active.');
    console.log('4. Create an IAM User or Access Key with policy: AmazonBedrockFullAccess (or bedrock:InvokeModel).');
    console.log('5. Create a .env file in the project root (d:\\firstfix-mcp-alexa-plus\\.env) with:');
    console.log('   AWS_REGION=us-east-1');
    console.log('   AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxx');
    console.log('   AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    console.log('   BEDROCK_MODE=live');
    console.log('   BEDROCK_VISION_MODEL_ID=us.amazon.nova-pro-v1:0');
    console.log('6. Run "npm run test:bedrock" again to verify live multimodal inference.\n');
    console.log('='.repeat(70));
    return;
  }

  console.log(`\nAWS Credentials found: Key ID ${accessKeyId.slice(0, 4)}...${accessKeyId.slice(-4)}`);
  console.log('Initiating test ConverseCommand with Nova Pro...');

  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    },
  });

  const promptText = `You are FirstFix Vision AI. Extract the appliance metadata strictly as JSON with keys: modelNumber, serialNumber, brand, errorCodes.
Rating plate OCR text:
"Bosch Dishwasher Model SHPM65Z55N/01 Serial FD990400412 Error E24 120V 60Hz 12A"`;

  const input: ConverseCommandInput = {
    modelId,
    messages: [
      {
        role: 'user',
        content: [{ text: promptText }],
      },
    ],
    inferenceConfig: {
      maxTokens: 512,
      temperature: 0.0,
      topP: 1.0,
    },
  };

  const startTime = Date.now();
  try {
    const command = new ConverseCommand(input);
    const response = await client.send(command);
    const latencyMs = Date.now() - startTime;

    console.log(`\n>>> Live Bedrock Response Received in ${latencyMs}ms! <<<`);
    console.log('Stop Reason:', response.stopReason);
    console.log('Token Usage:', JSON.stringify(response.usage, null, 2));

    const outputMessage = response.output?.message?.content?.[0]?.text;
    console.log('\nModel Output Content:');
    console.log(outputMessage);
    console.log('\n[SUCCESS] Amazon Bedrock Nova Pro is operating properly.');
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    console.error(`\n[ERROR] Bedrock call failed after ${latencyMs}ms:`, err?.message || err);
    if (err?.name === 'UnrecognizedClientException' || err?.name === 'InvalidSignatureException') {
      console.error('Hint: Check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
    } else if (err?.name === 'AccessDeniedException') {
      console.error('Hint: Ensure your IAM role has "bedrock:InvokeModel" permission.');
    }
  }
}

main().catch((err) => {
  console.error('Fatal error running Bedrock test:', err);
  process.exit(1);
});
