#!/usr/bin/env python3
"""
腾讯云 CDN 缓存刷新脚本
在部署后调用，刷新 CDN 缓存

用法:
  python3 scripts/purge_cdn.py                  # 刷新全站
  python3 scripts/purge_cdn.py /chat /article   # 刷新指定目录
  python3 scripts/purge_cdn.py --url https://www.nnnnzs.cn/chat   # 刷新指定URL

环境变量（从 .env 自动读取）:
  SecretId / COS_SECRET_ID    腾讯云 API 密钥 ID
  SecretKey / COS_SECRET_KEY  腾讯云 API 密钥
"""

import hashlib
import hmac
import json
import os
import sys
import time
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError

try:
    from typing import Tuple
except ImportError:
    pass

# ── 配置 ──────────────────────────────────────────────
CDN_ENDPOINT = "cdn.tencentcloudapi.com"
CDN_HOST = "cdn.tencentcloudapi.com"
DEFAULT_DOMAIN = "www.nnnnzs.cn"


def load_env(env_path: str = ".env") -> dict:
    """读取 .env 文件，返回环境变量字典"""
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    # 去掉引号
                    value = value.strip().strip("'\"")
                    env[key.strip()] = value
    return env


def get_credentials():
    """获取腾讯云凭据，优先从环境变量读取，其次从 .env 文件读取"""
    # 先从 os.environ 找
    secret_id = os.environ.get("SecretId") or os.environ.get("COS_SECRET_ID")
    secret_key = os.environ.get("SecretKey") or os.environ.get("COS_SECRET_KEY")

    # 如果没有，从 .env 文件读取
    if not secret_id or not secret_key:
        env = load_env()
        secret_id = secret_id or env.get("SecretId") or env.get("COS_SECRET_ID")
        secret_key = secret_key or env.get("SecretKey") or env.get("COS_SECRET_KEY")

    if not secret_id or not secret_key:
        print("❌ 未找到腾讯云凭据，请设置 SecretId/SecretKey 环境变量或在 .env 中配置")
        sys.exit(1)

    return secret_id, secret_key


def sign_tc3(
    secret_id: str,
    secret_key: str,
    service: str,
    action: str,
    payload: str,
    timestamp: int,
) -> dict:
    """TC3-HMAC-SHA256 签名"""
    date = datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d")

    # Step 1: 拼接规范请求串
    http_request_method = "POST"
    canonical_uri = "/"
    canonical_querystring = ""
    content_type = "application/json; charset=utf-8"
    canonical_headers = f"content-type:{content_type}\nhost:{CDN_HOST}\nx-tc-action:{action.lower()}\n"
    signed_headers = "content-type;host;x-tc-action"
    hashed_payload = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    canonical_request = (
        f"{http_request_method}\n{canonical_uri}\n{canonical_querystring}\n"
        f"{canonical_headers}\n{signed_headers}\n{hashed_payload}"
    )

    # Step 2: 拼接待签名字符串
    algorithm = "TC3-HMAC-SHA256"
    credential_scope = f"{date}/{service}/tc3_request"
    hashed_request = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_request}"

    # Step 3: 计算签名
    def _hmac_sha256(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = _hmac_sha256(("TC3" + secret_key).encode("utf-8"), date)
    secret_service = _hmac_sha256(secret_date, service)
    secret_signing = _hmac_sha256(secret_service, "tc3_request")
    signature = hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    # Step 4: 拼接 Authorization
    authorization = (
        f"{algorithm} "
        f"Credential={secret_id}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )

    return {
        "Content-Type": content_type,
        "Host": CDN_HOST,
        "X-TC-Action": action,
        "X-TC-Timestamp": str(timestamp),
        "X-TC-Version": "2018-06-06",
        "Authorization": authorization,
    }


def purge_urls(urls):
    """调用 PurgeUrlsCache 刷新指定 URL"""
    secret_id, secret_key = get_credentials()
    timestamp = int(time.time())

    payload = json.dumps({"Urls": urls, "FlushType": "delete"})
    headers = sign_tc3(secret_id, secret_key, "cdn", "PurgeUrlsCache", payload, timestamp)

    req = Request(
        f"https://{CDN_ENDPOINT}",
        data=payload.encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"❌ CDN API 请求失败 (HTTP {e.code}): {body}")
        sys.exit(1)


def purge_path(path: str) -> dict:
    """调用 PurgePathCache 刷新指定目录"""
    secret_id, secret_key = get_credentials()
    timestamp = int(time.time())

    url = f"https://{DEFAULT_DOMAIN}{path}" if path.startswith("/") else f"https://{DEFAULT_DOMAIN}/{path}"
    # 确保以 / 结尾（目录刷新）
    if not url.endswith("/"):
        url += "/"

    payload = json.dumps({"FlushPath": url, "FlushType": "delete"})
    headers = sign_tc3(secret_id, secret_key, "cdn", "PurgePathCache", payload, timestamp)

    req = Request(
        f"https://{CDN_ENDPOINT}",
        data=payload.encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"❌ CDN API 请求失败 (HTTP {e.code}): {body}")
        sys.exit(1)


def analyze_changes(changed_files):
    """
    分析变更文件列表，返回需要刷新的 CDN 路径
    规则：
      - src/components/**, src/app/layout.tsx, src/app/globals.css → 全站 /
      - src/app/<page>/page.tsx → 刷新 /<page>/
      - src/app/api/** → 刷新 /api/ 前缀（不影响 CDN 页面缓存，跳过）
      - public/** → 精确 URL 刷新
      - docs/**, *.md → 跳过（不影响线上）
    """
    full_site = False
    paths_to_purge = set()
    urls_to_purge = []

    # 全站刷新的触发路径
    full_site_triggers = [
        "src/components/",
        "src/app/layout.tsx",
        "src/app/globals.css",
    ]

    for f in changed_files:
        f = f.strip()
        if not f:
            continue

        # docs / md 文件跳过
        if f.startswith("docs/") or f.endswith(".md"):
            continue

        # 全站触发
        if any(f.startswith(trigger) for trigger in full_site_triggers):
            full_site = True
            break

        # 页面级：src/app/<name>/page.tsx → /<name>/
        if f.startswith("src/app/") and f.endswith("/page.tsx"):
            parts = f.replace("src/app/", "").split("/")
            if len(parts) >= 2:  # e.g. chat/page.tsx
                page_dir = parts[0]
                # 排除 api 和特殊目录
                if page_dir not in ("api", "c"):
                    paths_to_purge.add(f"/{page_dir}/")

        # 静态资源：public/** → 精确 URL
        if f.startswith("public/"):
            asset_path = f.replace("public/", "/")
            urls_to_purge.append(f"https://{DEFAULT_DOMAIN}{asset_path}")

    if full_site:
        return ["/"]

    # 合并：目录刷新 + URL 刷新
    result = []
    if paths_to_purge:
        result.extend(sorted(paths_to_purge))
    if urls_to_purge:
        # URL 刷新走 purge_urls，这里用特殊标记传递
        result.append(f"__urls__:{','.join(urls_to_purge)}")
    return result if result else []


def main():
    args = sys.argv[1:]

    # --changed-file 模式：从文件读取变更列表
    if args and args[0] == "--changed-file":
        if len(args) < 2:
            print("❌ --changed-file 后需要指定文件路径")
            sys.exit(1)
        changed_file = args[1]
        try:
            with open(changed_file) as f:
                changed_files = [line.strip() for line in f if line.strip()]
        except FileNotFoundError:
            print(f"⚠️  变更文件不存在: {changed_file}，全站刷新")
            changed_files = []

        if not changed_files:
            print("🌐 无变更信息，全站刷新...")
            result = purge_path("/")
            request_id = result.get("Response", {}).get("RequestId", "unknown")
            print(f"✅ CDN 全站缓存刷新已提交 (RequestId: {request_id})")
            return

        print(f"📋 分析 {len(changed_files)} 个变更文件...")
        targets = analyze_changes(changed_files)

        if not targets:
            print("⏭️  变更不影响 CDN 缓存（仅 docs/md），跳过刷新")
            return

        print(f"🎯 需要刷新: {targets}")
        for target in targets:
            if target.startswith("__urls__:"):
                urls = target.replace("__urls__:", "").split(",")
                print(f"🌐 刷新 URL: {urls}")
                result = purge_urls(urls)
            else:
                result = purge_path(target)
            request_id = result.get("Response", {}).get("RequestId", "unknown")
            print(f"  ✅ {target} → {request_id}")
        return

    # 无参数：刷新全站
    if not args:
        print("🌐 刷新 CDN 全站缓存...")
        result = purge_path("/")
        request_id = result.get("Response", {}).get("RequestId", "unknown")
        print(f"✅ CDN 全站缓存刷新已提交 (RequestId: {request_id})")
        return

    # --url 模式：精确刷新指定 URL
    if args[0] == "--url":
        urls = args[1:]
        if not urls:
            print("❌ --url 后需要指定 URL")
            sys.exit(1)
        print(f"🌐 刷新指定 URL: {urls}")
        result = purge_urls(urls)
        request_id = result.get("Response", {}).get("RequestId", "unknown")
        print(f"✅ CDN URL 缓存刷新已提交 (RequestId: {request_id})")
        return

    # 默认模式：按目录刷新
    print(f"🌐 刷新 CDN 目录缓存: {args}")
    for path in args:
        result = purge_path(path)
        request_id = result.get("Response", {}).get("RequestId", "unknown")
        print(f"  ✅ {path} → {request_id}")


if __name__ == "__main__":
    main()
