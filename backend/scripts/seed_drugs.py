"""
Script ETL per il download, parsing e caricamento dei farmaci AIFA e del mapping MEDI-C.
Genera inoltre il file di testo strutturato per il datastore RAG.

USO:
    docker compose exec backend python scripts/seed_drugs.py
"""

import os
import sys
import csv
import ssl
import urllib.request
import logging
from pathlib import Path
from datetime import datetime

# Aggiunge la directory root al path per i moduli condivisi
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text
from app.database import SessionLocal, engine, Base
from app.models.drugs import AIFADrug, DrugIndicationMapping
from app.routers.drugs import map_english_drug_to_italian
from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()

# Cartelle per la memorizzazione dei dati
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
CACHE_DIR = DATA_DIR / "cache"
DOCS_DIR = DATA_DIR / "original_docs"

CACHE_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# Context SSL per bypassare errori di certificato locali su Mac
ctx = ssl._create_unverified_context()


def download_file(url: str, dest_path: Path):
    """Scarica un file da un URL salvandolo nel percorso specificato, usando cache se disponibile."""
    if dest_path.exists() and dest_path.stat().st_size > 100000:
        logger.info(f"File caricato da cache locale: {dest_path.name}")
        return

    logger.info(f"Download di {url} in corso...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=60.0) as response:
            content = response.read()
        with open(dest_path, "wb") as f:
            f.write(content)
        logger.info(f"Salvataggio completato: {dest_path.name} ({len(content)} byte)")
    except Exception as e:
        logger.error(f"Errore durante il download di {url}: {e}")
        raise


def seed_database():
    """Funzione principale ETL per il caricamento dei farmaci e dei mapping."""
    logger.info("--- INIZIO SEEDING MEDICINALI AIFA & MAPPING MEDI-C ---")
    
    # 1. Definizione URL dei file
    urls = {
        "aifa_equivalenti": "https://www.aifa.gov.it/documents/20142/825643/Lista_farmaci_equivalenti.csv",
        "aifa_classe_a_principio": "https://www.aifa.gov.it/documents/20142/3789005/Classe_A_per_principio_attivo_31-12-2025.csv",
        "aifa_classe_a_commerciale": "https://www.aifa.gov.it/documents/20142/3789005/Classe_A_per_nome_commerciale_31-12-2025.csv",
        "aifa_classe_h_principio": "https://www.aifa.gov.it/documents/20142/3789005/Classe_H_per_principio_attivo_31-12-2025.csv",
        "aifa_classe_h_commerciale": "https://www.aifa.gov.it/documents/20142/3789005/Classe_H_per_nome_commerciale_31-12-2025.csv",
        "medi_c": "https://www.vumc.org/wei-lab/sites/default/files/public_files/MEDI-C.csv"
    }

    paths = {k: CACHE_DIR / f"{k}.csv" for k in urls}

    # Scarica tutti i file
    for key, url in urls.items():
        try:
            download_file(url, paths[key])
        except Exception:
            logger.warning(f"Impossibile scaricare {key}. Lo script proverà ad usare file esistenti.")

    db: Session = SessionLocal()
    
    try:
        # Svuota le tabelle esistenti per il refresh completo
        logger.info("Pulizia tabelle esistenti...")
        db.execute(text("TRUNCATE TABLE aifa_drugs CASCADE"))
        db.execute(text("TRUNCATE TABLE drug_indication_mappings CASCADE"))
        db.commit()

        # 2. Parsing e caricamento farmaci AIFA
        logger.info("Importazione farmaci AIFA in corso...")
        drugs_to_insert = []
        seen_aic = set()

        # 2a. Equivalenti
        eq_path = paths["aifa_equivalenti"]
        if eq_path.exists():
            logger.info("Elaborazione Lista Farmaci Equivalenti...")
            with open(eq_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f, delimiter=";")
                header = next(reader)
                for row in reader:
                    if len(row) >= 7 and row[3].strip(): # AIC presente
                        aic = row[3].strip()
                        if aic in seen_aic:
                            continue
                        seen_aic.add(aic)
                        
                        price_str = row[7].replace(",", ".").replace(" ", "").strip()
                        try:
                            price = float(price_str)
                        except ValueError:
                            price = 0.0
                            
                        drugs_to_insert.append({
                            "active_ingredient": row[0].strip(),
                            "atc_code": row[2].strip() if len(row) > 2 else None,
                            "aic_code": aic,
                            "commercial_name": row[4].strip(),
                            "packaging": row[5].strip() if len(row) > 5 else None,
                            "manufacturer": row[6].strip() if len(row) > 6 else None,
                            "price": price,
                            "category_class": "Equivalenti"
                        })

        # 2b. Classe A (commerciale)
        ca_path = paths["aifa_classe_a_commerciale"]
        if ca_path.exists():
            logger.info("Elaborazione Classe A...")
            with open(ca_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f, delimiter=";")
                header = next(reader)
                for row in reader:
                    if len(row) >= 6 and row[5].strip():
                        aic = row[5].strip().zfill(9) # Alcune AIC sono senza zeri iniziali
                        if aic in seen_aic:
                            continue
                        seen_aic.add(aic)
                        
                        price_str = row[3].replace(",", ".").replace(" ", "").strip()
                        try:
                            price = float(price_str)
                        except ValueError:
                            price = 0.0

                        drugs_to_insert.append({
                            "active_ingredient": row[0].strip(),
                            "atc_code": None, # Non fornito in questa lista
                            "aic_code": aic,
                            "commercial_name": row[2].strip(),
                            "packaging": row[1].strip() if len(row) > 1 else None,
                            "manufacturer": row[4].strip() if len(row) > 4 else None,
                            "price": price,
                            "category_class": "Classe A"
                        })

        # 2c. Classe H (commerciale)
        ch_path = paths["aifa_classe_h_commerciale"]
        if ch_path.exists():
            logger.info("Elaborazione Classe H...")
            with open(ch_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f, delimiter=";")
                header = next(reader)
                for row in reader:
                    if len(row) >= 6 and row[5].strip():
                        aic = row[5].strip().zfill(9)
                        if aic in seen_aic:
                            continue
                        seen_aic.add(aic)
                        
                        price_str = row[3].replace(",", ".").replace(" ", "").strip()
                        try:
                            price = float(price_str)
                        except ValueError:
                            price = 0.0

                        drugs_to_insert.append({
                            "active_ingredient": row[0].strip(),
                            "atc_code": None,
                            "aic_code": aic,
                            "commercial_name": row[2].strip(),
                            "packaging": row[1].strip() if len(row) > 1 else None,
                            "manufacturer": row[4].strip() if len(row) > 4 else None,
                            "price": price,
                            "category_class": "Classe H"
                        })

        # Inserimento bulk farmaci AIFA
        logger.info(f"Inserimento di {len(drugs_to_insert)} farmaci commerciali nel database...")
        batch_size = 5000
        for i in range(0, len(drugs_to_insert), batch_size):
            batch = drugs_to_insert[i:i + batch_size]
            db.bulk_insert_mappings(AIFADrug, batch)
        db.commit()
        logger.info("Importazione farmaci completata con successo.")

        # 3. Importazione mapping MEDI-C
        medi_path = paths["medi_c"]
        if medi_path.exists():
            logger.info("Elaborazione mapping MEDI-C.csv (Vanderbilt)...")
            mappings_to_insert = []
            
            with open(medi_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                header = next(reader) # RXCUI, DRUG_DESC, SAB, CODE, INDICATION_DESC, MEDI1, MEDI1_HPS, ...
                
                for row in reader:
                    if len(row) >= 9:
                        # Consideriamo solo indicazioni ICD-10 (SAB == ICD10CM o simili)
                        sab = row[2].strip().upper()
                        if "ICD10" in sab:
                            is_consensus = row[6].strip().upper() == "TRUE" or row[8].strip().upper() == "TRUE"
                            
                            mappings_to_insert.append({
                                "rxcui": row[0].strip(),
                                "drug_name": row[1].strip(),
                                "icd10_code": row[3].strip(),
                                "indication_desc": row[4].strip(),
                                "is_consensus": is_consensus
                            })

            logger.info(f"Inserimento di {len(mappings_to_insert)} righe di mapping MEDI-C...")
            for i in range(0, len(mappings_to_insert), batch_size):
                batch = mappings_to_insert[i:i + batch_size]
                db.bulk_insert_mappings(DrugIndicationMapping, batch)
            db.commit()
            logger.info("Importazione mapping MEDI-C completata con successo.")

        # 4. Generazione del file aifa_drugs_indications.txt per RAG
        logger.info("Generazione del file di testo strutturato per il datastore RAG...")
        
        # Recupera tutti i principi attivi inseriti
        unique_ingredients = db.query(AIFADrug.active_ingredient).distinct().all()
        unique_ingredients = [ing[0] for ing in unique_ingredients]
        
        rag_file_path = DOCS_DIR / "aifa_drugs_indications.txt"
        
        with open(rag_file_path, "w", encoding="utf-8") as f:
            f.write("# REGISTRO DEI MEDICINALI ITALIANI (AIFA) & INDICAZIONI CLINICHE (MEDI-C)\n")
            f.write("Questo documento contiene l'archivio strutturato dei principi attivi e dei farmaci commerciali italiani dell'AIFA, mappati con le loro indicazioni terapeutiche basate sullo standard ICD-10.\n\n")
            f.write("Ad uso esclusivo di ricerca accademica e informatica clinica. Il software non è un medico.\n\n")
            
            logger.info(f"Scrittura RAG per {len(unique_ingredients)} principi attivi...")
            
            for ing in sorted(unique_ingredients):
                # 1. Recupera dettagli farmaco commerciale
                sample_drugs = db.query(AIFADrug).filter(AIFADrug.active_ingredient == ing).limit(5).all()
                if not sample_drugs:
                    continue
                
                atc = next((d.atc_code for d in sample_drugs if d.atc_code), "Non specificato")
                classes = list(set(d.category_class for d in sample_drugs if d.category_class))
                
                f.write(f"## PRINCIPIO ATTIVO: {ing.upper()}\n")
                f.write(f"- Codice ATC: {atc}\n")
                f.write(f"- Classi di rimborsabilità AIFA: {', '.join(classes)}\n")
                
                # 2. Ottieni indicazioni MEDI-C
                # Traduciamo l'ingrediente in inglese per mappare sul MEDI-C
                # Facciamo una query inversa o proviamo a allineare
                # Cerchiamo nel MEDI-C i farmaci che tradotti corrispondono a questo principio
                # Per farlo in modo efficiente ed evitare query pesanti per ogni riga, possiamo fare un allineamento semantico o usare i farmaci noti.
                # Cerchiamo farmaci MEDI-C che tradotti con la nostra funzione danno 'ing'
                # (per semplicità in questo script di seed, cerchiamo corrispondenze esatte o con suffissi nel MEDI-C)
                
                # Cerchiamo i farmaci in inglese che corrispondono a questo ingrediente italiano
                # (es. 'fluoxetina' corrisponde a 'fluoxetine')
                eng_candidates = []
                # Proviamo la traduzione inversa o l'allineamento
                # In inglese di solito finiscono in -ine, -olol, -ate, -ide, etc.
                if ing.endswith("ina"):
                    eng_candidates.append(ing[:-3] + "ine")
                elif ing.endswith("olo"):
                    eng_candidates.append(ing[:-3] + "olol")
                    eng_candidates.append(ing[:-3] + "ole")
                elif ing.endswith("ato"):
                    eng_candidates.append(ing[:-3] + "ate")
                elif ing.endswith("ido"):
                    eng_candidates.append(ing[:-3] + "ide")
                elif ing.endswith("ico"):
                    eng_candidates.append(ing[:-3] + "ic")
                elif ing.endswith("io"):
                    eng_candidates.append(ing[:-3] + "ium")
                eng_candidates.append(ing) # Aggiungiamo esatto
                
                # Cerca indicazioni
                indications = (
                    db.query(DrugIndicationMapping)
                    .filter(
                        or_(
                            func.lower(DrugIndicationMapping.drug_name).in_([c.lower() for c in eng_candidates]),
                            # Anche ricerca parziale per sicurezza
                            func.lower(DrugIndicationMapping.drug_name).like(f"%{ing.lower()}%")
                        )
                    )
                    .limit(10)
                    .all()
                )
                
                f.write("- Indicazioni terapeutiche associate (ICD-10):\n")
                if indications:
                    # Raggruppa per codice ICD-10
                    seen_ind = set()
                    for ind in indications:
                        ind_str = f"  * {ind.icd10_code} - {ind.indication_desc} (Consenso clinico: {'Sì' if ind.is_consensus else 'No'})"
                        if ind_str not in seen_ind:
                            f.write(f"{ind_str}\n")
                            seen_ind.add(ind_str)
                else:
                    f.write("  * Nessuna indicazione codificata trovata nel database MEDI-C.\n")
                
                # 3. Esempi commerciali
                f.write("- Esempi di confezioni commerciali in Italia (AIFA):\n")
                for d in sample_drugs:
                    packaging_info = f" ({d.packaging})" if d.packaging else ""
                    price_info = f" - Prezzo: {d.price:.2f} €" if d.price else ""
                    f.write(f"  * {d.commercial_name} (AIC: {d.aic_code}) - {d.manufacturer or 'Produttore N.D.'}{packaging_info}{price_info} [{d.category_class}]\n")
                
                f.write("\n" + "="*80 + "\n\n")

        logger.info(f"File RAG generato correttamente: {rag_file_path} ({rag_file_path.stat().st_size} byte)")

    except Exception as e:
        db.rollback()
        logger.error(f"Errore critico durante il seeding: {e}")
        raise
    finally:
        db.close()

    logger.info("--- SEEDING COMPLETATO CON SUCCESSO ---")


if __name__ == "__main__":
    seed_database()
