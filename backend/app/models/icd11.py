"""
Modelli SQLAlchemy per la gerarchia ICD-11.
Rappresenta la struttura ad albero delle categorie diagnostiche.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from ..database import Base


class ICD11Category(Base):
    """
    Nodo della gerarchia ICD-11.
    Struttura ad albero auto-referenziale: ogni categoria può avere un genitore.
    """
    __tablename__ = "icd11_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Codice ICD-11 (es. "6A00" per Disturbo da deficit di attenzione)
    code = Column(String(20), index=True, nullable=True)

    # Titolo in inglese (lingua principale)
    title_en = Column(Text, nullable=False)

    # Titolo in italiano (se disponibile dall'API)
    title_it = Column(Text, nullable=True)

    # Descrizione/definizione della categoria
    description = Column(Text, nullable=True)

    # Livello nella gerarchia (0 = capitolo, 1 = sezione, 2+ = sottocategorie)
    level = Column(Integer, default=0, nullable=False)

    # Relazione auto-referenziale per la struttura ad albero
    parent_id = Column(UUID(as_uuid=True), ForeignKey("icd11_categories.id"), nullable=True, index=True)

    # URI della Foundation WHO (es. "http://id.who.int/icd/entity/12345")
    foundation_uri = Column(Text, nullable=True, unique=True)

    # URI nell'API linearizzata (MMS)
    linearization_uri = Column(Text, nullable=True)

    # Indica se il nodo ha figli (per ottimizzare il rendering 3D)
    has_children = Column(Boolean, default=False)

    # Campi clinici aggiuntivi (Exhaustive Enrichment)
    inclusions = Column(JSONB, nullable=True)
    exclusions = Column(JSONB, nullable=True)
    index_terms = Column(JSONB, nullable=True)
    diagnostic_criteria = Column(Text, nullable=True)
    coding_notes = Column(Text, nullable=True)
    postcoordination_axes = Column(JSONB, nullable=True)
    differential_diagnoses = Column(JSONB, nullable=True)

    # Timestamp di creazione e aggiornamento
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relazioni ORM
    children = relationship("ICD11Category", back_populates="parent", lazy="select")
    parent = relationship("ICD11Category", back_populates="children", remote_side=[id])

    def __repr__(self):
        return f"<ICD11Category code={self.code!r} title={self.title_en[:30]!r}>"
