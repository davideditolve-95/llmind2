"""
Modelli SQLAlchemy per il modulo di benchmarking universitario.
Gestisce casi clinici DSM-5-TR, esecuzioni multi-modello e valutazioni.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class DSM5Case(Base):
    """
    Caso clinico estratto dal manuale DSM-5-TR (Barnhill).
    Strutturato nelle 3 sezioni fondamentali per il benchmarking.
    """
    __tablename__ = "dsm5_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identificativo del caso (es. "Case 1.1", "Case 3.4")
    case_number = Column(String(50), nullable=True, index=True)

    # Titolo del caso clinico
    title = Column(Text, nullable=False)

    # ─── Tre sezioni fondamentali ─────────────────────────────────────────
    # Sezione 1: Anamnesi e presentazione clinica del paziente
    anamnesis = Column(Text, nullable=False, default="")

    # Sezione 2: Discussione clinica e ragionamento diagnostico
    discussion = Column(Text, nullable=False, default="")

    # Sezione 3: Diagnosi Gold Standard (ground truth per il benchmarking)
    gold_standard_diagnosis = Column(Text, nullable=False, default="")
    # ─────────────────────────────────────────────────────────────────────

    # Pagina di riferimento nel PDF originale
    source_page = Column(Integer, nullable=True)

    # Flag: indica se il caso è stato verificato/corretto manualmente
    is_reviewed = Column(Boolean, default=False, nullable=False)

    # Note del ricercatore sulla qualità dell'estrazione
    review_notes = Column(Text, nullable=True)

    # Tag ICD-11 associati manualmente (JSON array come stringa)
    icd11_tags = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relazione con le esecuzioni di benchmark
    benchmark_runs = relationship("BenchmarkRun", back_populates="case", lazy="select")

    def __repr__(self):
        return f"<DSM5Case case_number={self.case_number!r} title={self.title[:30]!r}>"


class BenchmarkRun(Base):
    """
    Singola esecuzione di inferenza LLM su un caso clinico.
    Registra l'output del modello, i punteggi di similarità e la valutazione umana.
    """
    __tablename__ = "benchmark_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Riferimento al caso clinico
    case_id = Column(UUID(as_uuid=True), ForeignKey("dsm5_cases.id"), nullable=False, index=True)

    # Modello Ollama utilizzato (es. "gemma4", "llama3", "mistral")
    model_name = Column(String(100), nullable=False, index=True)

    # Identificativo del batch (per raggruppare i run di una stessa richiesta)
    batch_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Prompt completo inviato al modello
    prompt_used = Column(Text, nullable=False)
    
    # System prompt specifico utilizzato
    system_prompt_used = Column(Text, nullable=True)

    # Risposta grezza del modello LLM
    llm_response = Column(Text, nullable=True)

    # ─── Metriche automatiche ─────────────────────────────────────────────
    # Similarità coseno tra embedding della risposta e del Gold Standard (0–1)
    similarity_score = Column(Float, nullable=True)

    # Punteggio LLM-as-judge (opzionale, da un secondo modello)
    llm_judge_score = Column(Float, nullable=True)

    # Latenza dell'inferenza in millisecondi
    latency_ms = Column(Integer, nullable=True)
    # ─────────────────────────────────────────────────────────────────────

    # Valutazioni umane (multi-valutazione nominale)
    evaluations = relationship("ManualEvaluation", back_populates="run", cascade="all, delete-orphan")

    # Configurazione dell'esecuzione
    include_discussion = Column(Boolean, default=False)
    prompt_language = Column(String(10), default="en")

    # Stato dell'esecuzione
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relazione con il caso
    case = relationship("DSM5Case", back_populates="benchmark_runs")

    def __repr__(self):
        return f"<BenchmarkRun model={self.model_name!r} case_id={self.case_id!r} score={self.similarity_score}>"


class ManualEvaluation(Base):
    """
    Rappresenta una singola valutazione manuale assegnata a un BenchmarkRun.
    Supporta la valutazione su più dimensioni nominandole singolarmente (es. "Clinical Accuracy", "Dr. Rossi").
    """
    __tablename__ = "manual_evaluations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("benchmark_runs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Nome del valutatore o del criterio (es. "Psychologist A", "Empathy")
    evaluator_name = Column(String(100), nullable=False)

    # Punteggio assegnato (es. da 1 a 5)
    rating = Column(Integer, nullable=False)

    # Note aggiuntive
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("BenchmarkRun", back_populates="evaluations")
