"""
Modello database SQLAlchemy per la gestione dei Pazienti.
Permette l'associazione a un utente proprietario e la memorizzazione dei tratti clinici.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from ..database import Base


class Patient(Base):
    """
    Rappresenta un Paziente nel sistema.
    Ogni paziente è di proprietà di un operatore (identificato dall'email OIDC).
    """
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Email dell'operatore che possiede il paziente (isolamento account)
    owner_email = Column(String(100), nullable=False, index=True)
    
    # Dati anagrafici
    name = Column(String(200), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(50), nullable=True)
    
    # Informazioni cliniche
    behaviors = Column(Text, nullable=True)
    specific_traits = Column(Text, nullable=True)
    clinical_history = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Patient name={self.name!r} owner={self.owner_email!r}>"
