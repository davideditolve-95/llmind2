'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { datastoreApi, type Datastore } from '@/lib/api';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { ArrowPathIcon, CircleStackIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={<div className="app-page"><span className="loading loading-spinner loading-lg" /></div>}>
      <ExplorerContent />
    </Suspense>
  );
}

function ExplorerContent() {
  const searchParams = useSearchParams();
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('ds') || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    datastoreApi.list().then((items) => {
      const ready = items.filter((item) => item.status === 'ready');
      setDatastores(ready);
      if (!selectedId && ready[0]) setSelectedId(ready[0].id);
    }).catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selected = datastores.find((item) => item.id === selectedId);

  const ask = async () => {
    if (!input.trim() || !selectedId || loading) return;
    const query = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);
    try {
      const res = await datastoreApi.ask(selectedId, query);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: error instanceof Error ? error.message : 'RAG query failed.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 overflow-hidden lg:grid-cols-[20rem_1fr]">
      <aside className="border-r border-base-300 bg-base-100 p-4">
        <h1 className="text-lg font-semibold">Custom Explorer</h1>
        <p className="mt-1 text-sm text-base-content/60">Query a ready datastore.</p>
        <select className="select select-bordered mt-4 w-full" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setMessages([]); }}>
          {datastores.map((ds) => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
        </select>
        {selected && (
          <div className="mt-4 rounded-box bg-base-200 p-4 text-sm">
            <div className="font-medium">{selected.model_name}</div>
            <div className="text-base-content/60">{selected.metadata_info?.chunks || 0} chunks</div>
          </div>
        )}
      </aside>
      <section className="flex min-h-0 flex-col">
        <div className="scroll-area flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.length === 0 && (
              <div className="hero min-h-[24rem] rounded-box bg-base-100">
                <div className="hero-content text-center">
                  <div>
                    <CircleStackIcon className="mx-auto h-12 w-12 text-primary" />
                    <h2 className="mt-4 text-2xl font-semibold">{selected ? selected.name : 'No datastore selected'}</h2>
                    <p className="mt-2 text-base-content/60">Ask a question against the selected vector store.</p>
                  </div>
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`chat ${message.role === 'user' ? 'chat-end' : 'chat-start'}`}>
                <div className={`chat-bubble max-w-3xl ${message.role === 'assistant' ? 'chat-bubble-primary' : ''}`}>
                  <MarkdownContent content={message.content} className={message.role === 'assistant' ? 'prose-invert' : ''} />
                </div>
              </div>
            ))}
            {loading && <div className="chat chat-start"><div className="chat-bubble chat-bubble-primary"><span className="loading loading-dots loading-sm" /></div></div>}
            <div ref={scrollRef} />
          </div>
        </div>
        <div className="border-t border-base-300 bg-base-100 p-4">
          <div className="mx-auto flex max-w-4xl gap-2">
            <input className="input input-bordered flex-1" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Ask the datastore..." disabled={!selectedId || loading} />
            <button className="btn btn-primary" onClick={ask} disabled={!input.trim() || !selectedId || loading}>
              {loading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PaperAirplaneIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
