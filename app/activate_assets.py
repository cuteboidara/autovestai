"""CLI entrypoint for the asset-activation workflow."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from app.config import ActivationSettings
from app.services.activation_service import AssetActivationService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Activate the full AutovestAI instrument universe from a contract-specification PDF.",
    )
    parser.add_argument("--pdf", required=True, help="Path to the contract-specification PDF.")
    parser.add_argument(
        "--output-dir",
        default="activation_output",
        help="Directory where activation artifacts will be written.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Python logging level.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    output_dir = Path(args.output_dir)
    settings = ActivationSettings.from_env(output_dir=output_dir)
    service = AssetActivationService(settings)
    report = service.activate(Path(args.pdf), output_dir=output_dir)
    logging.getLogger(__name__).info(
        "Asset activation complete: %s total, %s active, %s partial, %s unresolved",
        report.total_assets_found_in_pdf,
        report.total_resolved,
        report.total_partially_resolved,
        report.total_unresolved,
    )


if __name__ == "__main__":
    main()
