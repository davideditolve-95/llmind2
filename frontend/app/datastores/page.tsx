'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { datastoreApi, chatApi, type Datastore, type KnowledgePreset } from '@/lib/api';
import { 
  CloudArrowUpIcon, 
  TrashIcon, 
  CircleStackIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ChatBubbleBottomCenterTextIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import clsx from 'clsx';

export default function DatastoresPage() {
  const { t } = useI18n();
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [presets, setPresets] = useState<KnowledgePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Create state
  const [newName, setNewName] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dsList, modelList, presetList] = await Promise.all([
        datastoreApi.list(),
        chatApi.getModels(),
        datastoreApi.getPresets()
      ]);
      setDatastores(dsList);
      setModels(modelList.models);
      setPresets(presetList);
      
      if (modelList.models.length > 0 && !selectedModel) {
        setSelectedModel(modelList.default_model || modelList.models[0]);
      }
      if (presetList.length > 0 && !selectedPresetId) {
        setSelectedPresetId(presetList[0].id);
      }
    } catch (error) {
      console.error('Failed to load datastores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPresetId || !newName || !selectedModel) return;

    setIsCreating(true);
    const formData = new FormData();
    formData.append('preset_id', selectedPresetId);
    formData.append('name', newName);
    formData.append('model_name', selectedModel);

    try {
      await datastoreApi.create(formData);
      setIsModalOpen(false);
      setNewName('');
      loadData();
    } catch (error) {
      alert('Failed to create datastore');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this datastore? All vector data will be lost.')) return;
    try {
      await datastoreApi.delete(id);
      loadData();
    } catch (error) {
      alert('Failed to delete datastore');
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-50 page-enter">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-10 py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-200">
              <CircleStackIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Knowledge Library</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="h-1 w-8 bg-indigo-500 rounded-full" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Custom RAG Datastore Management</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest gap-3 shadow-lg shadow-indigo-500/30"
          >
            <PlusIcon className="w-5 h-5" />
            Build New Library
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-10 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-6 opacity-30">
              <ArrowPathIcon className="w-12 h-12 animate-spin text-indigo-600" />
              <span className="text-[11px] font-black uppercase tracking-[0.4em]">Syncing Archives...</span>
            </div>
          ) : datastores.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-20 text-center">
               <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                  <CloudArrowUpIcon className="w-10 h-10" />
               </div>
               <h3 className="text-xl font-bold text-slate-400 mb-2 uppercase tracking-tight">No Custom Libraries Detected</h3>
               <p className="text-sm text-slate-400 max-w-sm mx-auto font-medium">
                 Start by uploading a PDF or Text document to create your first specialized clinical datastore.
               </p>
               <button 
                 onClick={() => setIsModalOpen(true)}
                 className="mt-8 text-indigo-600 font-black text-xs uppercase tracking-widest hover:text-indigo-700 underline underline-offset-8"
               >
                 Initialize your first upload
               </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {datastores.map((ds) => (
                <div key={ds.id} className="premium-card p-0 overflow-hidden flex flex-col group">
                  <div className="p-8 pb-4 flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className={clsx(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                        ds.status === 'ready' ? "bg-emerald-50 text-emerald-600" : 
                        ds.status === 'processing' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                      )}>
                        <CircleStackIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{ds.name}</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{ds.model_name}</p>
                      </div>
                    </div>
                    
                    <div className="badge h-8 px-4 font-black uppercase text-[10px] tracking-widest border-none text-white shadow-sm" style={{ 
                      backgroundColor: ds.status === 'ready' ? '#10b981' : ds.status === 'processing' ? '#f59e0b' : '#ef4444' 
                    }}>
                      {ds.status}
                    </div>
                  </div>

                  <div className="px-8 flex-1">
                     <p className="text-sm text-slate-500 font-medium line-clamp-2 italic h-10">
                       {ds.description || "No description provided for this datastore."}
                     </p>
                     
                     <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-4">
                          <span>Chunks: <b className="text-slate-800">{ds.metadata_info?.chunks || 0}</b></span>
                          <span>Created: <b className="text-slate-800">{new Date(ds.created_at).toLocaleDateString()}</b></span>
                        </div>
                     </div>
                  </div>

                  <div className="mt-8 p-4 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 group-hover:bg-slate-50 transition-colors">
                     {ds.status === 'ready' && (
                       <Link 
                         href={`/explorer?ds=${ds.id}`}
                         className="flex-1 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center gap-2 text-indigo-600 font-black text-[11px] uppercase tracking-widest hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all hover:-translate-y-0.5"
                       >
                         <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                         Open Explorer
                       </Link>
                     )}
                     <button 
                       onClick={() => handleDelete(ds.id)}
                       className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
                     >
                       <TrashIcon className="w-5 h-5" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Creazione */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isCreating && setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
             <div className="bg-slate-900 px-10 py-8 text-white flex justify-between items-center">
                <div>
                   <h2 className="text-2xl font-black uppercase tracking-tight">Create Clinical Archive</h2>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Select logic sequence and predefined knowledge</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                   <PlusIcon className="w-6 h-6 rotate-45" />
                </button>
             </div>

             <form onSubmit={handleCreate} className="p-10 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                      <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Archive Name</label>
                         <input 
                           required
                           type="text" 
                           className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                           value={newName}
                           onChange={(e) => setNewName(e.target.value)}
                           placeholder="e.g. Master Diagnostic File"
                         />
                      </div>

                      <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Clinical Preset</label>
                         <select 
                           required
                           className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                           value={selectedPresetId}
                           onChange={(e) => setSelectedPresetId(e.target.value)}
                         >
                           {presets.map(p => (
                             <option key={p.id} value={p.id}>{p.name}</option>
                           ))}
                         </select>
                      </div>

                      <div>
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Embedding Engine</label>
                         <select 
                           required
                           className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                           value={selectedModel}
                           onChange={(e) => setSelectedModel(e.target.value)}
                         >
                           {models.map(m => <option key={m} value={m}>{m}</option>)}
                         </select>
                      </div>
                   </div>

                   <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Preset Contents</h4>
                      <div className="flex-1 space-y-3">
                         {presets.find(p => p.id === selectedPresetId)?.files.map((f, i) => (
                           <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm overflow-hidden">
                              <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              <span className="text-[11px] font-bold text-slate-600 truncate">{f}</span>
                           </div>
                         ))}
                      </div>
                      <div className="mt-4 p-4 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-bold leading-relaxed">
                         The selected preset bundles all verified clinical documents required for the integrated LLMind diagnostic workflow.
                      </div>
                   </div>
                </div>

                <div className="pt-6 flex gap-4 border-t border-slate-100">
                   <button 
                     type="button"
                     disabled={isCreating}
                     onClick={() => setIsModalOpen(false)}
                     className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors border-2 border-transparent"
                   >
                     Abort Build
                   </button>
                   <button 
                     type="submit"
                     disabled={isCreating || !selectedPresetId}
                     className="flex-[1.5] h-14 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                   >
                     {isCreating ? (
                       <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Consolidating...</>
                     ) : (
                       <><CircleStackIcon className="w-5 h-5" /> Initialize Archive</>
                     )}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
