import { createScriptPrismaClient } from '../prisma-client';

const prisma = createScriptPrismaClient();

const key = 'image_gen.api_mode';

const existing = await prisma.tbConfig.findFirst({
  where: { key },
});

const data = {
  title: '图片生成 - 接口模式',
  value: existing?.value || 'chat_completions',
  status: 1,
  remark: '图片生成接口模式：chat_completions 使用 /v1/chat/completions；images_generations 使用 /v1/images/generations',
  updated_at: new Date(),
};

const config = existing
  ? await prisma.tbConfig.update({
      where: { id: existing.id },
      data,
    })
  : await prisma.tbConfig.create({
      data: {
        key,
        ...data,
        created_at: new Date(),
      },
    });

console.log(JSON.stringify({
  id: config.id,
  key: config.key,
  value: config.value,
  status: config.status,
  title: config.title,
}, null, 2));

await prisma.$disconnect();
