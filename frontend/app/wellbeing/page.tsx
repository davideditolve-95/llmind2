'use client';

import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/context';
import { chatApi } from '@/lib/api';
import { HeartPulse, Send, RefreshCw, AlertTriangle, Bot, User } from 'lucide-react';

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
        const lines = decoder.decode(value, { stream: true }).split('\n');
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
          m.id === assistantMsg.id ? { ...m, content: '[Error connecting to AI]' } : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, streaming: false } : m))
      );
      setIsStreaming(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [input, isStreaming]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gradient-to-br from-lavender-50 to-warm-50 page-enter">
      {/* Header */}
      <div className="bg-white border-b border-lavender-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lavender-300 to-lavender-400 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800">{t('wellbeing.title')}</h1>
            <p className="text-xs text-slate-500">{t('wellbeing.subtitle')}</p>
          </div>
        </div>

        {/* Disclaimer clinico */}
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{t('wellbeing.disclaimer')}</p>
        </div>
      </div>

      {/* Messaggi */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-lavender-200 to-lavender-300 flex items-center justify-center mb-5 shadow-glow-powder">
              <HeartPulse className="w-10 h-10 text-lavender-700" />
            </div>
            <h2 className="font-semibold text-slate-700 mb-2">{t('wellbeing.title')}</h2>
            <p className="text-slate-500 text-sm leading-relaxed">{t('wellbeing.intro')}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx('flex gap-3 max-w-3xl mx-auto w-full', msg.role === 'user' ? 'flex-row-reverse' : '')}
          >
            <div className={clsx(
              'w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-soft',
              msg.role === 'user' ? 'bg-sage-400' : 'bg-lavender-200'
            )}>
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-white" />
                : <Bot className="w-4 h-4 text-lavender-700" />}
            </div>

            <div className={clsx(
              'flex-1 px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-soft max-w-[80%]',
              msg.role === 'user'
                ? 'bg-sage-400 text-white rounded-tr-sm ml-auto'
                : 'bg-white text-slate-700 border border-lavender-100 rounded-tl-sm'
            )}>
              <div className={clsx('whitespace-pre-wrap', msg.streaming && !msg.content && 'streaming-cursor')}>
                {msg.content}
                {msg.streaming && msg.content && <span className="streaming-cursor" />}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-lavender-200 px-6 py-4">
        <div className="flex gap-3 items-end max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={t('wellbeing.case_placeholder')}
            rows={3}
            className="textarea-field flex-1 border-lavender-200 focus:ring-lavender-300 focus:border-lavender-400"
            disabled={isStreaming}
          />
          <button onClick={sendMessage} disabled={!input.trim() || isStreaming} className="btn h-[88px] w-14 bg-lavender-400 text-white hover:bg-lavender-500">
            {isStreaming ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
