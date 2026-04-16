"""
Script ETL per l'estrazione e il caricamento dei dati ICD-11 nel database.

USO:
    docker compose exec backend python scripts/extract_icd11_data.py
    docker compose exec backend python scripts/extract_icd11_data.py --max-level 3 --language en

Lo script:
1. Si connette al container ICD-11 offline (icd11-api)
2. Recupera ricorsivamente la gerarchia MMS (Mortality and Morbidity Statistics)
3. Salva ogni nodo nel database PostgreSQL con upsert (non sovrascrive dati esistenti)
"""

import asyncio
import sys
import argparse
import logging
from pathlib import Path

# Aggiunge la directory root al path per i moduli condivisi
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.icd11 import ICD11Category
from app.services.icd11_client import ICD11Client
from app.config import get_settings
from scripts.utils.text_processing import de_stutter, de_stutter_list
import uuid
from datetime import datetime
from simple_icd_11 import ICDExplorer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


async def extract_and_save(max_level: int = 2, language: str = "en"):
    """
    Funzione principale di estrazione ETL.
    
    Args:
        max_level: Profondità massima dell'albero da estrarre (default: 2)
        language: Lingua per i titoli e le descrizioni (default: en)
    """
    client = ICD11Client()
    # Initialize explorer pointing to local container API
    explorer = ICDExplorer(
        language=language, 
        clientId="", 
        clientSecret="", 
        customUrl=f"{settings.icd11_api_url}/"
    )
    db: Session = SessionLocal()
    
    # Crea le tabelle, resettando la cache dei nodi icd-11 se lo schema è cambiato
    ICD11Category.__table__.drop(engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)
    
    logger.info(f"Inizio estrazione dati ICD-11 (livello max: {max_level}, lingua: {language})")
    logger.info(f"Connessione a: {settings.icd11_api_url}")
    
    total_saved = 0
    total_errors = 0
    
    try:
        # Recupera la radice dell'albero MMS
        logger.info("Recupero radice MMS ICD-11...")
        root = await client.get_mms_root(language=language)
        
        if not root:
            logger.error("Impossibile recuperare la radice ICD-11. Verificare che il container icd11-api sia avviato.")
            return
        
        logger.info(f"Radice ICD-11 recuperata: {client.extract_title(root, language)}")
        
        # Se la radice non ha figli ma ha una 'latestRelease', seguila
        # Questo accade perché /icd/release/11/mms è spesso solo un indice di versioni
        if "child" not in root and "browserChild" not in root and "latestRelease" in root:
            latest_uri = root["latestRelease"]
            logger.info(f"Seguo la release più recente: {latest_uri}")
            root = await client.get_entity(latest_uri, language=language)
            if not root:
                logger.error("Impossibile recuperare la release specifica.")
                return
            logger.info(f"Dati release caricati: {client.extract_title(root, language)}")
        
        # Ottieni i capitoli di primo livello (figli della radice)
        chapter_uris = root.get("child", []) or root.get("browserChild", [])
        logger.info(f"Trovati {len(chapter_uris)} capitoli ICD-11 di primo livello")
        
        # Processa ogni capitolo
        for chapter_idx, chapter_uri in enumerate(chapter_uris, 1):
            try:
                logger.info(f"Elaborazione capitolo {chapter_idx}/{len(chapter_uris)}: {chapter_uri}")
                
                chapter_data = await client.get_entity(chapter_uri, language=language)
                if not chapter_data:
                    logger.warning(f"Impossibile recuperare capitolo: {chapter_uri}")
                    continue
                
                # Salva il capitolo (livello 0)
                chapter_node = await save_node(
                    db=db,
                    entity=chapter_data,
                    client=client,
                    explorer=explorer,
                    parent_id=None,
                    level=0,
                    language=language,
                )
                if chapter_node:
                    total_saved += 1
                
                # Processa i figli del capitolo fino alla profondità massima
                if max_level >= 1:
                    children_count = await process_children(
                        db=db,
                        parent_data=chapter_data,
                        parent_id=chapter_node.id if chapter_node else None,
                        client=client,
                        explorer=explorer,
                        current_level=1,
                        max_level=max_level,
                        language=language,
                    )
                    total_saved += children_count
                
                logger.info(f"Capitolo {chapter_idx} completato. Totale salvati: {total_saved}")
                
                # Pausa tra capitoli per non sovraccaricare il container
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Errore elaborazione capitolo {chapter_uri}: {e}")
                total_errors += 1
                continue
    
    except Exception as e:
        logger.error(f"Errore critico durante l'estrazione: {e}")
        raise
    finally:
        db.close()
    
    logger.info(f"\n{'='*50}")
    logger.info(f"ESTRAZIONE COMPLETATA")
    logger.info(f"Nodi salvati: {total_saved}")
    logger.info(f"Errori: {total_errors}")
    logger.info(f"{'='*50}")


async def process_children(
    db: Session,
    parent_data: dict,
    parent_id,
    client: ICD11Client,
    explorer: ICDExplorer,
    current_level: int,
    max_level: int,
    language: str,
) -> int:
    """
    Processa ricorsivamente i figli di un nodo fino alla profondità massima.
    Restituisce il numero di nodi salvati.
    """
    if current_level > max_level:
        return 0
    
    children_uris = parent_data.get("child", [])
    saved_count = 0
    
    # Processa in batch di 5 per limitare richieste concorrenti
    for i in range(0, len(children_uris), 5):
        batch = children_uris[i:i + 5]
        
        for uri in batch:
            try:
                child_data = await client.get_entity(uri, language=language)
                if not child_data:
                    continue
                
                child_node = await save_node(
                    db=db,
                    entity=child_data,
                    client=client,
                    explorer=explorer,
                    parent_id=parent_id,
                    level=current_level,
                    language=language,
                )
                
                if child_node:
                    saved_count += 1
                    
                    # Ricorsione per i livelli successivi
                    if current_level < max_level:
                        sub_count = await process_children(
                            db=db,
                            parent_data=child_data,
                            parent_id=child_node.id,
                            client=client,
                            current_level=current_level + 1,
                            max_level=max_level,
                            explorer=explorer,
                            language=language,
                        )
                        saved_count += sub_count
                        
            except Exception as e:
                logger.debug(f"Errore nodo {uri}: {e}")
                continue
        
        # Pausa breve tra batch
        await asyncio.sleep(0.1)
    
    return saved_count


async def save_node(
    db: Session,
    entity: dict,
    client: ICD11Client,
    explorer: ICDExplorer,
    parent_id,
    level: int,
    language: str,
) -> ICD11Category | None:
    """
    Salva un singolo nodo ICD-11 nel database.
    Usa upsert tramite foundation_uri per evitare duplicati.
    Enrichment tramite simple-icd-11 per criteri diagnostici e postcoordinazione.
    """
    try:
        foundation_uri = client.extract_uri(entity)
        title = de_stutter(client.extract_title(entity, language))
        code = entity.get("code")
        
        # Controlla se il nodo esiste già (upsert basato su URI)
        existing = None
        if foundation_uri:
            existing = db.query(ICD11Category).filter(
                ICD11Category.foundation_uri == foundation_uri
            ).first()
        
        # Se esiste già ed è di livello profondo, potremmo voler saltare per velocità
        # a meno che non manchino i nuovi campi clinici (controllo diagnostic_criteria)
        if existing and existing.diagnostic_criteria is not None and level > 1:
             return existing

        has_children = len(entity.get("child", [])) > 0 or len(entity.get("browserChild", [])) > 0
        
        # Estrai la descrizione (se disponibile)
        description = None
        if "definition" in entity:
            def_data = entity["definition"]
            if isinstance(def_data, dict):
                description = de_stutter(def_data.get("@value", str(def_data)))
            else:
                description = de_stutter(str(def_data))
        
        # Enrichment tramite simple-icd-11
        diagnostic_criteria = None
        index_terms = []
        postcoordination_axes = []
        lib_inclusions = []
        lib_exclusions = []
        
        if code:
            try:
                lib_entity = explorer.getEntityFromCode(code)
                if lib_entity:
                    diagnostic_criteria = de_stutter(lib_entity.getDiagnosticCriteria())
                    index_terms = de_stutter_list(lib_entity.getIndexTerm())
                    lib_inclusions = de_stutter_list(lib_entity.getInclusions())
                    lib_exclusions = de_stutter_list(lib_entity.getExclusions())
                    
                    # Postcoordinazione
                    axes = lib_entity.getPostcoordinationScale()
                    postcoordination_axes = [de_stutter(axis.getAxisName()) for axis in axes]
            except Exception as e:
                logger.debug(f"Lib enrichment error for {code}: {e}")

        # Mix dei dati (API + Library)
        api_inclusions = de_stutter_list(client.extract_list(entity, "inclusion", language))
        api_exclusions = de_stutter_list(client.extract_list(entity, "exclusion", language))
        
        final_inclusions = list(set(api_inclusions + lib_inclusions))
        final_exclusions = list(set(api_exclusions + lib_exclusions))
        
        if existing:
            # Aggiorna il nodo esistente
            existing.title_en = title if language == "en" else existing.title_en
            existing.title_it = title if language == "it" else existing.title_it
            existing.code = code or existing.code
            existing.level = level
            existing.has_children = has_children
            existing.parent_id = parent_id
            existing.description = description or existing.description
            existing.inclusions = final_inclusions if final_inclusions else existing.inclusions
            existing.exclusions = final_exclusions if final_exclusions else existing.exclusions
            existing.index_terms = index_terms if index_terms else existing.index_terms
            existing.diagnostic_criteria = diagnostic_criteria or existing.diagnostic_criteria
            existing.postcoordination_axes = postcoordination_axes if postcoordination_axes else existing.postcoordination_axes
            existing.updated_at = datetime.utcnow()
            node = existing
        else:
            # Crea un nuovo nodo
            node = ICD11Category(
                id=uuid.uuid4(),
                code=code,
                title_en=title if language == "en" else title,
                title_it=title if language == "it" else None,
                description=description,
                inclusions=final_inclusions if final_inclusions else None,
                exclusions=final_exclusions if final_exclusions else None,
                index_terms=index_terms if index_terms else None,
                diagnostic_criteria=diagnostic_criteria,
                postcoordination_axes=postcoordination_axes if postcoordination_axes else None,
                level=level,
                parent_id=parent_id,
                foundation_uri=foundation_uri,
                linearization_uri=entity.get("@id"),
                has_children=has_children,
            )
            db.add(node)
        
        db.commit()
        db.refresh(node)
        return node
        
    except Exception as e:
        db.rollback()
        logger.error(f"Errore salvataggio nodo: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Estrae i dati ICD-11 dal container WHO e li salva nel database"
    )
    parser.add_argument(
        "--max-level",
        type=int,
        default=4,
        help="Profondità massima dell'albero da estrarre (default: 4)",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="en",
        choices=["en", "it", "fr", "es"],
        help="Lingua per i titoli (default: en)",
    )
    
    args = parser.parse_args()
    
    logger.info(f"Script avviato con livello max={args.max_level}, lingua={args.language}")
    asyncio.run(extract_and_save(max_level=args.max_level, language=args.language))


if __name__ == "__main__":
    main()
