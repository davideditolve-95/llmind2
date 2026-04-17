"""
Servizio per la cattura e la gestione dei log dell'applicazione in memoria.
Permette al frontend di visualizzare la console in tempo reale.
"""

import logging
from collections import deque
from datetime import datetime

class LogBufferHandler(logging.Handler):
    """
    Handler custom che salva gli ultimi N log in un buffer circolare.
    """
    def __init__(self, capacity=1000):
        super().__init__()
        self.buffer = deque(maxlen=capacity)

    def emit(self, record):
        try:
            msg = self.format(record)
            timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
            self.buffer.append({
                "timestamp": timestamp,
                "level": record.levelname,
                "name": record.name,
                "message": msg
            })
        except Exception:
            self.handleError(record)

    def get_logs(self):
        return list(self.buffer)

# Istanza globale dell'handler
log_handler = LogBufferHandler()
log_handler.setFormatter(logging.Formatter('%(message)s'))
