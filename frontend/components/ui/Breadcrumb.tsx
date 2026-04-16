'use client';

import { ChevronRight, Home } from 'lucide-react';
import clsx from 'clsx';

interface BreadcrumbItem {
  id: string;
  label: string;
  code?: string | null;
}

interface BreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate?: (index: number) => void;
}

/**
 * Componente Breadcrumb sovrapposto al canvas 3D.
 * Mostra il percorso di navigazione nella gerarchia ICD-11.
 * Esempio: ICD-11 > Mental Disorders > Anxiety Disorders > GAD
 */
export default function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  if (!path.length) return null;

  return (
    <div className="inline-flex items-center bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-3 py-2 gap-1 max-w-lg overflow-x-auto">
      {path.map((item, index) => (
        <span key={item.id} className="flex items-center gap-1 flex-shrink-0">
          {/* Freccia di separazione */}
          {index > 0 && (
            <ChevronRight className="w-3 h-3 text-white/40 flex-shrink-0" />
          )}

          {/* Elemento del breadcrumb (cliccabile se non è l'ultimo) */}
          <button
            onClick={() => onNavigate?.(index - 1)} // -1 perché il root non è nel path reale
            className={clsx(
              'flex items-center gap-1 text-xs rounded-lg px-1.5 py-0.5 transition-all',
              index === path.length - 1
                ? 'text-white font-semibold cursor-default'
                : 'text-white/70 hover:text-white hover:bg-white/10 cursor-pointer'
            )}
          >
            {index === 0 && <Home className="w-3 h-3" />}
            {item.code && (
              <span className="text-sage-300 font-mono font-bold">{item.code}</span>
            )}
            <span>{item.label.length > 30 ? item.label.substring(0, 30) + '…' : item.label}</span>
          </button>
        </span>
      ))}
    </div>
  );
}
