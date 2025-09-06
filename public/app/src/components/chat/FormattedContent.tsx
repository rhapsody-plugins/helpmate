import ReactMarkdown from 'react-markdown';

interface FormattedContentProps {
  content: string;
  className?: string;
  imageUrl?: string;
}

export function FormattedContent({
  content,
  className = '',
  imageUrl,
}: FormattedContentProps) {
  return (
    <div
      className={`prose prose-sm max-w-none [&_*]:!text-inherit [&_a]:!text-primary ${className}`}
      style={{ fontSize: 'var(--font-size)', lineHeight: '1.2' }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
      {imageUrl && (
        <img src={imageUrl} alt="Uploaded image" className="w-full h-auto" />
      )}
    </div>
  );
}
