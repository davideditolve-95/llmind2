#!/usr/bin/env python3
"""
Regenera le sezioni numeriche dinamiche dei paper LLMind2.

Uso tipico:
  python3 paper/scripts/update_dynamic_sections.py
  python3 paper/scripts/update_dynamic_sections.py --compile

Lo script aggiorna solo i blocchi delimitati dai marker:
  % BEGIN_DYNAMIC_ARTIFACT_SNAPSHOT_IT / % END_DYNAMIC_ARTIFACT_SNAPSHOT_IT
  % BEGIN_DYNAMIC_ARTIFACT_SNAPSHOT_EN / % END_DYNAMIC_ARTIFACT_SNAPSHOT_EN
"""

from __future__ import annotations

import argparse
import subprocess
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
PAPER_DIR = REPO_ROOT / "paper"
GCP_DIR = REPO_ROOT / "gcp-conversational-agents"
BIGQUERY_DIR = GCP_DIR / "generated" / "bigquery"


@dataclass(frozen=True)
class ArtifactCounts:
    icd11_categories: int
    dsm5_cases: int
    icd11_chunks: int
    dsm5_chunks: int
    total_chunks: int
    playbooks: int
    subagents: int
    source_pdfs: int


def count_jsonl(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open("r", encoding="utf-8") as handle:
        return sum(1 for line in handle if line.strip())


def count_files(path: Path, pattern: str, exclude_gitkeep: bool = False) -> int:
    if not path.exists():
        return 0
    files = list(path.glob(pattern))
    if exclude_gitkeep:
        files = [file for file in files if file.name != ".gitkeep"]
    return len([file for file in files if file.is_file()])


def collect_counts() -> ArtifactCounts:
    return ArtifactCounts(
        icd11_categories=count_jsonl(BIGQUERY_DIR / "icd11_categories.jsonl"),
        dsm5_cases=count_jsonl(BIGQUERY_DIR / "dsm5_cases.jsonl"),
        icd11_chunks=count_jsonl(BIGQUERY_DIR / "agent_corpus_chunks.icd11.jsonl"),
        dsm5_chunks=count_jsonl(BIGQUERY_DIR / "agent_corpus_chunks.dsm5.jsonl"),
        total_chunks=count_jsonl(BIGQUERY_DIR / "agent_corpus_chunks.jsonl"),
        playbooks=count_files(GCP_DIR / "playbooks", "*.json"),
        subagents=count_files(GCP_DIR / "subagents", "*.json"),
        source_pdfs=count_files(GCP_DIR / "source-pdfs", "*.pdf", exclude_gitkeep=True),
    )


def latex_number(value: int) -> str:
    return f"{value:,}".replace(",", r"\,")


def render_it(counts: ArtifactCounts) -> str:
    return f"""% BEGIN_DYNAMIC_ARTIFACT_SNAPSHOT_IT
\\subsection{{Snapshot numerico degli artefatti}}
Per distinguere il contributo metodologico dai risultati sperimentali, questa sezione riporta uno snapshot statico degli artefatti presenti nella repository al momento della stesura. I valori non sono risultati clinici, ma numeriche di riproducibilita: descrivono la dimensione del corpus disponibile, dei casi di benchmark e degli artefatti agentici che il protocollo puo usare.

\\begin{{table}}[htbp]
\\centering
\\begin{{tabular}}{{lr}}
\\toprule
\\textbf{{Artefatto}} & \\textbf{{Numero}}\\\\
\\midrule
Categorie ICD-11 estratte & {latex_number(counts.icd11_categories)}\\\\
Casi DSM-5-TR strutturati & {latex_number(counts.dsm5_cases)}\\\\
Chunk ICD-11 per datastore agentico & {latex_number(counts.icd11_chunks)}\\\\
Chunk DSM-5-TR per datastore agentico & {latex_number(counts.dsm5_chunks)}\\\\
Chunk agentici totali & {latex_number(counts.total_chunks)}\\\\
Playbook conversazionali & {latex_number(counts.playbooks)}\\\\
Subagent definiti & {latex_number(counts.subagents)}\\\\
PDF sorgente disponibili per datastore & {latex_number(counts.source_pdfs)}\\\\
\\bottomrule
\\end{{tabular}}
\\caption{{Snapshot quantitativo degli artefatti riproducibili. Le numeriche indicano la scala del corpus e dell'orchestrazione, non la performance diagnostica del sistema.}}
\\label{{tab:repo-snapshot-it}}
\\end{{table}}

\\begin{{figure}}[htbp]
\\centering
\\begin{{tikzpicture}}
\\begin{{axis}}[
  ybar,
  width=\\linewidth,
  height=6cm,
  bar width=18pt,
  ymin=0,
  ylabel={{Numero di elementi}},
  symbolic x coords={{ICD-11,DSM-5,Chunk ICD,Chunk DSM,Chunk totali}},
  xtick=data,
  x tick label style={{rotate=25,anchor=east}},
  nodes near coords,
  nodes near coords align={{vertical}},
  enlarge x limits=0.14,
  grid=major,
  major grid style={{draw=black!10}},
]
\\addplot[fill=llmblue!70, draw=llmblue] coordinates {{
  (ICD-11,{counts.icd11_categories})
  (DSM-5,{counts.dsm5_cases})
  (Chunk ICD,{counts.icd11_chunks})
  (Chunk DSM,{counts.dsm5_chunks})
  (Chunk totali,{counts.total_chunks})
}};
\\end{{axis}}
\\end{{tikzpicture}}
\\caption{{Distribuzione quantitativa degli artefatti di corpus. Il grafico rende evidente la separazione tra tassonomia ICD-11, casi benchmark DSM-5-TR e chunk documentali usati dagli agenti.}}
\\label{{fig:repo-snapshot-chart-it}}
\\end{{figure}}
% END_DYNAMIC_ARTIFACT_SNAPSHOT_IT"""


def render_en(counts: ArtifactCounts) -> str:
    return f"""% BEGIN_DYNAMIC_ARTIFACT_SNAPSHOT_EN
\\subsection{{Numerical artifact snapshot}}
To keep methodological contribution separate from experimental findings, this section reports a static snapshot of the artifacts available in the repository at the time of writing. These values are not clinical results. They are reproducibility counts: they describe the scale of the available corpus, benchmark cases, and agentic artifacts used by the protocol.

\\begin{{table}}[htbp]
\\centering
\\begin{{tabular}}{{lr}}
\\toprule
\\textbf{{Artifact}} & \\textbf{{Count}}\\\\
\\midrule
Extracted ICD-11 categories & {latex_number(counts.icd11_categories)}\\\\
Structured DSM-5-TR cases & {latex_number(counts.dsm5_cases)}\\\\
ICD-11 chunks for agent datastore & {latex_number(counts.icd11_chunks)}\\\\
DSM-5-TR chunks for agent datastore & {latex_number(counts.dsm5_chunks)}\\\\
Total agent chunks & {latex_number(counts.total_chunks)}\\\\
Conversational playbooks & {latex_number(counts.playbooks)}\\\\
Defined subagents & {latex_number(counts.subagents)}\\\\
Source PDFs available for datastores & {latex_number(counts.source_pdfs)}\\\\
\\bottomrule
\\end{{tabular}}
\\caption{{Quantitative snapshot of reproducible artifacts. Counts indicate the scale of the corpus and orchestration artifacts, not diagnostic performance.}}
\\label{{tab:repo-snapshot-en}}
\\end{{table}}

\\begin{{figure}}[htbp]
\\centering
\\begin{{tikzpicture}}
\\begin{{axis}}[
  ybar,
  width=\\linewidth,
  height=6cm,
  bar width=18pt,
  ymin=0,
  ylabel={{Number of elements}},
  symbolic x coords={{ICD-11,DSM-5,ICD chunks,DSM chunks,Total chunks}},
  xtick=data,
  x tick label style={{rotate=25,anchor=east}},
  nodes near coords,
  nodes near coords align={{vertical}},
  enlarge x limits=0.14,
  grid=major,
  major grid style={{draw=black!10}},
]
\\addplot[fill=llmblue!70, draw=llmblue] coordinates {{
  (ICD-11,{counts.icd11_categories})
  (DSM-5,{counts.dsm5_cases})
  (ICD chunks,{counts.icd11_chunks})
  (DSM chunks,{counts.dsm5_chunks})
  (Total chunks,{counts.total_chunks})
}};
\\end{{axis}}
\\end{{tikzpicture}}
\\caption{{Quantitative distribution of corpus artifacts. The chart highlights the separation between ICD-11 taxonomy, DSM-5-TR benchmark cases, and document chunks used by agents.}}
\\label{{fig:repo-snapshot-chart-en}}
\\end{{figure}}
% END_DYNAMIC_ARTIFACT_SNAPSHOT_EN"""


def replace_marked_block(path: Path, begin_marker: str, end_marker: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    begin = text.find(begin_marker)
    end = text.find(end_marker)
    if begin == -1 or end == -1 or end < begin:
        raise RuntimeError(f"Marker dinamici non trovati o non validi in {path}")

    end += len(end_marker)
    updated = text[:begin] + replacement + text[end:]
    if updated != text:
        path.write_text(updated, encoding="utf-8")


def compile_paper(tex_name: str) -> None:
    for _ in range(2):
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", tex_name],
            cwd=PAPER_DIR,
            check=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Aggiorna le sezioni numeriche dinamiche dei paper LLMind2.")
    parser.add_argument("--compile", action="store_true", help="Ricompila i PDF dopo l'aggiornamento.")
    args = parser.parse_args()

    counts = collect_counts()
    replace_marked_block(
        PAPER_DIR / "llmind2_it.tex",
        "% BEGIN_DYNAMIC_ARTIFACT_SNAPSHOT_IT",
        "% END_DYNAMIC_ARTIFACT_SNAPSHOT_IT",
        render_it(counts),
    )
    replace_marked_block(
        PAPER_DIR / "llmind2_en.tex",
        "% BEGIN_DYNAMIC_ARTIFACT_SNAPSHOT_EN",
        "% END_DYNAMIC_ARTIFACT_SNAPSHOT_EN",
        render_en(counts),
    )

    print("Sezioni dinamiche aggiornate.")
    print(f"  ICD-11 categories: {counts.icd11_categories}")
    print(f"  DSM-5-TR cases: {counts.dsm5_cases}")
    print(f"  ICD-11 chunks: {counts.icd11_chunks}")
    print(f"  DSM-5-TR chunks: {counts.dsm5_chunks}")
    print(f"  Total chunks: {counts.total_chunks}")
    print(f"  Playbooks: {counts.playbooks}")
    print(f"  Subagents: {counts.subagents}")
    print(f"  Source PDFs: {counts.source_pdfs}")

    if args.compile:
        compile_paper("llmind2_it.tex")
        compile_paper("llmind2_en.tex")
        print("PDF ricompilati.")


if __name__ == "__main__":
    main()
