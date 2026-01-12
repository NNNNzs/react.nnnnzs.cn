/**
 * 数据迁移脚本：为现有文章创建初始版本记录
 * 
 * 使用方法：
 * tsx scripts/migrate-existing-posts.ts
 */

import { getPrisma } from '../src/lib/prisma';
import { createPostVersion } from '../src/services/post-version';
import { incrementalEmbedPost } from '../src/services/embedding';

async function migrateExistingPosts() {
  console.log('🚀 开始迁移现有文章...');

  const prisma = await getPrisma();

  try {
    // 获取所有未删除的文章
    const posts = await prisma.tbPost.findMany({
      where: {
        is_delete: 0,
      },
      select: {
        id: true,
        title: true,
        content: true,
        hide: true,
        created_by: true,
      },
    });

    console.log(`📊 找到 ${posts.length} 篇文章`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      try {
        // 检查是否已有版本记录
        const existingVersion = await prisma.tbPostVersion.findFirst({
          where: {
            post_id: post.id,
          },
        });

        if (existingVersion) {
          console.log(`⏭️  文章 ${post.id} 已有版本记录，跳过`);
          skippedCount++;
          continue;
        }

        if (!post.content) {
          console.log(`⚠️  文章 ${post.id} 内容为空，跳过`);
          skippedCount++;
          continue;
        }

        // 创建初始版本
        const version = await createPostVersion(
          post.id,
          post.content,
          post.created_by || undefined
        );

        console.log(`✅ 文章 ${post.id} 创建初始版本成功，版本号: ${version.version}`);

        // 执行增量向量化（创建chunk记录）
        console.log(`🔢 为文章 ${post.id} 执行增量向量化...`);
        try {
          const embedResult = await incrementalEmbedPost({
            postId: post.id,
            title: post.title || '无标题',
            content: post.content,
            version: version.version,
            hide: post.hide || '0',
          });
          console.log(
            `✅ 文章 ${post.id} 增量向量化完成：插入 ${embedResult.insertedCount} 个向量，创建 ${embedResult.chunkCount} 个chunks`
          );
        } catch (embedError) {
          console.error(`❌ 文章 ${post.id} 增量向量化失败:`, embedError);
          // 向量化失败不影响版本记录的创建，但记录错误
          errorCount++;
          continue;
        }

        successCount++;
      } catch (error) {
        console.error(`❌ 文章 ${post.id} 迁移失败:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 迁移完成统计：');
    console.log(`  ✅ 成功: ${successCount}`);
    console.log(`  ⏭️  跳过: ${skippedCount}`);
    console.log(`  ❌ 失败: ${errorCount}`);
    console.log(`  📝 总计: ${posts.length}`);
  } catch (error) {
    console.error('❌ 迁移过程出错:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
migrateExistingPosts().catch((error) => {
  console.error('❌ 迁移脚本执行失败:', error);
  process.exit(1);
});
