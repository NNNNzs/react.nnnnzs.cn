#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnv();

const sid = process.env.SecretId || process.env.COS_SECRET_ID;
const skey = process.env.SecretKey || process.env.COS_SECRET_KEY;
const DOMAIN = "www.nnnnzs.cn";

if (!sid || !skey) {
  console.error("missing credentials");
  process.exit(1);
}

const sdk = await import("tencentcloud-sdk-nodejs");
const cdnClient = new sdk.cdn.v20180606.Client({
  credential: { secretId: sid, secretKey: skey },
  region: "",
  profile: { httpProfile: { endpoint: "cdn.tencentcloudapi.com" } },
});

function analyzeChanges(files) {
  const fullSiteTriggers = ["src/components/", "src/app/layout.tsx", "src/app/globals.css"];
  let fullSite = false;
  const paths = new Set();
  const urls = [];
  for (const f of files) {
    const t = f.trim();
    if (!t || t.startsWith("docs/") || t.endsWith(".md")) continue;
    if (fullSiteTriggers.some((g) => t.startsWith(g))) { fullSite = true; break; }
    if (t.startsWith("src/app/") && t.endsWith("/page.tsx")) {
      const parts = t.replace("src/app/", "").split("/");
      if (parts.length >= 2 && !["api", "c"].includes(parts[0])) paths.add("/" + parts[0] + "/");
    }
    if (t.startsWith("public/")) urls.push("https://" + DOMAIN + t.replace("public/", "/"));
  }
  if (fullSite) return { paths: ["/"], urls: [] };
  return { paths: [...paths].sort(), urls };
}

async function purgeUrls(urls) {
  const res = await cdnClient.PurgeUrlsCache({ Urls: urls });
  console.log("  URL purge -> " + res.RequestId);
}

async function purgePaths(paths) {
  const flushPaths = paths.map(p => {
    const url = "https://" + DOMAIN + (p.startsWith("/") ? p : "/" + p);
    return url.endsWith("/") ? url : url + "/";
  });
  const res = await cdnClient.PurgePathCache({ Paths: flushPaths, FlushType: "delete" });
  console.log("  Path purge -> " + res.RequestId);
}

const args = process.argv.slice(2);

if (args[0] === "--changed-file") {
  const f = args[1];
  if (!f) { console.error("missing file"); process.exit(1); }
  let files;
  try { files = readFileSync(f, "utf-8").split("\n").filter(Boolean); } catch { await purgePaths(["/"]); process.exit(0); }
  if (!files.length) { await purgePaths(["/"]); process.exit(0); }
  console.log("Analyzing " + files.length + " files...");
  const { paths, urls } = analyzeChanges(files);
  if (!paths.length && !urls.length) { console.log("skip"); process.exit(0); }
  console.log("paths=" + JSON.stringify(paths) + " urls=" + JSON.stringify(urls));
  if (paths.length) await purgePaths(paths);
  if (urls.length) await purgeUrls(urls);
  process.exit(0);
}

if (args[0] === "--url") {
  const urls = args.slice(1);
  if (!urls.length) { console.error("missing urls"); process.exit(1); }
  await purgeUrls(urls);
  process.exit(0);
}

if (!args.length) { await purgePaths(["/"]); }
else { await purgePaths(args); }
