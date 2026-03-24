from __future__ import annotations

from pathlib import Path

from docx import Document

from idea2thesis.contracts import ParsedBrief


def _split_labeled_values(paragraph: str) -> list[str]:
    _, _, content = paragraph.partition("：")
    return [item.strip() for item in content.split("、") if item.strip()]


def parse_brief(file_path: Path) -> ParsedBrief:
    document = Document(file_path)
    paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    raw_text = "\n".join(paragraphs)

    tables: list[list[list[str]]] = []
    for table in document.tables:
        rows: list[list[str]] = []
        for row in table.rows:
            rows.append([cell.text.strip() for cell in row.cells])
        tables.append(rows)

    title = paragraphs[0] if paragraphs else "Untitled Brief"
    requirements: list[str] = []
    constraints: list[str] = []
    tech_hints: list[str] = []
    thesis_cues: list[str] = []

    for paragraph in paragraphs[1:]:
        if paragraph.startswith("功能要求："):
            requirements.extend(_split_labeled_values(paragraph))
        elif paragraph.startswith("约束条件："):
            constraints.extend(_split_labeled_values(paragraph))
        elif paragraph.startswith("论文提纲："):
            thesis_cues.extend(_split_labeled_values(paragraph))
        elif paragraph.startswith("技术要求"):
            continue
        elif "Python" in paragraph or "Java" in paragraph or "React" in paragraph:
            tech_hints.append(paragraph)

    if tables:
        thesis_cues.extend(
            [row[0] for table in tables for row in table[1:] if row and row[0]]
        )

    return ParsedBrief(
        title=title,
        requirements=requirements,
        constraints=constraints,
        tech_hints=tech_hints,
        thesis_cues=list(dict.fromkeys(thesis_cues)),
        raw_text=raw_text,
        extraction_snapshot={"paragraphs": paragraphs, "tables": tables},
    )
