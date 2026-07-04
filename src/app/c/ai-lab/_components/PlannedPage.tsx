import Link from "next/link";

type PlannedPageProps = {
  title: string;
  summary: string;
  phase: string;
  nextSteps: string[];
};

export default function PlannedPage({
  title,
  summary,
  phase,
  nextSteps,
}: PlannedPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-medium text-cyan-700">{phase}</div>
        <h2 className="mt-2 mb-2 text-2xl font-semibold tracking-normal text-slate-950">
          {title}
        </h2>
        <p className="mb-0 text-sm leading-6 text-slate-600">{summary}</p>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="m-0 text-base font-semibold text-slate-950">下一步执行项</h3>
        <div className="mt-4 grid gap-3">
          {nextSteps.map((step, index) => (
            <div
              key={step}
              className="flex gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-700 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className="text-sm leading-6 text-slate-700">{step}</span>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/c/ai-lab"
        className="inline-flex w-fit rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800"
      >
        返回 AI Lab 总览
      </Link>
    </div>
  );
}
