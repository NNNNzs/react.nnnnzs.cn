import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});


export const generDescription = async (content: string) => {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0.9,
    messages: [
      { role: 'assistant', content: 'always answer in Chinese' },
      { role: 'assistant', content: `你是一个文章描述生成器，请你以主人公第一人称的视角描述这篇文章的内容，简洁的描述，可以艺术加工而不是流水账，不要纯文本格式不要用Markdown语法，描述不超过100个字符` },
      { role: 'user', content: content }
    ],
  });
  return response.content[0].type === 'text' ? response.content[0].text as string : '';
}
