"""
title: PrismRAG Ingestion Bridge
author: Antigravity
author_url: https://github.com/google-deepmind
version: 1.2.0
description: Professional bridge for syncing Open WebUI attachments to PrismRAG (Docling/Marker/KG).
"""

import os
import requests
import logging
import asyncio
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from pathlib import Path

# Setup logging
logger = logging.getLogger(__name__)


class Filter:
    class Valves(BaseModel):
        PRISMRAG_API_URL: str = Field(
            default="http://localhost:8080",
            description="URL of the PrismRAG backend API.",
        )
        AUTO_PROCESS: bool = Field(
            default=True,
            description="Automatically trigger PrismRAG processing (parsing/indexing) after upload.",
        )
        API_KEY: str = Field(
            default="sk-local-prismrag",
            description="PrismRAG OpenAI-compatible API key.",
        )
        UPLOAD_DIR: str = Field(
            default="/app/backend/data/uploads",
            description="Internal path to Open WebUI uploads directory (default for Docker).",
        )

    def __init__(self):
        self.valves = self.Valves()

    def _get_workspace_id(self, model_id: str) -> Optional[int]:
        """Extract Workspace ID from model name (prismrag-workspace-X)."""
        for prefix in ["prismrag-workspace-", "prismrag-ws-", "prismrag-kb-"]:
            if model_id.startswith(prefix):
                try:
                    return int(model_id.replace(prefix, ""))
                except ValueError:
                    continue
        return None

    async def inlet(
        self,
        body: Dict[str, Any],
        __user__: Optional[Dict[str, Any]] = None,
        __files__: Optional[List[Dict[str, Any]]] = None,
        __event_emitter__: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Open WebUI Inlet Filter.
        Processes file attachments and syncs them to PrismRAG if the model is a PrismRAG workspace.
        """
        model_id = body.get("model", "")
        workspace_id = self._get_workspace_id(model_id)

        # 1. Skip if not a PrismRAG workspace model or no files attached
        if workspace_id is None or not __files__:
            return body

        if __event_emitter__:
            await __event_emitter__(
                {
                    "type": "status",
                    "data": {
                        "description": f"Syncing to PrismRAG Workspace {workspace_id}...",
                        "done": False,
                    },
                }
            )

        prism_headers: Dict[str, Any] = {
            "Authorization": f"Bearer {self.valves.API_KEY}"
        }
        uploaded_count = 0

        for file_item in __files__:
            # Note: __files__ structure can vary slightly by version,
            # we check common keys for 'id' and 'filename'
            f = file_item.get("file", {})
            file_id = f.get("id") or file_item.get("id")
            file_name = f.get("filename") or file_item.get("name") or "unnamed_file"

            if not file_id:
                continue

            try:
                # 2. Access original binary file
                # Latest Open WebUI docs suggest checking the uploads directory directly
                # Pattern: {file_id}_{filename}
                file_path = Path(self.valves.UPLOAD_DIR) / f"{file_id}_{file_name}"

                content = None
                if file_path.exists():
                    content = file_path.read_bytes()
                else:
                    # Fallback: Attempt to use the internal API if filesystem is not accessible
                    # (Requires knowing the WebUI's reachable URL, which is tricky in Filters)
                    logger.warning(
                        f"File not found at {file_path}. Skipping bridge sync."
                    )
                    continue

                # 3. Upload to PrismRAG
                upload_url = f"{self.valves.PRISMRAG_API_URL.rstrip('/')}/api/v1/documents/upload/{workspace_id}"

                # Perform the upload
                # We use a non-blocking way or a small timeout to avoid hanging the chat
                upload_resp = requests.post(
                    upload_url,
                    files={"files": (file_name, content)},
                    headers=prism_headers,
                    timeout=30,
                )
                upload_resp.raise_for_status()

                # 4. Trigger processing
                upload_data = upload_resp.json()
                docs = upload_data.get("documents", [])
                if docs and self.valves.AUTO_PROCESS:
                    doc_id = docs[0].get("id")
                    process_url = f"{self.valves.PRISMRAG_API_URL.rstrip('/')}/api/v1/rag/process/{doc_id}"
                    requests.post(process_url, headers=prism_headers, timeout=5)

                uploaded_count += 1

            except Exception as e:
                logger.error(f"Failed to sync file {file_name} to PrismRAG: {str(e)}")
                if __event_emitter__:
                    await __event_emitter__(
                        {
                            "type": "status",
                            "data": {
                                "description": f"Error syncing {file_name}: {str(e)}",
                                "done": False,
                            },
                        }
                    )

        # 5. Final Status Update
        if __event_emitter__:
            if uploaded_count > 0:
                await __event_emitter__(
                    {
                        "type": "status",
                        "data": {
                            "description": f"PrismRAG: Indexed {uploaded_count} file(s).",
                            "done": True,
                        },
                    }
                )
            else:
                # Clear status if nothing happened
                await __event_emitter__(
                    {
                        "type": "status",
                        "data": {"description": "", "done": True, "hidden": True},
                    }
                )

        return body
