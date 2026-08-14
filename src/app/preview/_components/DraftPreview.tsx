import type { ContentDraftPreviewMode, PublicDraftPreviewDto } from '@/types/content-draft-preview';
import MarkdownPreview from '@/components/MarkdownPreview';

function Tags({ tags }: { tags: string[] }) {
  return tags.length ? <div className="mt-5 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">#{tag}</span>)}</div> : null;
}

function DraftImages({ draft }: { draft: PublicDraftPreviewDto }) {
  return draft.images.length ? (
    <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
      {draft.images.map((image) => <img key={`${image.sortOrder}-${image.url}`} src={image.url} alt={image.alt} referrerPolicy="no-referrer" className="aspect-[3/4] w-[78%] shrink-0 snap-center rounded-xl object-cover sm:w-72" />)}
    </div>
  ) : null;
}

function XhsPreview({ draft }: { draft: PublicDraftPreviewDto }) {
  return <main className="mx-auto min-h-screen max-w-md bg-[#fffaf7] px-4 py-8 text-slate-800"><article className="rounded-2xl bg-white p-4 shadow-sm"><DraftImages draft={draft} /><h1 className="mt-5 text-xl font-bold leading-8">{draft.title}</h1>{draft.hook ? <p className="mt-3 text-base leading-7 text-slate-600">{draft.hook}</p> : null}<DraftBody draft={draft} className="mt-4 text-[15px] leading-7" /><Tags tags={draft.tags} /></article></main>;
}

function ZhihuPreview({ draft }: { draft: PublicDraftPreviewDto }) {
  const headings = draft.isMarkdown ? Array.from(draft.body.matchAll(/^(#{1,3})\s+(.+)$/gm)).map((match) => match[2].trim()) : [];
  return <main className="mx-auto grid min-h-screen max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_220px]"><article className="min-w-0"><p className="text-sm text-slate-500">{draft.author.name} · 更新于 {draft.updatedAt.toLocaleDateString('zh-CN')}</p><h1 className="mt-3 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">{draft.title}</h1>{draft.hook ? <p className="mt-5 border-l-4 border-blue-500 pl-4 text-lg leading-8 text-slate-600">{draft.hook}</p> : null}<DraftBody draft={draft} className="mt-9" /><Tags tags={draft.tags} /></article>{headings.length ? <aside className="hidden border-l border-slate-200 pl-5 text-sm text-slate-500 lg:block"><p className="font-medium text-slate-700">目录</p><ol className="mt-3 space-y-2">{headings.map((heading, index) => <li key={`${heading}-${index}`}>{heading}</li>)}</ol></aside> : null}</main>;
}

function ToutiaoPreview({ draft }: { draft: PublicDraftPreviewDto }) {
  const cover = draft.images[0];
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-10"><article><p className="text-sm text-slate-500">{draft.author.name} · {draft.updatedAt.toLocaleDateString('zh-CN')}</p><h1 className="mt-3 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">{draft.title}</h1><p className="mt-5 text-lg leading-8 text-slate-600">{draft.summary}</p>{cover ? <img src={cover.url} alt={cover.alt} referrerPolicy="no-referrer" className="mt-7 aspect-video w-full rounded-xl object-cover" /> : null}<DraftBody draft={draft} className="mt-8 text-[17px] leading-8 text-slate-800" /><Tags tags={draft.tags} /></article></main>;
}

function DraftBody({ draft, className }: { draft: PublicDraftPreviewDto; className: string }) {
  return draft.isMarkdown
    ? <div className={className}><MarkdownPreview content={draft.body} previewTheme="cyanosis" /></div>
    : <div className={`${className} whitespace-pre-wrap`}>{draft.body}</div>;
}

export function DraftPreview({ draft, mode }: { draft: PublicDraftPreviewDto; mode: ContentDraftPreviewMode }) {
  if (mode === 'zhihu') return <ZhihuPreview draft={draft} />;
  if (mode === 'toutiao') return <ToutiaoPreview draft={draft} />;
  return <XhsPreview draft={draft} />;
}
