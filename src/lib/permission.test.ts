import assert from 'node:assert/strict';
import test from 'node:test';
import type { SerializedPost } from '@/dto/post.dto';
import type { AuthUser } from '@/types/auth';
import { canViewPost } from '@/lib/permission';

function post(overrides: Partial<SerializedPost> = {}): SerializedPost {
  return {
    id: 1,
    title: 'private post',
    content: 'secret',
    description: null,
    path: '/2026/08/01/private-post',
    date: '2026-08-01T00:00:00.000Z',
    updated: '2026-08-01T00:00:00.000Z',
    tags: [],
    category: null,
    cover: null,
    layout: null,
    hide: '0',
    is_delete: 0,
    likes: 0,
    visitors: 0,
    created_by: 7,
    ...overrides,
  } as SerializedPost;
}

function user(dataScopes: Record<string, string>): AuthUser {
  return {
    id: 7,
    account: 'editor',
    nickname: 'Editor',
    avatar: null,
    roles: ['admin'],
    permissions: Object.keys(dataScopes),
    dataScopes,
  };
}

test('公开文章允许匿名读取', () => {
  assert.equal(canViewPost(null, post()), true);
});

test('隐藏文章只允许文章查看数据范围覆盖的用户读取', () => {
  const hidden = post({ hide: '1' });
  assert.equal(canViewPost(null, hidden), false);
  assert.equal(canViewPost(user({ 'post:view': 'self' }), hidden), true);
  assert.equal(canViewPost(user({ 'post:view': 'all' }), hidden), true);
  assert.equal(canViewPost(user({ 'post:view_deleted': 'all' }), hidden), false);
});

test('已删除文章只允许回收站查看数据范围覆盖的用户读取', () => {
  const deleted = post({ is_delete: 1 });
  assert.equal(canViewPost(null, deleted), false);
  assert.equal(canViewPost(user({ 'post:view': 'all' }), deleted), false);
  assert.equal(canViewPost(user({ 'post:view_deleted': 'self' }), deleted), true);
  assert.equal(canViewPost(user({ 'post:view_deleted': 'all' }), deleted), true);
});
