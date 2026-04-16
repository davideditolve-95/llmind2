'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/context';
import { chatApi } from '@/lib/api';
import {
  HeartIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  UserIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import MarkdownContent from '@/components/ui/MarkdownContent';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function WellbeingPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionIdRef = useRef(uuidv4());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { id: uuidv4(), role: 'user', content: input.trim() };
    const assistantMsg: Message = { id: uuidv4(), role: 'assistant', content: '', streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const stream = await chatApi.streamMessage({
        message: userMsg.content,
        session_id: sessionIdRef.current,
        mode: 'wellbeing',
        model_name: 'gemma4',
        language: 'en',
      });

      if (!stream) throw new Error('Stream unavailable');
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                fullContent += parsed.chunk;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m))
                );
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: '[Error connecting to AI service]' } : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false } : m))
      );
      setIsStreaming(false);
    }
  }, [input, isStreaming]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 page-enter overflow-hidden">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex-shrink-0 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <BeakerIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-xl leading-none">{t('wellbeing.title')}</h1>
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mt-0.5">Differential Diagnosis Engine</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 ml-2">
              <span className={clsx('w-2 h-2 rounded-full', isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500')} />
              <span className="text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                {isStreaming ? 'Streaming...' : 'Ready'}
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 max-w-xs">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-amber-700 text-xs font-medium leading-snug">{t('wellbeing.disclaimer')}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-16 py-10 space-y-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-8 py-20">
            <div className="w-28 h-28 rounded-[3rem] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
              <SparklesIcon className="w-14 h-14 text-white" />
            </div>
            <div className="space-y-3 max-w-md">
              <p className="text-3xl font-black text-slate-800 tracking-tight">Differential Diagnosis</p>
              <p className="text-slate-500 font-medium text-lg leading-relaxed">Multi-agent biopsychosocial diagnostic reasoning</p>
              <p className="text-slate-400 text-base">{t('wellbeing.intro')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-lg text-left mt-4">
              {[
                'Describe patient symptoms in detail',
                'Include age, gender, duration',
                'Mention relevant medical history',
                'Ask for specific diagnostic criteria',
              ].map((hint, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 text-xs font-black">{i + 1}</div>
                  <p className="text-slate-600 text-sm font-medium leading-snug">{hint}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'flex gap-5 animate-slide-up',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {/* Avatar */}
              <div className={clsx(
                'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg',
                msg.role === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
              )}>
                {msg.role === 'user' ? <UserIcon className="w-6 h-6" /> : <SparklesIcon className="w-6 h-6" />}
              </div>

              {/* Bubble */}
              <div className={clsx(
                'max-w-[75%] rounded-3xl px-8 py-6 shadow-sm',
                msg.role === 'user'
                  ? 'bg-slate-800 text-white rounded-tr-md'
                  : 'bg-white text-slate-800 rounded-tl-md border border-slate-200'
              )}>
                <div className={clsx(
                  'prose prose-base max-w-none leading-relaxed',
                  msg.role === 'user' ? 'prose-invert' : 'prose-slate'
                )}>
                  <MarkdownContent content={msg.content} className="text-inherit text-base" />
                  {msg.streaming && <span className="streaming-cursor" />}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-6 md:px-16 py-6 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder={t('wellbeing.case_placeholder')}
              rows={3}
              className="w-full resize-none px-7 py-5 pr-20 text-base font-medium text-slate-800 bg-slate-50 border-2 border-slate-200 focus:border-emerald-400 rounded-3xl focus:outline-none focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.06)] transition-all placeholder:text-slate-300 leading-relaxed shadow-inner"
              disabled={isStreaming}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="absolute bottom-4 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all border-none disabled:opacity-30"
            >
              {isStreaming
                ? <ArrowPathIcon className="w-6 h-6 text-white animate-spin" />
                : <PaperAirplaneIcon className="w-6 h-6 text-white -rotate-45 -translate-y-0.5 translate-x-0.5" />
              }
            </button>
          </div>
          <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.4em] text-center mt-3">
            Enter · Send · Shift+Enter · New Line
          </p>
        </div>
      </div>
    </div>
  );
}
