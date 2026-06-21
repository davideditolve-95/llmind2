'use client';

import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={clsx('prose prose-sm max-w-none prose-headings:font-semibold prose-pre:bg-neutral prose-pre:text-neutral-content', className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
