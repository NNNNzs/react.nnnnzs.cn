/**
 * 实体变更历史查询 API
 *
 * GET /api/entity-change/:entityType/:entityId
 *
 * 查询特定实体的变更历史
 *
 * 路径参数：
 * - entityType: 实体类型（POST, COLLECTION）
 * - entityId: 实体ID
 *
 * 查询参数：
 * - limit: 返回数量限制（默认50）
 * - offset: 偏移量（默认0）
 * - fieldName: 字段名（可选，过滤特定字段）
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryEntityChangeLogs } from '@/services/entity-change-log';
import { EntityType } from '@/types/entity-change';
import { getPostByIdIncludingDeleted } from '@/services/post';
import { getPrisma } from '@/lib/prisma';
import { getAuthUserFromRequest } from '@/lib/auth';
import { canViewPost } from '@/lib/permission';

interface ArticleSnapshot {
  id: number;
  title: string;
  path: string;
}

function parsePostsValue(value: string | null): unknown[] {
  if (!value) return [];
  try {
    let parsed: unknown = JSON.parse(value);
    // 兼容早期日志将 JSON 字符串再次 JSON.stringify 的格式。
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getArticleId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'number' && Number.isInteger(id)) return id;
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
  }
  return null;
}

function toArticleSnapshots(
  values: unknown[],
  currentArticles: Map<number, { title: string | null; path: string }>,
): ArticleSnapshot[] {
  return values.flatMap((value) => {
    const id = getArticleId(value);
    if (id === null) return [];

    const stored = value && typeof value === 'object'
      ? value as { title?: unknown; path?: unknown }
      : {};
    const current = currentArticles.get(id);
    const title = typeof stored.title === 'string'
      ? stored.title
      : current?.title || (current ? '未命名文章' : `文章已删除（原 ID：${id}）`);
    const path = typeof stored.path === 'string' ? stored.path : current?.path || '';

    return [{ id, title, path }];
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  try {
    const { entityType, entityId } = await params;
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const fieldName = searchParams.get('fieldName') || undefined;

    // 验证实体类型
    if (!Object.values(EntityType).includes(entityType as EntityType)) {
      return NextResponse.json(
        {
          error: '无效的实体类型',
          message: `支持的实体类型: ${Object.values(EntityType).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 验证实体ID
    const entityIdNum = parseInt(entityId);
    if (isNaN(entityIdNum)) {
      return NextResponse.json(
        { error: '无效的实体ID', message: 'entityId 必须是数字' },
        { status: 400 }
      );
    }

    let privateHeaders: Record<string, string> | undefined;
    if (entityType === EntityType.POST) {
      const post = await getPostByIdIncludingDeleted(entityIdNum);
      if (!post) {
        return NextResponse.json({ error: '文章不存在', message: '文章不存在' }, { status: 404 });
      }
      const user = await getAuthUserFromRequest(request.headers);
      if (!canViewPost(user, post)) {
        return NextResponse.json({ error: '无权限', message: '无权限查看此文章的变更历史' }, { status: 403 });
      }
      if (post.hide === '1' || post.is_delete !== 0) {
        privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' };
      }
    }

    // 查询变更日志
    const logs = await queryEntityChangeLogs({
      entityId: entityIdNum,
      entityType: entityType as EntityType,
      fieldName,
      limit,
      offset,
    });

    let responseLogs = logs;
    if (entityType === EntityType.COLLECTION) {
      const postLogs = logs.filter((log) => log.fieldName === 'posts');
      const referencedIds = new Set<number>();
      for (const log of postLogs) {
        for (const value of [...parsePostsValue(log.oldValue), ...parsePostsValue(log.newValue)]) {
          const id = getArticleId(value);
          if (id !== null) referencedIds.add(id);
        }
      }

      if (referencedIds.size > 0) {
        const prisma = await getPrisma();
        const articles = await prisma.tbPost.findMany({
          where: { id: { in: [...referencedIds] } },
          select: { id: true, title: true, path: true },
        });
        const currentArticles = new Map(articles.map((article) => [
          article.id,
          { title: article.title, path: article.path },
        ]));

        responseLogs = logs.map((log) => log.fieldName !== 'posts' ? log : {
          ...log,
          oldValue: JSON.stringify(toArticleSnapshots(parsePostsValue(log.oldValue), currentArticles)),
          newValue: JSON.stringify(toArticleSnapshots(parsePostsValue(log.newValue), currentArticles)),
        });
      }
    }

    // 返回结果
    return NextResponse.json({
      success: true,
      data: {
        entityType,
        entityId: entityIdNum,
        total: responseLogs.length,
        logs: responseLogs,
      },
    }, { headers: privateHeaders });
  } catch (error) {
    console.error('查询变更历史失败:', error);
    return NextResponse.json(
      {
        error: '查询失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
