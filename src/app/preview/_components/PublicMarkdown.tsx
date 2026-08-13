import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getSafePublicMarkdownUrl } from '@/lib/content-draft-preview';

export function PublicMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={(url, key) => getSafePublicMarkdownUrl(url, key === 'src' ? 'image' : 'link')}
      components={{
        a: ({ href, children }) => <a href={href || undefined} target="_blank" rel="noreferrer noopener">{children}</a>,
        img: ({ src, alt }) => src ? <img src={src} alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" /> : null,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
