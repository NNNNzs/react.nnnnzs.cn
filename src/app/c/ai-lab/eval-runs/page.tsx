import PlannedPage from "../_components/PlannedPage";

export default function AiLabEvalRunsPage() {
  return (
    <PlannedPage
      title="Eval Runs"
      phase="阶段 2-3"
      summary="评测运行入口已预留，后续用于批量重放 Golden Dataset，并展示 Hit@K、Recall、MRR、latency 与版本对比。"
      nextSteps={[
        "新增 ai_eval_run 和 ai_eval_result 数据结构。",
        "实现 dense 检索基础指标计算和运行快照保存。",
        "把模型、Prompt、retrieverVersion 和 topK 固化到每次评测记录。",
      ]}
    />
  );
}
