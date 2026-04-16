"""
Servizio per il calcolo della similarità semantica.
Usa sentence-transformers per calcolare la similarità coseno tra testi clinici.
"""

import logging
import numpy as np
from typing import Optional
from functools import lru_cache
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache(maxsize=1)
def get_embedding_model():
    """
    Carica il modello di embedding con cache (caricato una sola volta).
    Usa il modello sentence-transformers configurato nelle impostazioni.
    """
    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Caricamento modello embedding: {settings.embedding_model}")
        model = SentenceTransformer(settings.embedding_model)
        logger.info("Modello embedding caricato con successo")
        return model
    except Exception as e:
        logger.error(f"Impossibile caricare il modello embedding: {e}")
        return None


class EmbeddingService:
    """
    Servizio per calcolare embedding e similarità semantica tra testi.
    Utilizzato principalmente per confrontare le diagnosi LLM con il Gold Standard.
    """

    def get_embedding(self, text: str) -> Optional[np.ndarray]:
        """
        Calcola l'embedding vettoriale di un testo.
        Restituisce un array numpy o None in caso di errore.
        """
        model = get_embedding_model()
        if model is None:
            return None
        try:
            embedding = model.encode(text, show_progress_bar=False, normalize_embeddings=True)
            return embedding
        except Exception as e:
            logger.error(f"Errore calcolo embedding: {e}")
            return None

    def compute_cosine_similarity(self, text_a: str, text_b: str) -> Optional[float]:
        """
        Calcola la similarità coseno tra due testi tramite i loro embedding.

        Args:
            text_a: Primo testo (es. risposta LLM)
            text_b: Secondo testo (es. Gold Standard Diagnosis)

        Returns:
            Valore float tra 0.0 e 1.0, o None se il calcolo non è possibile.
            1.0 = testi identici, 0.0 = testi completamente diversi.
        """
        if not text_a or not text_b:
            logger.warning("Testo vuoto passato per il calcolo della similarità")
            return None

        emb_a = self.get_embedding(text_a)
        emb_b = self.get_embedding(text_b)

        if emb_a is None or emb_b is None:
            return None

        try:
            # Similarità coseno: prodotto scalare di vettori normalizzati
            similarity = float(np.dot(emb_a, emb_b))
            # Garantisce il range [0, 1] — in teoria già nel range con vettori normalizzati
            return max(0.0, min(1.0, similarity))
        except Exception as e:
            logger.error(f"Errore calcolo similarità coseno: {e}")
            return None

    def compute_similarity_batch(
        self,
        responses: list[str],
        gold_standard: str,
    ) -> list[Optional[float]]:
        """
        Calcola la similarità coseno di un batch di risposte rispetto al Gold Standard.
        Più efficiente del calcolo singolo perché usa l'encoding batch.

        Args:
            responses: Lista di risposte LLM da confrontare
            gold_standard: Diagnosi Gold Standard di riferimento

        Returns:
            Lista di float (o None per risposte vuote) nello stesso ordine dell'input.
        """
        model = get_embedding_model()
        if model is None:
            return [None] * len(responses)

        # Filtra le risposte valide
        valid_indices = [i for i, r in enumerate(responses) if r and r.strip()]
        valid_texts = [responses[i] for i in valid_indices]

        if not valid_texts:
            return [None] * len(responses)

        try:
            # Encoding batch efficiente
            all_texts = valid_texts + [gold_standard]
            embeddings = model.encode(all_texts, show_progress_bar=False, normalize_embeddings=True)

            gold_emb = embeddings[-1]
            response_embs = embeddings[:-1]

            # Calcola similarità per ogni risposta valida
            scores = [float(np.dot(emb, gold_emb)) for emb in response_embs]

            # Ricombina con None per le risposte vuote
            result = [None] * len(responses)
            for idx, score in zip(valid_indices, scores):
                result[idx] = max(0.0, min(1.0, score))

            return result
        except Exception as e:
            logger.error(f"Errore calcolo similarità batch: {e}")
            return [None] * len(responses)


# Istanza singleton del servizio
embedding_service = EmbeddingService()
