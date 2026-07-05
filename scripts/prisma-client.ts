import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma-client/client';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL 未配置，无法初始化 Prisma Client');
  }
  return url;
}

export function createScriptPrismaClient(): PrismaClient {
  const adapter = new PrismaMariaDb(getDatabaseUrl());
  return new PrismaClient({ adapter });
}
