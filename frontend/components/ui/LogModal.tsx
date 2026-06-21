'use client';

import { useEffect, useState } from 'react';
import { systemApi, type SystemLog } from '@/lib/api';
import clsx from 'clsx';

export default function LogModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await systemApi.getLogs();
        if (mounted) setLogs(res.logs);
      } catch {
        if (mounted) setLogs([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [isOpen]);

  return (
    <dialog className={clsx('modal', isOpen && 'modal-open')}>
      <div className="modal-box max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">System logs</h3>
            <p className="text-sm text-base-content/60">Live backend buffer</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="divider" />
        {loading && logs.length === 0 ? (
          <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg" /></div>
        ) : (
          <div className="mockup-code max-h-[60vh] overflow-auto scroll-area">
            {logs.length === 0 ? (
              <pre data-prefix=">"><code>No logs available</code></pre>
            ) : logs.map((log, index) => (
              <pre key={`${log.timestamp}-${index}`} data-prefix={log.level}>
                <code>{`${log.timestamp} ${log.name}: ${log.message}`}</code>
              </pre>
            ))}
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
