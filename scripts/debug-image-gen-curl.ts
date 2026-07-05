import { spawnSync } from 'node:child_process';
import { createScriptPrismaClient } from './prisma-client';

const prisma = createScriptPrismaClient();

const keys = [
  'image_gen.api_key',
  'image_gen.base_url',
  'image_gen.model',
  'image_gen.api_mode',
];

const rows = await prisma.tbConfig.findMany({
  where: { key: { in: keys } },
});

await prisma.$disconnect();

const configs = Object.fromEntries(rows.map((row) => [row.key ?? '', row.value ?? '']));
const apiKey = configs['image_gen.api_key'];
const baseUrl = configs['image_gen.base_url'];
const model = configs['image_gen.model'] || 'gpt-image-2';
const apiMode = configs['image_gen.api_mode'] || 'chat_completions';

const maskedApiKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : null;

console.log('Current image_gen config:');
console.log(JSON.stringify({
  'image_gen.api_key': maskedApiKey,
  'image_gen.base_url': baseUrl || null,
  'image_gen.model': model,
  'image_gen.api_mode': apiMode,
}, null, 2));

if (!apiKey || !baseUrl) {
  throw new Error('image_gen.api_key 或 image_gen.base_url 未配置');
}

const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
const endpoint = apiMode === 'images_generations'
  ? `${normalizedBaseUrl}/v1/images/generations`
  : `${normalizedBaseUrl}/v1/chat/completions`;
const payload = apiMode === 'images_generations'
  ? {
      model,
      prompt: '生成一张简单的蓝色圆形图标，纯色背景',
      n: 1,
      size: '1024x1024',
      quality: process.env.DEBUG_IMAGE_QUALITY || 'medium',
    }
  : {
      model,
      messages: [
        {
          role: 'user',
          content: '生成一张简单的蓝色圆形图标，纯色背景',
        },
      ],
    };

console.log('\nCurl target:');
console.log(endpoint);
console.log('\nCurl payload:');
console.log(JSON.stringify(payload, null, 2));

const result = spawnSync('curl.exe', [
  '-sS',
  '-i',
  '-X',
  'POST',
  endpoint,
  '-H',
  `Authorization: Bearer ${apiKey}`,
  '-H',
  'Content-Type: application/json',
  '--data',
  JSON.stringify(payload),
], {
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 10,
});

if (result.error) {
  throw result.error;
}

console.log('\nCurl exit code:');
console.log(result.status);

if (result.stderr) {
  console.log('\nCurl stderr:');
  console.log(result.stderr);
}

console.log('\nCurl response:');
console.log(result.stdout.slice(0, 5000));
