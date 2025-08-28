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
      className={`prose prose-sm max-w-none [&_*]:!text-inherit ${className} [&_p]:!m-0`}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
      {imageUrl && (
        <img src={imageUrl} alt="Uploaded image" className="w-full h-auto" />
      )}
    </div>
  );
}
