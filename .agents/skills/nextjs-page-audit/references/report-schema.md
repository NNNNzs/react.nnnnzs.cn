# Next.js Page Audit Report Schema

The JSON report is a persisted diagnostic result, not an application API. Keep values sanitized and never include cookies, tokens, passwords, database URLs, or full environment variables.

## Top-level object

```json
{
  "schemaVersion": "1.0",
  "runId": "e2e-audit-20260815-120000",
  "startedAt": "2026-08-15T04:00:00.000Z",
  "finishedAt": "2026-08-15T04:05:00.000Z",
  "baseUrl": "http://localhost:3000",
  "port": "3000",
  "authState": "authenticated|anonymous|unknown",
  "testDatabaseConfirmed": false,
  "dataPrefix": "e2e-audit-20260815-120000",
  "summary": {
    "pass": 0,
    "fail": 0,
    "warn": 0,
    "blocked": 0,
    "skipped": 0
  },
  "routes": [],
  "findings": [],
  "actions": [],
  "environment": {}
}
```

## Route result

Each `routes` entry records one UI route or one resolved dynamic URL:

```json
{
  "template": "/collections/[slug]",
  "url": "/collections/example",
  "status": "PASS|FAIL|WARN|BLOCKED|SKIPPED",
  "finalUrl": "/collections/example",
  "title": "Example",
  "rendered": true,
  "actionsChecked": 3,
  "newFindingIds": ["finding-001"],
  "blockedReason": null
}
```

## Finding

Each `findings` entry must preserve enough evidence to reproduce the issue:

```json
{
  "id": "finding-001",
  "severity": "FAIL|WARN|BLOCKED|SKIPPED",
  "kind": "build|runtime|hydration|console|deprecation|network|navigation|auth|capability",
  "message": "Original sanitized error or warning",
  "url": "http://localhost:3000/example",
  "action": "Opened /example and selected the details tab",
  "source": {
    "file": "src/components/Example.tsx",
    "line": 42,
    "column": 7,
    "method": "Example"
  },
  "baseline": false,
  "new": true,
  "occurrences": 1
}
```

## Action result

Record navigation and business actions separately. For writes, record only sanitized identifiers and never request or response credentials:

```json
{
  "route": "/create/drafts",
  "label": "Open draft editor",
  "kind": "navigation|click|form|write|skip",
  "status": "PASS|FAIL|BLOCKED|SKIPPED",
  "target": "/create/drafts/123",
  "createdIds": [],
  "reason": null
}
```
