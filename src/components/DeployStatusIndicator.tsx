'use client';

import { useEffect, useMemo, useState } from 'react';

import { useDeployStatus } from '@/hooks/useDeployStatus';

const STATUS_LABEL = {
  deploying: 'DEPLOYING',
  success: 'DEPLOYED',
  failure: 'FAILED',
} as const;

const STATUS_STYLE = {
  deploying: {
    wrapper: 'border-fuchsia-400/70 text-fuchsia-100 shadow-[0_0_24px_rgba(217,70,239,0.45)]',
    dot: 'bg-fuchsia-300 shadow-[0_0_16px_rgba(217,70,239,0.95)]',
    text: 'text-fuchsia-100',
  },
  success: {
    wrapper: 'border-emerald-300/75 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.42)]',
    dot: 'bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.9)]',
    text: 'text-emerald-100',
  },
  failure: {
    wrapper: 'border-red-400/75 text-red-100 shadow-[0_0_24px_rgba(248,113,113,0.42)]',
    dot: 'bg-red-300 shadow-[0_0_16px_rgba(248,113,113,0.9)]',
    text: 'text-red-100',
  },
} as const;

/**
 * 全局部署状态浮动指示器
 */
export default function DeployStatusIndicator() {
  const deployStatus = useDeployStatus();
  const [hiddenSuccessUpdatedAt, setHiddenSuccessUpdatedAt] = useState('');

  const shouldRender = useMemo(() => {
    if (!deployStatus.status) {
      return false;
    }

    return !(
      deployStatus.status === 'success' &&
      deployStatus.updatedAt &&
      hiddenSuccessUpdatedAt === deployStatus.updatedAt
    );
  }, [deployStatus.status, deployStatus.updatedAt, hiddenSuccessUpdatedAt]);

  useEffect(() => {
    if (deployStatus.status !== 'success' || !deployStatus.updatedAt) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setHiddenSuccessUpdatedAt(deployStatus.updatedAt);
    }, 3000);

    return () => window.clearTimeout(timerId);
  }, [deployStatus.status, deployStatus.updatedAt]);

  if (!shouldRender || !deployStatus.status) {
    return null;
  }

  const style = STATUS_STYLE[deployStatus.status];

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 overflow-hidden rounded-full border bg-slate-950/82 px-4 py-3 font-mono backdrop-blur-md ${style.wrapper} ${
        deployStatus.status === 'deploying' ? 'animate-[deployPulse_1.8s_ease-in-out_infinite]' : ''
      }`}
      title={`${STATUS_LABEL[deployStatus.status]} ${deployStatus.version || deployStatus.commit}`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.12),transparent)] animate-[deploySweep_2.4s_linear_infinite]" />
      <span className={`relative h-2 w-2 rounded-full ${style.dot}`} />
      <svg
        aria-hidden="true"
        className="relative h-5 w-5 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 3v3m0 12v3m6.36-15.36-2.12 2.12M7.76 16.24l-2.12 2.12M21 12h-3M6 12H3m15.36 6.36-2.12-2.12M7.76 7.76 5.64 5.64"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span className={`relative overflow-hidden text-xs font-bold tracking-[0.24em] ${style.text}`}>
        {STATUS_LABEL[deployStatus.status]}
        {deployStatus.status === 'deploying' && (
          <span className="absolute inset-x-0 top-0 h-px bg-cyan-200/80 animate-[deployScan_1.1s_linear_infinite]" />
        )}
      </span>
      {(deployStatus.version || deployStatus.commit) && (
        <span className="relative max-w-24 truncate text-[10px] tracking-[0.12em] text-cyan-100/68">
          {deployStatus.version || deployStatus.commit}
        </span>
      )}
    </div>
  );
}
