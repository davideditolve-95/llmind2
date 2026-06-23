import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from ..database import Base


class DSM5Category(Base):
    """
    Rappresenta una categoria diagnostica o disturbo del DSM-5-TR.
    Include codici DSM-5, definizioni, criteri diagnostici ed equivalenze ICD-11/ICD-10.
    """
    __tablename__ = "dsm5_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Codice diagnostico del DSM-5 (spesso allineato a ICD-9 o ICD-10, es. "314.01" o "299.00")
    code = Column(String(20), index=True, nullable=False)
    
    # Titolo ufficiale in inglese del disturbo
    title = Column(Text, nullable=False)
    
    # Capitolo o gruppo diagnostico del DSM-5 (es. "Neurodevelopmental Disorders")
    chapter = Column(Text, nullable=False, index=True)

    # Gerarchia editoriale DSM-5: capitolo -> famiglia diagnostica -> variante/specifier.
    parent_category = Column(Text, nullable=True, index=True)
    variant_label = Column(Text, nullable=True)
    severity = Column(String(50), nullable=True, index=True)
    sort_order = Column(Integer, nullable=True)
    
    # Criteri diagnostici completi del disturbo (estratti o pre-seeded)
    diagnostic_criteria = Column(Text, nullable=True)

    # Sezioni cliniche descrittive del manuale, estratte dal PDF quando disponibili.
    diagnostic_features = Column(Text, nullable=True)
    prevalence = Column(Text, nullable=True)
    development_and_course = Column(Text, nullable=True)
    risk_and_prognostic_factors = Column(Text, nullable=True)
    culture_related_issues = Column(Text, nullable=True)
    sex_gender_related_issues = Column(Text, nullable=True)
    functional_consequences = Column(Text, nullable=True)
    differential_diagnosis = Column(Text, nullable=True)
    comorbidity = Column(Text, nullable=True)
    
    # Codice ICD-10-CM corrispondente (es. "F84.0")
    icd10_code = Column(String(20), nullable=True)
    
    # Codice di analogia ICD-11 (es. "6A02" per Autism Spectrum Disorder)
    icd11_code = Column(String(20), index=True, nullable=True)

    # Timestamp di creazione e aggiornamento
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DSM5Category code={self.code!r} title={self.title[:30]!r}>"
