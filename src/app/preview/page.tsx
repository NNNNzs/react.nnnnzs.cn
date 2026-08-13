import { notFound } from 'next/navigation';
import { DraftPreview } from './_components/DraftPreview';
import { parseContentDraftPreviewMode } from '@/lib/content-draft-preview';
import { getPublicContentDraftPreview } from '@/services/content-draft-preview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ share?: string; mode?: string }> }) {
  const { share, mode: modeValue } = await searchParams;
  const mode = parseContentDraftPreviewMode(modeValue);
  if (!share || !mode || share.length > 128) notFound();
  const draft = await getPublicContentDraftPreview(share);
  if (!draft) notFound();
  return <DraftPreview draft={draft} mode={mode} />;
}
