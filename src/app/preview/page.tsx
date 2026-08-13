import { notFound } from 'next/navigation';
import { DraftPreview } from './_components/DraftPreview';
import { parseContentDraftPreviewMode, verifyContentDraftPreviewSignature } from '@/lib/content-draft-preview';
import { getPublicContentDraftPreview } from '@/services/content-draft-preview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ draftId?: string; expiresAt?: string; signature?: string; mode?: string }> }) {
  const { draftId: draftIdValue, expiresAt: expiresAtValue, signature, mode: modeValue } = await searchParams;
  const mode = parseContentDraftPreviewMode(modeValue);
  const draftId = Number(draftIdValue);
  const expiresAt = Number(expiresAtValue);
  if (!mode || !verifyContentDraftPreviewSignature(draftId, expiresAt, signature)) notFound();
  const draft = await getPublicContentDraftPreview(draftId);
  if (!draft) notFound();
  return <DraftPreview draft={draft} mode={mode} />;
}
