import PlannedPage from "../_components/PlannedPage";

export default function AiLabPromptsPage() {
  return (
    <PlannedPage
      title="Prompts"
      phase="阶段 4"
      summary="Prompt 实验入口已预留，后续会保存系统提示词版本快照、diff、replay 结果和回滚证据。"
      nextSteps={[
        "为当前聊天 Agent 系统提示词创建首个版本快照。",
        "在 Run 记录中保存 promptVersion。",
        "支持选择 Prompt 版本参与 Eval Replay。",
      ]}
    />
  );
}
