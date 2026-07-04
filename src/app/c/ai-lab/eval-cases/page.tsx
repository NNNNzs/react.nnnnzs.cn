import PlannedPage from "../_components/PlannedPage";

export default function AiLabEvalCasesPage() {
  return (
    <PlannedPage
      title="Eval Cases"
      phase="阶段 2"
      summary="Golden Dataset 的管理入口已预留，后续会承接从 Run 导入失败样本、手工维护期望文章和关键词、批量发起评测运行。"
      nextSteps={[
        "新增 ai_eval_case 数据结构和后台 CRUD API。",
        "从 /c/ai-lab/runs 选择失败对话并转为评测用例。",
        "先维护 30 条覆盖博客核心主题的 Golden Case。",
      ]}
    />
  );
}
