# LangGraph Agent 本地调试

## 概述

`chat-agent`、`create-agent` 和 `topic-agent` 都通过 `createLangGraphDebugger` 包装 LangGraph 的 `streamEvents()`。开启后，原始 LangGraph 事件和业务 patch 会按 NDJSON 格式写入本地文件，现有 SSE 响应不受影响。

## 开启方式

在 `.env.local` 中设置：

```bash
LANGGRAPH_DEBUG=true
```

日志文件默认位于 `logs/langgraph/YYYY-MM-DD.ndjson`，该目录已被 Git 忽略。此功能仅在 `NODE_ENV=development` 下启用，生产环境不会写入本地日志。

默认会脱敏所有字符串，只保留字段结构、数值和原始字符串长度。需要检查 system prompt、用户消息、工具参数或工具结果时，临时增加：

```bash
LANGGRAPH_DEBUG_CONTENT=true
```

调试结束后应删除该变量并清理日志，避免本地长期留存草稿与用户输入。

可选的 `LANGGRAPH_DEBUG_DIR` 可指定日志目录；相对路径按项目根目录解析。

## 日志结构

每行都是独立 JSON，使用 `localRunId` 关联同一次 Agent 调用。常见 `kind` 包括：

- `run_start`：本次运行的 Agent 名称和安全元数据。
- `langgraph_event`：LangGraph `streamEvents()` 的原始事件，包含 `event`、`name`、`langGraphRunId` 和 `data`。
- `draft_patch` / `topic_patch`：创作或选题 Agent 发出的业务 patch。
- `run_end`：完成或失败状态；失败时含脱敏错误信息。

## 常用排查

```bash
# 实时查看今天的事件流
tail -f logs/langgraph/"$(date +%F)".ndjson

# 仅查看某次请求；localRunId 会在开发服务器终端的 [langgraph-debug] 行中输出
jq 'select(.localRunId == "你的运行ID")' logs/langgraph/"$(date +%F)".ndjson

# 查看工具调用事件
jq 'select(.kind == "langgraph_event" and (.data.event == "on_tool_start" or .data.event == "on_tool_end"))' logs/langgraph/"$(date +%F)".ndjson
```

如果没有生成日志，请确认开发服务器已读取新的 `.env.local` 配置并重启；不会由本项目自动启动或重启服务。
