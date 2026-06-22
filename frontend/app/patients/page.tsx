'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { patientsApi, type Patient } from '@/lib/api';
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

export default function PatientsPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modali
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  
  // Dati form
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('');
  const [behaviors, setBehaviors] = useState('');
  const [specificTraits, setSpecificTraits] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Eliminazione
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);

  const loadPatients = useCallback(async () => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      signIn('keycloak', { callbackUrl: '/patients' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await patientsApi.list(search || undefined);
      setPatients(data);
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      if (msg.includes('401') || msg.toLowerCase().includes('authenticated')) {
        setError('Session expired. Please sign in again.');
      } else {
        setError(`Unable to load patients: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = setTimeout(loadPatients, 250);
    return () => clearTimeout(timer);
  }, [loadPatients]);

  const openCreateModal = () => {
    setEditingPatient(null);
    setName('');
    setAge('');
    setGender('');
    setBehaviors('');
    setSpecificTraits('');
    setClinicalHistory('');
    setIsFormOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setName(patient.name);
    setAge(patient.age !== null ? patient.age : '');
    setGender(patient.gender || '');
    setBehaviors(patient.behaviors || '');
    setSpecificTraits(patient.specific_traits || '');
    setClinicalHistory(patient.clinical_history || '');
    setIsFormOpen(true);
  };

  const savePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        age: age === '' ? null : Number(age),
        gender: gender.trim() || null,
        behaviors: behaviors.trim() || null,
        specific_traits: specificTraits.trim() || null,
        clinical_history: clinicalHistory.trim() || null,
      };

      if (editingPatient) {
        await patientsApi.update(editingPatient.id, payload);
      } else {
        await patientsApi.create(payload);
      }
      setIsFormOpen(false);
      loadPatients();
    } catch (err: any) {
      alert(`Error saving patient: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePatient = async () => {
    if (!patientToDelete) return;
    try {
      await patientsApi.delete(patientToDelete.id);
      setPatientToDelete(null);
      loadPatients();
    } catch (err: any) {
      alert(`Error deleting patient: ${err?.message || 'Unknown error'}`);
    }
  };

  const startChat = (patientId: string) => {
    router.push(`/chat?patientId=${patientId}`);
  };

  return (
    <div className="app-page space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="app-title">Patient Management</h1>
          <p className="app-subtitle mt-2">Manage clinical patients profiles, edit characteristics, or start contextualized chats.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <PlusIcon className="h-4 w-4" />
          Add Patient
        </button>
      </div>

      {/* Search and error */}
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          className="input input-bordered flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients by name or symptoms..."
        />
      </div>

      {error && (
        <div className="alert alert-error flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost ml-auto" onClick={() => signIn('keycloak', { callbackUrl: '/patients' })}>
            Sign In
          </button>
        </div>
      )}

      {/* Grid of Patients */}
      {loading ? (
        <div className="py-24 text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : patients.length === 0 ? (
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body py-16 text-center text-base-content/50">
            <UserIcon className="h-12 w-12 mx-auto text-base-content/30 mb-3" />
            <p className="text-lg font-medium">No patients found</p>
            <p className="text-sm mt-1">Create a new patient manually or convert an existing clinical case.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {patients.map((patient) => (
            <div key={patient.id} className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="card-body p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="card-title text-lg font-bold text-base-content">{patient.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-base-content/60">
                      {patient.age !== null && <span>Age: {patient.age}</span>}
                      {patient.age !== null && patient.gender && <span>•</span>}
                      {patient.gender && <span className="capitalize">{patient.gender}</span>}
                    </div>
                  </div>
                  <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-9 h-9 border border-primary/20 shadow-inner">
                      <span className="text-sm font-bold uppercase">{patient.name.substring(0, 2)}</span>
                    </div>
                  </div>
                </div>

                {patient.behaviors && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">Symptoms & Behaviors</h4>
                    <p className="text-sm line-clamp-2 text-base-content/80">{patient.behaviors}</p>
                  </div>
                )}

                {patient.specific_traits && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">Personality Traits</h4>
                    <p className="text-sm line-clamp-2 text-base-content/80">{patient.specific_traits}</p>
                  </div>
                )}

                {patient.clinical_history && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/40">Clinical History</h4>
                    <p className="text-sm line-clamp-2 text-base-content/80">{patient.clinical_history}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-base-200 p-3 bg-base-50/50 flex gap-2 justify-end rounded-b-box">
                <button
                  className="btn btn-ghost btn-sm text-error btn-square"
                  onClick={() => setPatientToDelete(patient)}
                  title="Delete patient"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                <button
                  className="btn btn-ghost btn-sm btn-square"
                  onClick={() => openEditModal(patient)}
                  title="Edit patient"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  className="btn btn-primary btn-sm flex-1 font-medium gap-1.5"
                  onClick={() => startChat(patient.id)}
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  Start Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CRUD Form Modal */}
      {isFormOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl bg-base-100 border border-base-300">
            <h3 className="font-bold text-lg border-b border-base-200 pb-3">
              {editingPatient ? 'Edit Patient Profile' : 'Add New Patient'}
            </h3>
            
            <form onSubmit={savePatient} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-control md:col-span-2">
                  <label className="label"><span className="label-text font-medium">Name <span className="text-error">*</span></span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    className="input input-bordered w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Age</span></label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    placeholder="e.g. 45"
                    className="input input-bordered w-full"
                    value={age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Gender</span></label>
                <input
                  type="text"
                  placeholder="e.g. Male, Female, Non-binary"
                  className="input input-bordered w-full"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Symptoms & Behaviors</span></label>
                <textarea
                  className="textarea textarea-bordered min-h-24 w-full"
                  placeholder="Describe behaviors, emotional states, repeating symptoms, etc."
                  value={behaviors}
                  onChange={(e) => setBehaviors(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Specific Traits & Persona</span></label>
                <textarea
                  className="textarea textarea-bordered min-h-20 w-full"
                  placeholder="Personality features, demeanor, cooperativeness, anxiety levels..."
                  value={specificTraits}
                  onChange={(e) => setSpecificTraits(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Anamnesis & Clinical History</span></label>
                <textarea
                  className="textarea textarea-bordered min-h-24 w-full"
                  placeholder="Previous treatments, symptoms onset, family clinical history, duration..."
                  value={clinicalHistory}
                  onChange={(e) => setClinicalHistory(e.target.value)}
                />
              </div>

              <div className="modal-action border-t border-base-200 pt-3">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary min-w-32"
                  disabled={isSaving || !name.trim()}
                >
                  {isSaving ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {patientToDelete && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-100 border border-base-300">
            <h3 className="font-bold text-lg text-error">Delete Patient Profile</h3>
            <p className="py-4 text-base-content/80">
              Are you sure you want to delete patient <strong>{patientToDelete.name}</strong>?
              This action cannot be undone and will clear patient references from active chat sessions.
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setPatientToDelete(null)}>Cancel</button>
              <button className="btn btn-error" onClick={deletePatient}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
