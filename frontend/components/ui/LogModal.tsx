'use client';

import { useState, useEffect, useRef } from 'react';
import { systemApi, type SystemLog } from '@/lib/api';
import { XMarkIcon, CommandLineIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LogModal({ isOpen, onClose }: LogModalProps) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await systemApi.getLogs();
      setLogs(res.logs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: any;
    if (isOpen && autoRefresh) {
      interval = setInterval(fetchLogs, 3000);
    }
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl h-[80vh] bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="h-4 w-px bg-slate-700 mx-2" />
            <CommandLineIcon className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Backend System Logs</span>
            {loading && <ArrowPathIcon className="w-3 h-3 text-indigo-400 animate-spin" />}
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">Auto-Refresh</span>
              <input 
                type="checkbox" 
                className="toggle toggle-xs toggle-primary"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            </label>
            <button 
              onClick={() => setLogs([])}
              className="text-slate-500 hover:text-white transition-colors"
              title="Clear View"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
            <button 
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors p-1"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Terminal Content */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-auto p-6 font-mono text-[11px] leading-relaxed custom-scrollbar selection:bg-indigo-500/30"
        >
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
              <CommandLineIcon className="w-12 h-12 mb-4" />
              <p className="font-black uppercase tracking-[0.5em]">No log events in buffer</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="group flex gap-4 hover:bg-slate-900/30 rounded px-2 -mx-2 transition-colors">
                  <span className="text-slate-500 whitespace-nowrap shrink-0">[{log.timestamp}]</span>
                  <span className={clsx(
                    "font-bold uppercase whitespace-nowrap shrink-0 w-12",
                    log.level === 'ERROR' ? "text-red-400" :
                    log.level === 'WARNING' ? "text-amber-400" :
                    log.level === 'INFO' ? "text-emerald-400" : "text-indigo-400"
                  )}>
                    {log.level}
                  </span>
                  <span className="text-slate-400 whitespace-nowrap shrink-0">[{log.name}]</span>
                  <span className="text-slate-200 break-words">{log.message}</span>
                </div>
              ))}
              <div className="pt-4 flex items-center gap-2 text-indigo-500 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span className="font-black uppercase text-[9px] tracking-[0.4em]">Streaming sequence active...</span>
              </div>
            </div>
          )}
        </div>

        {/* Terminal Footer */}
        <div className="px-6 py-2 border-t border-slate-800 bg-slate-900/30 flex items-center justify-between">
           <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
             Buffer: {logs.length} events • Session: {new Date().toLocaleDateString()}
           </div>
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Backend Connected</span>
           </div>
        </div>
      </div>
    </div>
  );
}
