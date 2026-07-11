#!/usr/bin/env bash
# Apple 芯片 Mac -> x86 Linux 服务器的分阶段应急部署脚本。
set -Eeuo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

NO_CACHE=false
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

IMAGE_NAME="${IMAGE_NAME:-nnnnzs/react-nnnnzs-cn}"
TAG="${IMAGE_TAG:-latest}"
REMOTE_HOST="${DEPLOY_HOST:-}"; REMOTE_USER="${DEPLOY_USER:-}"; REMOTE_PORT="${DEPLOY_PORT:-22}"
REMOTE_DIR="${DEPLOY_DIR:-}"; REMOTE_TAR_DIR="${DEPLOY_TAR_DIR:-/tmp}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ARTIFACT_DIR="${DEPLOY_ARTIFACT_DIR:-.deploy}"
WEBHOOK_URL="${DEPLOY_WEBHOOK_URL:-https://www.nnnnzs.cn/api/deploy/webhook}"
WEBHOOK_SECRET="${DEPLOY_WEBHOOK_SECRET:-${WEBHOOK_SECRET:-}}"
RUN_ID="local-$(date +%s)"; COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
FULL_IMAGE="${IMAGE_NAME}:${TAG}"
TAR_NAME="react-nnnnzs-cn-${TAG}.tar"
LOCAL_TAR="${ARTIFACT_DIR}/${TAR_NAME}"
DEPLOY_JSON="${ARTIFACT_DIR}/deployment-${TAG}.json"
REMOTE_TAR="${REMOTE_TAR_DIR%/}/${TAR_NAME}"
SSH=(env LC_ALL=C LANG=C ssh -p "$REMOTE_PORT" "${REMOTE_USER}@${REMOTE_HOST}")
SCP=(env LC_ALL=C LANG=C scp -P "$REMOTE_PORT")

usage() {
  cat <<EOF
用法: $0 <命令> [--no-cache]

命令:
  all                 完整部署：构建、导出、上传、服务器加载并重启
  build               仅构建 linux/amd64 镜像
  export              将已构建镜像导出到 ${LOCAL_TAR}
  upload              将已有 tar 通过 scp 上传至服务器
  deploy              服务器 docker load、强制重建、image prune、删除远端 tar
  notify <状态>       发送 deploying、success 或 failure Webhook
  clean               删除本地构建 tar/部署 JSON，并尝试删除远端 tar

默认配置来自项目根目录 .env：DEPLOY_HOST、DEPLOY_USER、DEPLOY_PORT、DEPLOY_DIR。
打包产物默认保存在 .deploy/，可在上传或部署失败后直接重试后续阶段。
EOF
}

COMMAND="${1:-all}"
[[ $# -gt 0 ]] && shift
NOTIFY_STATUS=""
if [[ "$COMMAND" == "notify" && $# -gt 0 ]]; then
  NOTIFY_STATUS="$1"
  shift
fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-cache) NO_CACHE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) error "未知参数: $1"; usage; exit 1 ;;
  esac
done

require_command() { command -v "$1" >/dev/null || { error "未找到命令: $1"; exit 1; }; }
require_remote_config() {
  [[ -n "$REMOTE_HOST" && -n "$REMOTE_USER" && -n "$REMOTE_DIR" ]] || {
    error "请在 .env 中配置 DEPLOY_HOST、DEPLOY_USER、DEPLOY_DIR"; exit 1;
  }
}
require_tar() { [[ -f "$LOCAL_TAR" ]] || { error "未找到镜像 tar: ${LOCAL_TAR}；请先执行 export"; exit 1; }; }
write_deploy_json() {
  local status="$1"
  mkdir -p "$ARTIFACT_DIR"
  node -e 'const fs=require("fs"); const [file,status,image,tag,commit,runId]=process.argv.slice(1); fs.writeFileSync(file, JSON.stringify({status,image,version:tag,commit,runId,platform:"linux/amd64",updatedAt:new Date().toISOString()}, null, 2)+"\n")' "$DEPLOY_JSON" "$status" "$FULL_IMAGE" "$TAG" "$COMMIT_SHA" "$RUN_ID"
}
notify_webhook() {
  local status="$1"
  require_command node
  write_deploy_json "$status"
  if [[ -z "$WEBHOOK_SECRET" ]]; then
    warn "未配置 DEPLOY_WEBHOOK_SECRET，已生成部署 JSON，跳过 Webhook"
    return 0
  fi
  require_command curl
  local payload
  payload="$(node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(JSON.stringify({status:p.status,run_id:p.runId,commit:p.commit,version:p.version}))' "$DEPLOY_JSON")"
  curl -k -sS -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -H "Authorization: Bearer ${WEBHOOK_SECRET}" --data-binary "$payload" >/dev/null || warn "部署 Webhook 发送失败，不影响部署"
}
build_image() {
  require_command docker
  docker info >/dev/null 2>&1 || { error "Docker Desktop 未运行或当前用户无权限"; exit 1; }
  [[ -f Dockerfile.prod ]] || { error "找不到 Dockerfile.prod"; exit 1; }
  info "构建 ${FULL_IMAGE}，目标平台 linux/amd64"
  local build_date
  build_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local -a build_cmd=(docker buildx build --platform linux/amd64 --load -f Dockerfile.prod -t "$FULL_IMAGE")
  [[ "$NO_CACHE" == true ]] && build_cmd+=(--no-cache)
  build_cmd+=(--build-arg "VERSION=$TAG" --build-arg "BUILD_DATE=$build_date" --build-arg "COMMIT_SHA=$COMMIT_SHA")
  local build_arg
  for build_arg in DATABASE_URL REDIS_HOST REDIS_PORT REDIS_DB; do
    [[ -n "${!build_arg:-}" ]] && build_cmd+=(--build-arg "${build_arg}=${!build_arg}")
  done
  build_cmd+=(.)
  "${build_cmd[@]}"
}
export_image() {
  require_command docker
  docker image inspect "$FULL_IMAGE" >/dev/null || { error "本机不存在镜像 ${FULL_IMAGE}；请先执行 build"; exit 1; }
  mkdir -p "$ARTIFACT_DIR"
  info "导出 ${FULL_IMAGE} 到 ${LOCAL_TAR}"
  docker save -o "$LOCAL_TAR" "$FULL_IMAGE"
  info "镜像 tar 已就绪：$(du -h "$LOCAL_TAR" | awk '{print $1}')"
}
upload_image() {
  require_command ssh; require_command scp; require_tar; require_remote_config
  info "准备服务器临时目录：${REMOTE_TAR_DIR}"
  "${SSH[@]}" "mkdir -p -- $(printf '%q' "$REMOTE_TAR_DIR")"
  info "scp 上传 ${LOCAL_TAR} -> ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_TAR}"
  "${SCP[@]}" "$LOCAL_TAR" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_TAR}"
}
deploy_remote() {
  require_command ssh; require_remote_config
  local remote_tar_q remote_dir_q compose_q
  remote_tar_q=$(printf '%q' "$REMOTE_TAR"); remote_dir_q=$(printf '%q' "$REMOTE_DIR"); compose_q=$(printf '%q' "$COMPOSE_FILE")
  info "服务器加载镜像、强制重建服务、清理未使用镜像"
  "${SSH[@]}" "set -e; docker load -i ${remote_tar_q}; cd ${remote_dir_q}; if docker compose version >/dev/null 2>&1; then docker compose -f ${compose_q} down; docker compose -f ${compose_q} up -d --force-recreate; elif command -v docker-compose >/dev/null 2>&1; then docker-compose -f ${compose_q} down; docker-compose -f ${compose_q} up -d --force-recreate; else echo '未找到 Docker Compose' >&2; exit 1; fi; docker image prune -f; rm -f -- ${remote_tar_q}"
}
clean_artifacts() {
  info "删除本地构建产物"
  rm -f "$LOCAL_TAR" "$DEPLOY_JSON"
  rmdir "$ARTIFACT_DIR" 2>/dev/null || true
  if [[ -n "$REMOTE_HOST" && -n "$REMOTE_USER" ]]; then
    info "尝试删除服务器临时 tar"
    "${SSH[@]}" "rm -f -- $(printf '%q' "$REMOTE_TAR")" || true
  fi
}
on_all_error() { local code=$?; notify_webhook failure; exit "$code"; }

case "$COMMAND" in
  all)
    trap on_all_error ERR
    notify_webhook deploying
    build_image
    export_image
    upload_image
    deploy_remote
    notify_webhook success
    info "应急部署完成：${FULL_IMAGE}"
    info "本地 tar 已保留，可用于后续 upload/deploy 重试：${LOCAL_TAR}"
    ;;
  build) build_image ;;
  export) export_image ;;
  upload) upload_image ;;
  deploy) deploy_remote ;;
  notify)
    [[ "$NOTIFY_STATUS" =~ ^(deploying|success|failure)$ ]] || { error "notify 需要状态：deploying、success 或 failure"; exit 1; }
    notify_webhook "$NOTIFY_STATUS"
    ;;
  clean) clean_artifacts ;;
  help|-h|--help) usage ;;
  *) error "未知命令: $COMMAND"; usage; exit 1 ;;
esac
