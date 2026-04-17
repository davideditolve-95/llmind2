'use client';

import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={clsx(
      "prose prose-slate prose-sm max-w-none dark:prose-invert",
      "prose-headings:font-black prose-headings:tracking-tight",
      "prose-p:leading-relaxed",
      "prose-strong:font-black",
      "prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none",
      "prose-pre:bg-slate-900 prose-pre:rounded-2xl prose-pre:shadow-2xl",
      "prose-li:marker:text-slate-400",
      "prose-table:border prose-table:border-slate-200 prose-table:rounded-xl prose-table:overflow-hidden",
      "prose-th:bg-slate-50 prose-th:px-4 prose-th:py-2",
      "prose-td:px-4 prose-td:py-2",
      className
    )}>
      <ReactMarkdown>
        {content}
      </ReactMarkdown>
    </div>
  );
}
