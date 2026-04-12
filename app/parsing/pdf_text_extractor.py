"""PDF text extraction helpers."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path
import subprocess

from app.config import ActivationSettings


LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class PdfTextExtractor:
    """Extract raw text from the source PDF using the local Node helper."""

    settings: ActivationSettings

    def extract_text(self, pdf_path: Path) -> str:
        """Return extracted PDF text, falling back to a sibling `.txt` cache if needed."""

        pdf_path = pdf_path.resolve()
        command = [
            self.settings.node_executable,
            str(self.settings.pdf_extractor_script),
            str(pdf_path),
        ]

        try:
            result = subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                cwd=self.settings.project_root,
            )
            text = result.stdout
            if text.strip():
                return text
        except (OSError, subprocess.CalledProcessError) as error:
            LOGGER.warning("PDF extraction helper failed for %s: %s", pdf_path, error)

        fallback_path = pdf_path.with_suffix(".txt")
        if fallback_path.exists():
            LOGGER.warning("Falling back to cached text file %s", fallback_path)
            return fallback_path.read_text(encoding="utf-8")

        raise RuntimeError(f"Unable to extract text from PDF: {pdf_path}")

