#!/usr/bin/env python3
"""Prepare static ICD-11 and DSM-5-TR corpus files for BigQuery ingestion."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Iterable, TextIO


FAMILY_KEYWORDS = [
    ("neurodevelopmental", ["autism", "intellectual", "learning", "adhd", "tic", "communication"]),
    ("schizophrenia_psychotic", ["schizophrenia", "psychotic", "delusional", "catatonia"]),
    ("mood_depressive", ["depressive", "depression", "dysthymic"]),
    ("mood_bipolar", ["bipolar", "mania", "manic", "hypomanic"]),
    ("anxiety_fear", ["anxiety", "panic", "phobia", "separation anxiety", "generalized anxiety"]),
    ("obsessive_compulsive", ["obsessive", "compulsive", "body dysmorphic", "hoarding"]),
    ("trauma_stressor", ["trauma", "posttraumatic", "ptsd", "adjustment"]),
    ("dissociative", ["dissociative", "depersonalization", "derealization", "amnesia"]),
    ("feeding_eating", ["feeding", "eating", "anorexia", "bulimia", "binge"]),
    ("substance_addictive", ["substance", "alcohol", "opioid", "cannabis", "stimulant", "addictive"]),
    ("personality", ["personality"]),
    ("neurocognitive", ["neurocognitive", "delirium", "dementia"]),
    ("sleep_wake", ["sleep", "insomnia", "hypersomnolence", "narcolepsy"]),
    ("sexual_gender", ["sexual", "gender", "paraphilic"]),
]


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("\x00", " ").replace("�", "-")
    return re.sub(r"\s+", " ", value).strip()


def infer_family(text: str) -> str:
    haystack = text.lower()
    for family, keywords in FAMILY_KEYWORDS:
        if any(keyword in haystack for keyword in keywords):
            return family
    return "other_or_mixed"


def token_estimate(text: str) -> int:
    return max(1, len(text.split()))


def chunks(text: str, max_words: int = 220) -> Iterable[str]:
    words = text.split()
    for start in range(0, len(words), max_words):
        yield " ".join(words[start : start + max_words])


def write_row(handle: TextIO, row: dict) -> None:
    handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def stringify_json_list(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return "; ".join(clean_text(str(item)) for item in value if clean_text(str(item)))
    if isinstance(value, tuple):
        return "; ".join(clean_text(str(item)) for item in value if clean_text(str(item)))
    return clean_text(str(value))


def prepare_icd_from_database(repo: Path, out_dir: Path, database_url: str | None) -> tuple[int, int]:
    if not database_url:
        raise RuntimeError("DATABASE_URL is required when --icd-source=db")

    try:
        from sqlalchemy import create_engine, text
    except Exception as exc:  # pragma: no cover - depends on local runtime
        raise RuntimeError("SQLAlchemy is required to export ICD-11 from the application database") from exc

    query = text(
        """
        SELECT
          code,
          title_en,
          title_it,
          description,
          level,
          foundation_uri,
          linearization_uri,
          inclusions,
          exclusions,
          index_terms,
          diagnostic_criteria,
          coding_notes,
          postcoordination_axes,
          differential_diagnoses
        FROM icd11_categories
        WHERE code IS NOT NULL
        ORDER BY level, code, title_en
        """
    )

    rows = 0
    chunk_rows = 0
    engine = create_engine(database_url, pool_pre_ping=True)

    with engine.connect() as connection, \
        (out_dir / "icd11_categories.jsonl").open("w", encoding="utf-8") as categories_out, \
        (out_dir / "agent_corpus_chunks.icd11.jsonl").open("w", encoding="utf-8") as chunks_out:
        for row in connection.execute(query).mappings():
            code = clean_text(row.get("code"))
            name = clean_text(row.get("title_en"))
            if not code or not name:
                continue

            description = clean_text(row.get("description"))
            clinical_text_parts = [
                description,
                clean_text(row.get("diagnostic_criteria")),
                stringify_json_list(row.get("inclusions")),
                stringify_json_list(row.get("exclusions")),
                stringify_json_list(row.get("index_terms")),
                clean_text(row.get("coding_notes")),
                stringify_json_list(row.get("postcoordination_axes")),
                stringify_json_list(row.get("differential_diagnoses")),
            ]
            clinical_text = clean_text(" ".join(part for part in clinical_text_parts if part))
            search_text = clean_text(f"{code} {name} {clinical_text}")
            code_prefix = code[:3]
            chapter_code = code[:2]
            family = infer_family(search_text)

            write_row(
                categories_out,
                {
                    "source_system": "ICD-11",
                    "corpus_version": "ICD-11-API-DB-static",
                    "code": code,
                    "code_prefix": code_prefix,
                    "chapter_code": chapter_code,
                    "name": name,
                    "diagnostic_family": family,
                    "description": clinical_text,
                    "search_text": search_text,
                    "source_file": "backend database table icd11_categories populated by backend/scripts/extract_icd11_data.py",
                },
            )
            rows += 1

            for index, chunk in enumerate(chunks(clinical_text or name)):
                write_row(
                    chunks_out,
                    {
                        "corpus": "icd11-api-db",
                        "corpus_version": "ICD-11-API-DB-static",
                        "record_id": code,
                        "chunk_id": f"icd11-{code}-{index:03d}",
                        "section": "api_enriched_category",
                        "code": code,
                        "case_number": None,
                        "diagnostic_family": family,
                        "title": name,
                        "text": chunk,
                        "token_estimate": token_estimate(chunk),
                        "source_file": "backend database table icd11_categories",
                    },
                )
                chunk_rows += 1

    return (rows, chunk_rows)


def prepare_icd_from_legacy_csv(repo: Path, out_dir: Path) -> tuple[int, int]:
    source = repo / "backend" / "data" / "original_docs" / "ICD-11_filtered.csv"
    if not source.exists():
        raise RuntimeError(f"Legacy ICD CSV not found: {source}")
    rows = 0
    chunk_rows = 0

    with source.open(newline="", encoding="utf-8", errors="replace") as handle, \
        (out_dir / "icd11_categories.jsonl").open("w", encoding="utf-8") as categories_out, \
        (out_dir / "agent_corpus_chunks.icd11.jsonl").open("w", encoding="utf-8") as chunks_out:
        reader = csv.DictReader(handle)
        for row in reader:
            code = clean_text(row.get("code"))
            name = clean_text(row.get("name"))
            description = clean_text(row.get("prompt"))
            if not code or not name:
                continue
            code_prefix = code[:3]
            chapter_code = code[:2]
            family = infer_family(f"{name} {description}")
            search_text = clean_text(f"{code} {name} {description}")
            write_row(
                categories_out,
                {
                    "source_system": "ICD-11",
                    "corpus_version": "ICD-11-legacy-csv-fallback",
                    "code": code,
                    "code_prefix": code_prefix,
                    "chapter_code": chapter_code,
                    "name": name,
                    "diagnostic_family": family,
                    "description": description,
                    "search_text": search_text,
                    "source_file": "backend/data/original_docs/ICD-11_filtered.csv legacy fallback",
                },
            )
            rows += 1
            for index, chunk in enumerate(chunks(description)):
                write_row(
                    chunks_out,
                    {
                        "corpus": "icd11-legacy-csv",
                        "corpus_version": "ICD-11-legacy-csv-fallback",
                        "record_id": code,
                        "chunk_id": f"icd11-{code}-{index:03d}",
                        "section": "diagnostic_requirements",
                        "code": code,
                        "case_number": None,
                        "diagnostic_family": family,
                        "title": name,
                        "text": chunk,
                        "token_estimate": token_estimate(chunk),
                        "source_file": "backend/data/original_docs/ICD-11_filtered.csv legacy fallback",
                    },
                )
                chunk_rows += 1

    return (rows, chunk_rows)


def prepare_icd(repo: Path, out_dir: Path, icd_source: str, database_url: str | None) -> tuple[int, int]:
    if icd_source == "db":
        return prepare_icd_from_database(repo, out_dir, database_url)
    if icd_source == "legacy-csv":
        return prepare_icd_from_legacy_csv(repo, out_dir)
    try:
        return prepare_icd_from_database(repo, out_dir, database_url)
    except Exception as exc:
        print(f"WARNING: ICD-11 database export failed: {exc}")
        print("WARNING: Falling back to legacy CSV only because --icd-source=auto was selected.")
        return prepare_icd_from_legacy_csv(repo, out_dir)


def prepare_dsm(repo: Path, out_dir: Path) -> tuple[int, int]:
    source = repo / "backend" / "data" / "original_docs" / "DSM-5-TR_Clinical_Cases_splitted.csv"
    rows = 0
    chunk_rows = 0

    with source.open(newline="", encoding="utf-8", errors="replace") as handle, \
        (out_dir / "dsm5_cases.jsonl").open("w", encoding="utf-8") as cases_out, \
        (out_dir / "agent_corpus_chunks.dsm5.jsonl").open("w", encoding="utf-8") as chunks_out:
        reader = csv.DictReader(handle, delimiter="§")
        for row in reader:
            case_number_raw = clean_text(row.get("Case_Number"))
            if not case_number_raw:
                continue
            case_number = int(case_number_raw)
            introduction = clean_text(row.get("Introduction"))
            discussion = clean_text(row.get("Discussion"))
            diagnosis = clean_text(row.get("Diagnosis"))
            family = infer_family(diagnosis or discussion or introduction)
            diagnosis_hash = hashlib.sha256(diagnosis.encode("utf-8")).hexdigest()[:16]
            write_row(
                cases_out,
                {
                    "source_system": "DSM-5-TR",
                    "corpus_version": "DSM-5-TR-clinical-cases-static-extract",
                    "case_number": case_number,
                    "primary_diagnostic_family": family,
                    "diagnosis_hash": diagnosis_hash,
                    "has_suggested_readings": "suggested reading" in diagnosis.lower(),
                    "introduction": introduction,
                    "discussion": discussion,
                    "diagnosis": diagnosis,
                    "source_file": "backend/data/original_docs/DSM-5-TR_Clinical_Cases_splitted.csv",
                },
            )
            rows += 1
            sections = {
                "introduction": introduction,
                "discussion": discussion,
                "diagnosis": diagnosis,
            }
            for section, text in sections.items():
                for index, chunk in enumerate(chunks(text)):
                    write_row(
                        chunks_out,
                        {
                            "corpus": "dsm5-clinical-cases",
                            "corpus_version": "DSM-5-TR-clinical-cases-static-extract",
                            "record_id": f"case-{case_number}",
                            "chunk_id": f"dsm5-case-{case_number}-{section}-{index:03d}",
                            "section": section,
                            "code": None,
                            "case_number": case_number,
                            "diagnostic_family": family,
                            "title": f"DSM-5-TR Clinical Case {case_number}",
                            "text": chunk,
                            "token_estimate": token_estimate(chunk),
                            "source_file": "backend/data/original_docs/DSM-5-TR_Clinical_Cases_splitted.csv",
                        },
                    )
                    chunk_rows += 1

    return (rows, chunk_rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=Path(__file__).resolve().parents[2], type=Path)
    parser.add_argument("--out", default=None, type=Path)
    parser.add_argument(
        "--icd-source",
        choices=["db", "auto", "legacy-csv"],
        default="db",
        help="ICD-11 source. Use db for the current API-extracted PostgreSQL table. legacy-csv is only for local fallback.",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="Database URL for icd11_categories. Defaults to DATABASE_URL.",
    )
    args = parser.parse_args()

    repo = args.repo.resolve()
    out_dir = args.out or repo / "gcp-conversational-agents" / "generated" / "bigquery"
    out_dir.mkdir(parents=True, exist_ok=True)

    icd_count, icd_chunks = prepare_icd(repo, out_dir, args.icd_source, args.database_url)
    dsm_count, dsm_chunks = prepare_dsm(repo, out_dir)

    combined_chunks = out_dir / "agent_corpus_chunks.jsonl"
    with combined_chunks.open("w", encoding="utf-8") as target:
        for source_name in ("agent_corpus_chunks.icd11.jsonl", "agent_corpus_chunks.dsm5.jsonl"):
            with (out_dir / source_name).open("r", encoding="utf-8") as source:
                for line in source:
                    target.write(line)

    print(f"wrote {icd_count} ICD-11 category rows")
    print(f"wrote {dsm_count} DSM-5-TR case rows")
    print(f"wrote {icd_chunks + dsm_chunks} agent corpus chunks")
    print(out_dir)


if __name__ == "__main__":
    main()
