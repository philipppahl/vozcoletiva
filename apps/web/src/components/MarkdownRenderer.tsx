import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ source }: { source: string }) {
  return (
    <div className="prose-voz max-w-none text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--brand)', textDecoration: 'underline' }}
              {...rest}
            >
              {children}
            </a>
          ),
          p: ({ children }) => <p className="my-3">{children}</p>,
          h1: ({ children }) => <h1 className="my-3 text-xl font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="my-3 text-lg font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="my-3 text-base font-semibold">{children}</h3>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          code: ({ children, ...rest }) => (
            <code
              className="rounded px-1 py-0.5 font-mono text-sm"
              style={{ background: 'var(--surface-raised)' }}
              {...rest}
            >
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="my-3 border-l-4 pl-3"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
