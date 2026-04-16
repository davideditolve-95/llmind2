'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { icd11Api } from '@/lib/api';
import { Info, Activity, Database, ArrowRight } from 'lucide-react';

// Importazione dinamica del componente 3D (solo lato client, no SSR)
const HumanBody = dynamic(() => import('@/components/3d/HumanBody'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-warm-50/50 rounded-3xl">
      <div className="text-center animate-fade-in">
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl border-2 border-sage-100 border-t-sage-500 animate-spin" />
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Initializing Biometric Link</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [stats, setStats] = useState<{ total_codes: number; chapters: number; status: string } | null>(null);
  const [selectedSection, setSelectedSection] = useState<{ code: string; label: string } | null>(null);
  const [diseases, setDiseases] = useState<any[]>([]);
  const [loadingDiseases, setLoadingDiseases] = useState(false);

  // Carica le statistiche ICD-11 all'avvio
  useEffect(() => {
    icd11Api.getStats().then(setStats).catch(() => {});
  }, []);

  // Quando viene selezionata una sezione del corpo
  const handleChapterSelect = useCallback(async (code: string, label: string) => {
    setSelectedSection({ code, label });
    setLoadingDiseases(true);
    setDiseases([]);
    
    try {
      const searchRes = await icd11Api.getCodes({ 
        level: 0,
        search: code,
        page_size: 10
      });

      if (searchRes.items.length > 0) {
        const chapter = searchRes.items.find(i => i.code === code) || searchRes.items[0];
        const chapterId = chapter.id;
        
        const childrenRes = await icd11Api.getCodes({ 
          parent_id: chapterId,
          page_size: 20
        });
        setDiseases(childrenRes.items);
      }
    } catch (err) {
      console.error('Error fetching linked diseases:', err);
    } finally {
      setLoadingDiseases(false);
    }
  }, []);

  return (
    <div className="grid grid-cols-[1fr_420px] h-[calc(100vh-4rem)] bg-warm-50 p-6 gap-6 animate-fade-in overflow-hidden">
      
      {/* ─── Visualizzazione 3D Corporate ────────────────────────────────── */}
      <div className="flex flex-col min-w-0 h-full">
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-sage-500 shadow-glow-sage" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-sage-600">Clinical Visualization</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Anatomical Explorer</h1>
          <p className="text-slate-500 text-xs mt-1 max-w-xl font-medium leading-relaxed">
            Interagisci con il gemello digitale ICD-11 per mappare la classificazione clinica sui distretti anatomici.
          </p>
        </div>
        
        <div className="flex-1 relative anatomical-canvas-container min-h-0 bg-white/40 rounded-3xl border border-white/60 shadow-sm overflow-hidden">
          <HumanBody onSelectChapter={handleChapterSelect} />
          
          {stats && (
            <div className="absolute top-4 left-4 pointer-events-none animate-slide-up">
              <div className="glass rounded-xl p-3 shadow-xl border border-white/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sage-500/10 flex items-center justify-center text-sage-600">
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-black text-slate-800 leading-none">
                        {stats.total_codes.toLocaleString()}
                      </span>
                      <span className="text-[8px] text-sage-600 font-bold uppercase tracking-wider">ENTITIES</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Pannello Laterale Dettagli ──────────────────────────────────── */}
      <div className="flex flex-col gap-4 h-full min-w-0 overflow-hidden">
        
        <div className="card-premium flex-1 flex flex-col min-h-0 overflow-hidden shadow-xl bg-white/80 border border-white">
          {!selectedSection ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 animate-pulse-soft">
              <div className="w-16 h-16 rounded-2xl bg-sage-50 flex items-center justify-center mb-6 shadow-inner group">
                <Activity className="w-6 h-6 text-sage-200 group-hover:text-sage-500 transition-colors duration-500" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">Anatomical Selection</h3>
              <p className="text-[13px] text-slate-400 leading-relaxed font-medium">
                Click a region on the 3D model to map medical observation metadata.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-slide-up p-6">
              <div className="flex items-center gap-4 mb-6 bg-warm-50/50 p-4 rounded-xl border border-warm-100 flex-shrink-0">
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-base shadow-lg">
                  {selectedSection.code}
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-base font-black text-slate-900 leading-tight truncate">{selectedSection.label}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse" />
                    <p className="text-[8px] text-sage-600 font-black uppercase tracking-widest">ICD-11 Mode Active</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 max-h-[calc(100vh-22rem)]">
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/80 backdrop-blur-md py-2 z-10 border-b border-warm-100">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Targeted Pathologies</h4>
                  <span className="text-sage-600 text-[9px] font-black">{diseases.length} Found</span>
                </div>
                
                {loadingDiseases ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-16 bg-warm-50/50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 pb-2">
                    {diseases.length > 0 ? diseases.map((disease) => (
                      <div 
                        key={disease.id}
                        onClick={() => router.push(`/tabular?id=${disease.id}&search=${encodeURIComponent(disease.title_en)}`)}
                        className="p-4 bg-white hover:bg-slate-50 border border-warm-100/60 hover:border-sage-200 rounded-xl transition-all cursor-pointer group shadow-sm hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[9px] font-black text-sage-500 tracking-widest uppercase bg-sage-50 px-1.5 py-0.5 rounded border border-sage-100 group-hover:bg-sage-500 group-hover:text-white transition-colors duration-300">
                            {disease.code || disease.id.substring(0, 4).toUpperCase()}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-200 group-hover:text-sage-500 group-hover:translate-x-1 transition-all" />
                        </div>
                        <p className="text-sm font-bold text-slate-800 leading-snug group-hover:text-slate-950 transition-colors">
                          {disease.title_en}
                        </p>
                      </div>
                    )) : (
                      <div className="py-10 text-center border border-dashed border-warm-200 rounded-xl">
                        <Info className="w-5 h-5 text-warm-200 mx-auto mb-2" />
                        <p className="text-[9px] text-warm-400 font-black uppercase tracking-widest px-6">No clinical clusters found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-warm-100 flex-shrink-0">
                <button 
                  onClick={() => router.push('/tabular')}
                  className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 group"
                >
                  Explore Full Hierarchy
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Card secondaria - Premium Dark Glass */}
        <div className="glass-dark rounded-[2rem] p-6 text-white shadow-2xl overflow-hidden relative group flex-shrink-0 h-[180px]">
          <div className="absolute right-0 top-0 w-24 h-24 bg-sage-500/20 blur-[50px]" />
          <div className="relative z-10 flex flex-col h-full">
            <h4 className="text-[9px] font-black tracking-widest uppercase text-sage-400 mb-3">Diagnostic Pipeline</h4>
            <p className="text-xs font-medium text-slate-300 leading-relaxed mb-auto">
              Mapping <span className="text-white font-bold opacity-100">DSM-5-TR</span> observations to <span className="text-white font-bold opacity-100">ICD-11</span> taxonomies via advanced hybrid inference.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex -space-x-2.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-7 h-7 rounded-lg border-2 border-slate-950 bg-slate-900 flex items-center justify-center text-[8px] font-black shadow-lg">
                    {i === 1 ? 'AI' : i === 2 ? 'CL' : 'DB'}
                  </div>
                ))}
              </div>
              <div className="text-[8px] font-black text-sage-400 uppercase tracking-widest">MMS Linearization Active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

