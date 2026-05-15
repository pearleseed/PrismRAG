"""
title: PrismRAG Ingestion Filter
author: PrismRAG
author_url: https://github.com/pearleseed/PrismRAG
funding_url: https://github.com/pearleseed/PrismRAG
version: 0.1
"""

from pydantic import BaseModel, Field
from typing import Optional, List
import os
import json
import asyncio
import argparse
import tempfile
from pathlib import Path
import httpx

# --- Configuration ---
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
    ".docx",
    ".pptx",
    ".html",
    ".htm",
    ".xlsx",
    ".epub",
    ".csv",
    ".xml",
    ".nxml",
    ".tex",
    ".png",
    ".jpg",
    ".jpeg",
    ".tiff",
    ".bmp",
    ".wav",
    ".mp3",
    ".m4a",
    ".aac",
    ".ogg",
    ".flac",
    ".mp4",
    ".avi",
    ".mov",
    ".webm",
    ".mkv",
    ".adoc",
    ".asciidoc",
    ".xbrl",
    ".json",
    ".vtt",
}


class Filter:
    class Valves(BaseModel):
        priority: int = Field(
            default=0, description="Priority level for the filter operations."
        )
        base_url: str = Field(
            default=os.getenv("PRISMRAG_API_URL", "http://localhost:8080/api/v1"),
            description="The base URL for the PrismRAG API.",
        )
        workspace_id: int = Field(
            default=1,
            description="The target workspace ID in PrismRAG.",
        )
        batch_size: int = Field(
            default=10,
            description="Number of files to upload per request.",
        )
        open_webui_url: str = Field(
            default=os.getenv("OPEN_WEBUI_URL", "http://localhost:3000/api/v1"),
            description="The base URL for the Open WebUI API.",
        )

    class UserValves(BaseModel):
        pass

    def __init__(self):
        # Indicates custom file handling logic. This flag helps disengage default routines in favor of custom
        # implementations, informing the WebUI to defer file-related operations to designated methods within this class.
        self.file_handler = True
        self.valves = self.Valves()
        self.client = None
        self._processed_ids = set()

    async def _get_client(self):
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=120.0)
        return self.client

    def get_files(self, path: Path, recursive: bool = False) -> List[Path]:
        """Collect all supported files from the given path."""
        files = []
        if path.is_file():
            if path.suffix.lower() in ALLOWED_EXTENSIONS:
                files.append(path)
        elif path.is_dir():
            pattern = "**/*" if recursive else "*"
            for p in path.glob(pattern):
                if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS:
                    files.append(p)
        return sorted(files)

    async def upload_files(self, file_paths: List[Path], root_path: Path) -> List[int]:
        """Upload a batch of files to the backend."""
        client = await self._get_client()
        upload_url = f"{self.valves.base_url.rstrip('/')}/documents/upload/{self.valves.workspace_id}"

        files_data = []
        relative_paths = []

        for p in file_paths:
            try:
                rel = str(
                    p.relative_to(root_path.parent if root_path.is_dir() else root_path)
                )
            except Exception:
                rel = p.name

            files_data.append(
                ("files", (p.name, open(p, "rb"), "application/octet-stream"))
            )
            relative_paths.append(rel)

        try:
            data = {"relative_paths": json.dumps(relative_paths)}
            response = await client.post(upload_url, data=data, files=files_data)

            for _, (_, f, _) in files_data:
                f.close()

            response.raise_for_status()
            result = response.json()
            return [doc["id"] for doc in result["documents"]]
        except Exception as e:
            for _, (_, f, _) in files_data:
                f.close()
            raise e

    async def trigger_processing(self, document_ids: List[int]):
        """Trigger background processing for the uploaded documents."""
        client = await self._get_client()
        process_url = f"{self.valves.base_url.rstrip('/')}/rag/process-batch"
        payload = {"document_ids": document_ids}
        response = await client.post(process_url, json=payload)
        response.raise_for_status()
        return response.json()

    async def run_ingestion(self, path: Path, recursive: bool = False):
        """Main execution flow for ingestion."""
        print(f"Starting ingestion for: {path} (Workspace: {self.valves.workspace_id})")
        files = self.get_files(path, recursive)

        if not files:
            print("No supported files found.")
            return

        print(f"Found {len(files)} supported file(s).")
        all_doc_ids = []

        for i in range(0, len(files), self.valves.batch_size):
            batch = files[i : i + self.valves.batch_size]
            try:
                doc_ids = await self.upload_files(batch, path)
                all_doc_ids.extend(doc_ids)
                print(f"Uploaded {len(all_doc_ids)}/{len(files)} files...")
            except Exception as e:
                print(f"Error uploading batch: {e}")
                continue

        if all_doc_ids:
            try:
                result = await self.trigger_processing(all_doc_ids)
                accepted = result.get("accepted", [])
                print(f"Success! Triggered analysis for {len(accepted)} document(s).")
            except Exception as e:
                print(f"Failed to trigger processing: {e}")

    async def inlet(
        self,
        body: dict,
        __user__: Optional[dict] = None,
        __files__: Optional[List[dict]] = None,
    ) -> dict:
        """Modify the request body or validate it before processing."""
        print("--- PrismRAG Ingestion Filter: inlet start ---")

        # 1. Collect all potential files from various sources in the request
        all_files = []
        if __files__:
            all_files.extend(__files__)

        # Check body.files (common in some Open WebUI versions/configurations)
        if "files" in body and isinstance(body["files"], list):
            all_files.extend(body["files"])

        # Deduplicate by ID
        unique_files = {}
        for f in all_files:
            f_id = f.get("id") or f.get("file_id")
            if f_id:
                unique_files[f_id] = f

        if not unique_files:
            print("No files found in this request.")
            return body

        # 2. Filter supported files and skip already processed ones
        files_to_process = []
        for f_id, f in unique_files.items():
            filename = f.get("filename") or f.get("name", "unknown")

            # Check extension
            is_supported = any(
                filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS
            )
            if not is_supported:
                continue

            # Check if already processed in this session to avoid loop/redundancy
            if f_id in self._processed_ids:
                print(f"Skipping already processed file: {filename} ({f_id})")
                continue

            files_to_process.append((f_id, filename))

        if not files_to_process:
            return body

        print(f"Found {len(files_to_process)} new file(s) to ingest into PrismRAG.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            download_count = 0

            client = await self._get_client()
            for f_id, filename in files_to_process:
                print(f"Downloading: {filename}...")

                # Download content from Open WebUI
                download_url = (
                    f"{self.valves.open_webui_url.rstrip('/')}/files/{f_id}/content"
                )
                try:
                    response = await client.get(download_url)
                    response.raise_for_status()

                    target_file = tmp_path / filename
                    target_file.write_bytes(response.content)
                    download_count += 1
                    self._processed_ids.add(f_id)
                except Exception as e:
                    print(f"Failed to download {filename}: {e}")

            if download_count > 0:
                try:
                    print(
                        f"Uploading {download_count} file(s) to PrismRAG (Workspace: {self.valves.workspace_id})..."
                    )
                    await self.run_ingestion(tmp_path, recursive=False)
                    print("PrismRAG ingestion completed successfully.")
                except Exception as e:
                    print(f"PrismRAG Ingestion failed: {e}")

        print("--- PrismRAG Ingestion Filter: inlet end ---")
        return body

    async def outlet(self, body: dict, __user__: Optional[dict] = None) -> dict:
        """Modify or analyze the response body after processing."""
        print(f"outlet:{__name__}")
        return body


# --- CLI Support ---
if __name__ == "__main__":
    import sys
    from rich.console import Console
    from rich.panel import Panel

    console = Console()

    async def main():
        parser = argparse.ArgumentParser(
            description="PrismRAG Ingestion CLI (Open WebUI Function Format)"
        )
        parser.add_argument("path", help="Path to file or directory")
        parser.add_argument("--workspace", "-w", type=int, help="Target Workspace ID")
        parser.add_argument(
            "--recursive", "-r", action="store_true", help="Scan directory recursively"
        )
        parser.add_argument(
            "--batch", "-b", type=int, help="Number of files to upload per request"
        )
        parser.add_argument("--url", help="Backend API URL")

        args = parser.parse_args()

        target_path = Path(args.path)
        if not target_path.exists():
            console.print(f"[red]Error: Path '{args.path}' does not exist.[/red]")
            sys.exit(1)

        f = Filter()
        # Override valves with CLI arguments
        if args.url:
            f.valves.base_url = args.url
        if args.workspace:
            f.valves.workspace_id = args.workspace
        if args.batch:
            f.valves.batch_size = args.batch

        try:
            console.print(
                Panel(
                    f"[bold blue]PrismRAG Ingest CLI[/bold blue]\n"
                    f"[cyan]Workspace:[/cyan] {f.valves.workspace_id}\n"
                    f"[cyan]Target:[/cyan] {target_path}\n"
                    f"[cyan]API URL:[/cyan] {f.valves.base_url}",
                    expand=False,
                )
            )
            await f.run_ingestion(target_path, recursive=args.recursive)
        finally:
            if f.client:
                await f.client.aclose()

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
