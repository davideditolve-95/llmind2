#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${ROOT_DIR}/.." && pwd)"
SOURCE_DIR="${ROOT_DIR}/source-pdfs"
BACKEND_DOCS="${REPO_DIR}/backend/data/original_docs"

PYTHON_BIN="${PYTHON_BIN:-python3}"

mkdir -p "${SOURCE_DIR}"

echo "Copying ICD-11 CDDR PDF..."
cp "${BACKEND_DOCS}/ICD-11-CDDR.pdf" "${SOURCE_DIR}/ICD-11-CDDR.pdf"

echo "Rendering DSM-5-TR extracted cases PDF from backend text/csv sources..."
"${PYTHON_BIN}" - <<'PY' "${REPO_DIR}" "${SOURCE_DIR}"
from pathlib import Path
import csv
import re
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

repo = Path(sys.argv[1])
source_dir = Path(sys.argv[2])
backend_docs = repo / "backend" / "data" / "original_docs"
out = source_dir / "DSM-5-TR_Clinical_Cases.pdf"
csv_path = backend_docs / "DSM-5-TR_Clinical_Cases_splitted.csv"
txt_path = backend_docs / "DSM-5-TR_Clinical_Cases.txt"

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="SmallBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=8.2,
    leading=10.4,
    spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="CaseTitle",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=12,
    leading=14,
    textColor=colors.HexColor("#1f3a5f"),
    spaceBefore=8,
    spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="FieldTitle",
    parent=styles["Heading3"],
    fontName="Helvetica-Bold",
    fontSize=9.5,
    leading=11,
    textColor=colors.HexColor("#475569"),
    spaceBefore=5,
    spaceAfter=3,
))

def clean(text: str) -> str:
    text = text.replace("\x00", " ").replace("�", "-")
    text = re.sub(r"\s+", " ", text).strip()
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )

doc = SimpleDocTemplate(
    str(out),
    pagesize=A4,
    rightMargin=1.35 * cm,
    leftMargin=1.35 * cm,
    topMargin=1.25 * cm,
    bottomMargin=1.25 * cm,
    title="DSM-5-TR Clinical Cases - LLMind2 Extracted Research Corpus",
)

story = [
    Paragraph("DSM-5-TR Clinical Cases - Extracted Research Corpus", styles["Title"]),
    Paragraph(
        "Generated from local LLMind2 backend sources for datastore ingestion. "
        "This artifact preserves the extracted case structure: Introduction, Discussion, Diagnosis.",
        styles["SmallBody"],
    ),
    Spacer(1, 0.3 * cm),
]

if csv_path.exists():
    with csv_path.open(newline="", encoding="utf-8", errors="replace") as handle:
        reader = csv.DictReader(handle, delimiter="§")
        for row in reader:
            case_number = clean(row.get("Case_Number", "unknown"))
            story.append(Paragraph(f"Case {case_number}", styles["CaseTitle"]))
            for field in ("Introduction", "Discussion", "Diagnosis"):
                value = clean(row.get(field, ""))
                if not value:
                    continue
                story.append(Paragraph(field, styles["FieldTitle"]))
                # Keep paragraphs bounded so one malformed extraction cannot make layout unusable.
                for chunk_start in range(0, len(value), 3500):
                    story.append(Paragraph(value[chunk_start:chunk_start + 3500], styles["SmallBody"]))
            story.append(PageBreak())
elif txt_path.exists():
    story.append(Paragraph(clean(txt_path.read_text(encoding="utf-8", errors="replace")), styles["SmallBody"]))
else:
    raise SystemExit("No DSM source found in backend/data/original_docs")

doc.build(story)
print(out)
PY

echo "Rendering LLMind2 research protocol PDF from docs..."
"${PYTHON_BIN}" - <<'PY' "${REPO_DIR}" "${SOURCE_DIR}"
from pathlib import Path
import re
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

repo = Path(sys.argv[1])
source_dir = Path(sys.argv[2])
out = source_dir / "LLMind2_Research_Protocol.pdf"

doc_files = [
    "00-project-overview.md",
    "01-multi-agent-playbook.md",
    "05-cloud-maturity.md",
    "06-agid-compliance.md",
    "10-thesis-roadmap.md",
    "11-benchmark-protocol.md",
    "12-risk-register.md",
    "13-data-governance.md",
    "14-technical-review-dossier.md",
]

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="ProtocolBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=8.6,
    leading=11,
    spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="ProtocolHeading",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=12,
    leading=14,
    textColor=colors.HexColor("#1f3a5f"),
    spaceBefore=8,
    spaceAfter=6,
))

def clean_line(line: str) -> str:
    line = line.rstrip()
    line = re.sub(r"^#{1,6}\s*", "", line)
    line = re.sub(r"`([^`]*)`", r"\1", line)
    line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return line

doc = SimpleDocTemplate(
    str(out),
    pagesize=A4,
    rightMargin=1.35 * cm,
    leftMargin=1.35 * cm,
    topMargin=1.25 * cm,
    bottomMargin=1.25 * cm,
    title="LLMind2 Research Protocol",
)

story = [
    Paragraph("LLMind2 Research Protocol", styles["Title"]),
    Paragraph("Generated from repository documentation for GCP datastore ingestion.", styles["ProtocolBody"]),
    Spacer(1, 0.3 * cm),
]

for name in doc_files:
    path = repo / "docs" / name
    if not path.exists():
        continue
    story.append(Paragraph(name, styles["ProtocolHeading"]))
    buffer = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = clean_line(raw)
        if not line:
            if buffer:
                story.append(Paragraph(" ".join(buffer), styles["ProtocolBody"]))
                buffer = []
            continue
        if raw.startswith("#"):
            if buffer:
                story.append(Paragraph(" ".join(buffer), styles["ProtocolBody"]))
                buffer = []
            story.append(Paragraph(line, styles["ProtocolHeading"]))
        else:
            buffer.append(line)
    if buffer:
        story.append(Paragraph(" ".join(buffer), styles["ProtocolBody"]))
    story.append(PageBreak())

doc.build(story)
print(out)
PY

echo "Source documents ready:"
ls -lh "${SOURCE_DIR}"/ICD-11-CDDR.pdf \
  "${SOURCE_DIR}"/DSM-5-TR_Clinical_Cases.pdf \
  "${SOURCE_DIR}"/LLMind2_Research_Protocol.pdf
