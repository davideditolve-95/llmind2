'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import en from './en.json';
import it from './it.json';

// Tipi per il sistema i18n
export type Language = 'en' | 'it';
export type Translations = typeof en;

// Tipo per accedere alle chiavi annidate tramite notazione con punto (es. "nav.home")
type NestedKeyOf<T extends object> = {
  [K in keyof T & string]: T[K] extends object
    ? `${K}.${NestedKeyOf<T[K] & object>}`
    : K;
}[keyof T & string];

type TranslationKey = NestedKeyOf<Translations>;

// Dizionario delle traduzioni
const translations: Record<Language, Translations> = { en, it };

// Interfaccia del contesto
interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, fallback?: string) => string;
}

// Creazione del contesto con valori predefiniti
const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

/**
 * Provider del sistema di internazionalizzazione.
 * Wrappa l'intera applicazione e fornisce la funzione t() per le traduzioni.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    // Persiste la preferenza lingua nel localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('llmind_lang', newLang);
    }
  }, []);

  /**
   * Funzione di traduzione che accetta chiavi annidate con notazione punto.
   * Esempio: t('nav.home') → "3D Explorer" (in inglese)
   */
  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      const keys = key.split('.');
      let current: unknown = translations[lang];

      for (const k of keys) {
        if (current && typeof current === 'object' && k in (current as object)) {
          current = (current as Record<string, unknown>)[k];
        } else {
          // Fallback alla lingua inglese se la chiave non esiste
          let englishCurrent: unknown = translations['en'];
          for (const ek of keys) {
            if (englishCurrent && typeof englishCurrent === 'object') {
              englishCurrent = (englishCurrent as Record<string, unknown>)[ek];
            }
          }
          return typeof englishCurrent === 'string' ? englishCurrent : (fallback ?? key);
        }
      }

      return typeof current === 'string' ? current : (fallback ?? key);
    },
    [lang]
  );

  // Carica la preferenza lingua dal localStorage al mount
  React.useEffect(() => {
    const stored = localStorage.getItem('llmind_lang') as Language | null;
    if (stored && (stored === 'en' || stored === 'it')) {
      setLangState(stored);
    }
  }, []);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook per accedere alle traduzioni in qualsiasi componente.
 * Uso: const { t, lang, setLang } = useI18n();
 */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n deve essere usato dentro un I18nProvider');
  }
  return context;
}
