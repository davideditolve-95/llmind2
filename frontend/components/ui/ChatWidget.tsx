'use client';

import Link from 'next/link';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export default function ChatWidget() {
  return (
    <Link href="/chat" className="btn btn-primary btn-circle fixed bottom-5 right-5 z-30 shadow-lg" aria-label="Open chat">
      <ChatBubbleLeftRightIcon className="h-6 w-6" />
    </Link>
  );
}
