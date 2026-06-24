"""
Modelli SQLAlchemy per i medicinali AIFA e il mapping clinico MEDI-C (ICD-10).
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from ..database import Base


class AIFADrug(Base):
    """
    Rappresenta un medicinale del database AIFA (equivalenti, Classe A, Classe H, ecc.).
    """
    __tablename__ = "aifa_drugs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Principio attivo (es. "Fluoxetina")
    active_ingredient = Column(Text, nullable=False, index=True)
    
    # Codice ATC (es. "N06AB03")
    atc_code = Column(String(20), index=True, nullable=True)
    
    # Codice AIC (codice autorizzazione all'immissione in commercio, es. "034842018")
    aic_code = Column(String(20), index=True, nullable=False)
    
    # Nome commerciale del farmaco (es. "PROZAC" o "FLUOXETINA DOC GENERICI")
    commercial_name = Column(Text, nullable=False, index=True)
    
    # Confezione (es. "20 mg capsule rigide")
    packaging = Column(Text, nullable=True)
    
    # Produttore / Titolare AIC (es. "ELI LILLY ITALIA S.P.A.")
    manufacturer = Column(Text, nullable=True, index=True)
    
    # Prezzo al pubblico (es. 6.10)
    price = Column(Float, nullable=True)
    
    # Classe di rimborsabilità (es. "Classe A", "Classe H", "Equivalenti")
    category_class = Column(String(50), nullable=True, index=True)
    
    # Timestamp di creazione e aggiornamento
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AIFADrug name={self.commercial_name!r} active={self.active_ingredient!r}>"


class DrugIndicationMapping(Base):
    """
    Rappresenta il mapping tra farmaci (da MEDI-C/RxNorm) ed indicazioni cliniche (codici ICD-10).
    """
    __tablename__ = "drug_indication_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Concetto RxNorm (es. "3212")
    rxcui = Column(String(20), index=True, nullable=True)
    
    # Nome del farmaco in inglese da MEDI-C (es. "fluoxetine")
    drug_name = Column(String(255), index=True, nullable=False)
    
    # Codice ICD-10 dell'indicazione (es. "F32.9")
    icd10_code = Column(String(20), index=True, nullable=False)
    
    # Descrizione dell'indicazione clinica (es. "Major depressive disorder, unspecified")
    indication_desc = Column(Text, nullable=True)
    
    # Indica se fa parte dei farmaci ad alta priorità / consenso (es. MEDI1_HPS o MEDI2_HPS è TRUE)
    is_consensus = Column(Boolean, default=False, index=True)
    
    # Timestamp di creazione
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<DrugIndicationMapping drug={self.drug_name!r} icd10={self.icd10_code!r}>"
