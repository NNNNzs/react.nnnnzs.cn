import CreatePlaceholderPage from "../_components/CreatePlaceholderPage";

export default function CreateReviewPage() {
  return (
    <CreatePlaceholderPage
      title="复盘数据"
      description="这里会录入和查看发布后的收藏、点赞、评论、私信和博客回流数据，用于指导下一轮选题。"
      focus={[
        "录入平台表现数据",
        "记录评论和私信里的真实问题",
        "观察博客回流和内容转化",
        "沉淀下一轮选题建议",
      ]}
    />
  );
}
