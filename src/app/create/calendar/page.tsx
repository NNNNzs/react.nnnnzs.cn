import CreatePlaceholderPage from "../_components/CreatePlaceholderPage";

export default function CreateCalendarPage() {
  return (
    <CreatePlaceholderPage
      title="发布日历"
      description="这里会管理各平台的发布计划和手动发布状态，第一阶段只做清单和记录，不做自动发布。"
      focus={[
        "按周查看待发布内容",
        "维护小红书、抖音等平台状态",
        "生成发布 checklist",
        "记录发布链接和实际发布时间",
      ]}
    />
  );
}
