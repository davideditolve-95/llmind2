"""
Router per le operazioni di sistema.
Include l'endpoint per il recupero dei log in tempo reale.
"""

from fastapi import APIRouter
from ..services.logs import log_handler

router = APIRouter(prefix="/api/system", tags=["System"])

@router.get("/logs")
async def get_system_logs():
    """
    Restituisce gli ultimi log catturati nel buffer in memoria.
    """
    return {
        "logs": log_handler.get_logs()
    }
