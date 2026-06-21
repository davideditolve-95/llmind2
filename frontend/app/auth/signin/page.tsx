'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Signin: 'Impossibile accedere. Verifica le impostazioni del provider.',
    OAuthSignin: 'Errore durante la creazione della richiesta di accesso OIDC.',
    OAuthCallback: "Errore durante l'elaborazione della risposta dal provider.",
    OAuthCreateAccount: "Impossibile creare il profilo utente a partire dal provider.",
    EmailCreateAccount: 'Impossibile creare il profilo utente via email.',
    Callback: 'Errore generico durante il callback di autenticazione.',
    OAuthAccountNotLinked: 'Questo indirizzo email è già associato a un altro metodo di accesso.',
    EmailSignin: 'Il link di accesso via email non è valido o è scaduto.',
    CredentialsSignin: 'Le credenziali fornite non sono valide.',
    default: 'Si è verificato un errore di autenticazione.',
  };

  const errorMessage = error ? errorMessages[error] || errorMessages.default : null;

  return (
    <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-300">
      <div className="card-body items-center text-center p-8 sm:p-12">
        {/* Logo */}
        <div className="grid h-16 w-16 grid-cols-2 gap-1 rounded-xl bg-primary p-2 shadow-md mb-4">
          <span className="rounded-md bg-primary-content" />
          <span className="rounded-md bg-primary-content/70" />
          <span className="rounded-md bg-primary-content/70" />
          <span className="rounded-md bg-primary-content" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-base-content">
          Benvenuto in LLMind2
        </h1>
        <p className="text-sm text-base-content/60 mt-1 mb-8">
          Accedi tramite l'Identity Provider sicuro dell'università
        </p>

        {errorMessage && (
          <div className="alert alert-error text-sm py-3 px-4 rounded-lg mb-6 shadow-sm flex items-start text-left">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="w-full space-y-4">
          <button
            onClick={() => signIn('keycloak', { callbackUrl: '/' })}
            className="btn btn-primary btn-block normal-case shadow-md text-primary-content hover:scale-[1.02] transition-transform"
          >
            Accedi con Keycloak
          </button>
          
          <div className="divider text-xs text-base-content/40 my-6">INFO SECURITY</div>
          
          <p className="text-xs text-base-content/50 leading-relaxed max-w-xs mx-auto">
            Questo portale gestisce dati e benchmark clinici ad uso esclusivo di ricerca accademica. 
            Tutte le sessioni sono tracciate e auditate.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center px-4 relative overflow-hidden bg-base-200 py-12">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

      <Suspense fallback={
        <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-300">
          <div className="card-body items-center text-center p-8 sm:p-12">
            <span className="loading loading-ring loading-lg text-primary"></span>
          </div>
        </div>
      }>
        <SignInContent />
      </Suspense>
    </div>
  );
}
