'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/context';
import { chatApi } from '@/lib/api';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import MarkdownContent from './MarkdownContent';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function ChatWidget() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId] = useState(uuidv4());
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
    };
    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const stream = await chatApi.streamMessage({
        message: userMsg.content,
        session_id: currentSessionId,
        mode: 'icd11',
        model_name: 'gemma4', // Default for widget
        language: 'en',
      });

      if (!stream) throw new Error('Stream non disponibile');

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
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: '[Error connecting to AI service]' }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, streaming: false } : m
        )
      );
      setIsStreaming(false);
    }
  }, [input, isStreaming, currentSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="w-[420px] max-w-[calc(100vw-4rem)] h-[600px] bg-white shadow-2xl border border-slate-200 mb-6 flex flex-col overflow-hidden animate-slide-up origin-bottom-right rounded-[2rem]">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                <ChatBubbleLeftRightIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="font-black text-lg block leading-none">Clinical Assistant</span>
                <span className="text-[10px] uppercase font-black opacity-40 tracking-widest mt-1 block">Powered by Gemini 1.5</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all relative z-10">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-base-50/50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-12 animate-fade-in-slow">
                <div className="w-20 h-20 rounded-[2.5rem] bg-primary/5 flex items-center justify-center text-primary mb-6 shadow-inner">
                  <ChatBubbleLeftRightIcon className="w-10 h-10" />
                </div>
                <h3 className="font-black text-xl mb-2">How can I assist you?</h3>
                <p className="text-sm opacity-50 font-medium leading-relaxed">
                  I can analyze DSM-5 cases, suggest differential diagnoses based on ICD-11, or answer clinical metadata questions.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={clsx("chat group", msg.role === 'user' ? "chat-end" : "chat-start")}>
                <div className="chat-header opacity-30 text-[9px] font-black uppercase tracking-widest mb-1.5 px-1 flex items-center gap-2">
                  {msg.role === 'user' ? 'Practitioner' : 'AI Engine'}
                  <div className={clsx("w-1 h-1 rounded-full", msg.role === 'user' ? "bg-indigo-600" : "bg-emerald-600")} />
                </div>
                <div className={clsx(
                  "text-sm leading-relaxed shadow-sm p-4", 
                  msg.role === 'user' 
                    ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none font-medium" 
                    : "bg-slate-50 text-slate-800 border border-slate-200 rounded-2xl rounded-tl-none"
                )}>
                  {msg.role === 'assistant' ? (
                    <MarkdownContent content={msg.content} />
                  ) : (
                    msg.content
                  )}
                  {msg.streaming && <span className="streaming-cursor" />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t border-slate-100 bg-white">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type clinical query..."
                  rows={1}
                  className="w-full min-h-[56px] max-h-[160px] text-sm py-4 px-5 rounded-2xl bg-slate-50 focus:bg-white transition-all border border-slate-200 focus:border-indigo-600 pr-12 focus:shadow-lg focus:shadow-indigo-500/5 outline-none font-medium text-slate-800"
                  disabled={isStreaming}
                />
                <div className="absolute top-4 right-4 text-[10px] font-black opacity-20 uppercase tracking-tighter text-slate-400">
                  Enter
                </div>
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className={clsx(
                  "h-14 w-14 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center",
                  (input.trim() && !isStreaming) ? "bg-indigo-600 text-white shadow-indigo-500/30" : "bg-slate-100 text-slate-400"
                )}
              >
                {isStreaming ? (
                  <ArrowPathIcon className="w-6 h-6 animate-spin" />
                ) : (
                  <PaperAirplaneIcon className="w-6 h-6" />
                )}
              </button>
            </div>
            <div className="mt-4 text-center">
              <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] italic">Secure Analysis Channel // ICD-11 Expert Mode</span>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-20 h-20 shadow-2xl transition-all hover:scale-110 active:scale-90 relative group overflow-hidden rounded-full flex items-center justify-center text-white",
          isOpen ? "bg-slate-900" : "bg-indigo-600 shadow-indigo-500/40"
        )}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isOpen ? (
          <XMarkIcon className="w-8 h-8" />
        ) : (
          <div className="relative">
             <ChatBubbleLeftRightIcon className="w-10 h-10 group-hover:rotate-12 transition-transform" />
             <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white opacity-20"></span>
             </span>
          </div>
        )}
      </button>
    </div>
  );
}
