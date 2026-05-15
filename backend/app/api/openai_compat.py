"""
OpenAI-compatible HTTP surface for external chat UIs (e.g. Open WebUI).

Maps OpenAI Chat Completions to PrismRAG workspace-scoped agent streaming.
Model IDs: ``prismrag-workspace-{id}`` (one knowledge base per model).
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db
from app.core.database import async_session_maker
from app.models.knowledge_base import KnowledgeBase
from app.schemas.rag import ChatMessageSchema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["openai-compat"])


def _parse_workspace_id(model: str) -> int | str | None:
    """Resolve workspace id from OpenAI ``model`` field."""
    if not model:
        return None
    m = model.strip()
    if m == "prismrag-general":
        return "general"
    for prefix in ("prismrag-workspace-", "prismrag-ws-", "prismrag-kb-"):
        if m.startswith(prefix):
            try:
                return int(m[len(prefix) :])
            except ValueError:
                return None
    if m.startswith("prismrag-") and m[9:].isdigit():
        return int(m[9:])
    if m.isdigit():
        return int(m)
    return None


def _message_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return str(content)


def _publicize_backend_paths(text: str, origin: str) -> str:
    """Rewrite ``/static/...`` links for clients hosted on another origin."""
    if not text or not origin:
        return text
    o = origin.rstrip("/")
    return text.replace("](/static/", f"]({o}/static/").replace(
        "](/api/", f"]({o}/api/"
    )


def _verify_compat_api_key(request: Request) -> None:
    expected = (settings.PRISMRAG_OPENAI_COMPAT_API_KEY or "").strip()
    if not expected:
        return
    auth = request.headers.get("authorization") or ""
    token = auth.removeprefix("Bearer ").strip() if auth else ""
    if token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key for OpenAI-compatible endpoint",
        )


class OpenAIChatMessage(BaseModel):
    role: str
    content: Any = None


class OpenAIChatCompletionRequest(BaseModel):
    model: str
    messages: list[OpenAIChatMessage]
    stream: bool = False
    temperature: float | None = None
    max_tokens: int | None = None

    model_config = {"extra": "ignore"}


def _openai_messages_to_chat_parts(
    messages: list[OpenAIChatMessage],
) -> tuple[str, list[ChatMessageSchema]]:
    """Last user text -> current message; prior user/assistant -> history."""
    linear: list[ChatMessageSchema] = []
    for msg in messages:
        r = (msg.role or "").lower()
        if r not in ("user", "assistant"):
            continue
        text = _message_text(msg.content).strip()
        if not text:
            continue
        linear.append(ChatMessageSchema(role=r, content=text))

    if not linear:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No user/assistant messages with text content",
        )
    if linear[-1].role != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Last message must be from the user",
        )

    current = linear[-1].content
    history = linear[:-1]
    return current, history


def _chunk_openai(
    completion_id: str,
    model: str,
    delta: dict[str, Any],
    finish_reason: str | None = None,
) -> str:
    payload = {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": delta,
                "finish_reason": finish_reason,
            }
        ],
    }
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.get("/models")
async def openai_list_models(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """OpenAI-compatible model list — one model per knowledge base."""
    _verify_compat_api_key(request)

    result = await db.execute(
        select(KnowledgeBase).order_by(KnowledgeBase.updated_at.desc())
    )
    kbs = result.scalars().all()
    created = int(time.time())
    data = []

    # Always include a general model for independent usage
    data.append(
        {
            "id": "prismrag-general",
            "object": "model",
            "created": created,
            "owned_by": "prismrag",
        }
    )

    for kb in kbs:
        # Avoid duplicate 'General' if it already exists as ID 1 or named 'General'
        mid = f"prismrag-workspace-{kb.id}"
        data.append(
            {
                "id": mid,
                "object": "model",
                "created": created,
                "owned_by": "prismrag",
            }
        )
    return {"object": "list", "data": data}


@router.post("/chat/completions")
async def openai_chat_completions(
    request: Request,
    body: OpenAIChatCompletionRequest,
    db: AsyncSession = Depends(get_db),
):
    """OpenAI-compatible chat; ``model`` selects workspace (knowledge base)."""
    _verify_compat_api_key(request)

    if not settings.PRISMRAG_OPENAI_COMPAT_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI-compatible API is disabled (PRISMRAG_OPENAI_COMPAT_ENABLED=false)",
        )

    kb_id_or_str = _parse_workspace_id(body.model)
    if kb_id_or_str is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unknown model. Use ids from GET /v1/models, e.g. prismrag-workspace-1"
            ),
        )

    kb = None
    if kb_id_or_str == "general":
        # Look for existing 'General' workspace or use ID 1 as default
        kb_result = await db.execute(
            select(KnowledgeBase).where(
                (KnowledgeBase.id == 1)
                | (KnowledgeBase.name == "General Knowledge Base")
            )
        )
        kb = kb_result.scalar_one_or_none()
        if kb is None:
            # Auto-create the default workspace
            kb = KnowledgeBase(
                id=1,
                name="General Knowledge Base",
                description="Auto-provisioned workspace for external chat interfaces.",
            )
            try:
                db.add(kb)
                await db.commit()
                await db.refresh(kb)
            except Exception:
                await db.rollback()
                # If ID 1 is taken, let the DB assign a new one
                kb = KnowledgeBase(
                    name="General Knowledge Base",
                    description="Auto-provisioned workspace for external chat interfaces.",
                )
                db.add(kb)
                await db.commit()
                await db.refresh(kb)
    else:
        # It's a specific ID (int)
        kb_result = await db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == kb_id_or_str)
        )
        kb = kb_result.scalar_one_or_none()

    if kb is None:
        # If it was an ID that didn't exist
        err_id = kb_id_or_str if kb_id_or_str != "general" else "1"
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge base (workspace) {err_id} not found",
        )

    workspace_id: int = kb.id

    from app.api.chat_prompt import DEFAULT_SYSTEM_PROMPT, HARD_SYSTEM_PROMPT

    system_prompt = (kb.system_prompt or DEFAULT_SYSTEM_PROMPT) + HARD_SYSTEM_PROMPT

    user_message, history = _openai_messages_to_chat_parts(body.messages)
    history_dicts = [{"role": m.role, "content": m.content} for m in history]

    origin = settings.PRISMRAG_BACKEND_PUBLIC_ORIGIN.strip()

    if body.stream:
        return await _stream_openai_response(
            workspace_id=workspace_id,
            model_id=body.model,
            user_message=user_message,
            history_dicts=history_dicts,
            system_prompt=system_prompt,
            db=db,
            origin=origin,
        )

    # Non-streaming: drain agent stream
    from app.api.chat_agent import agent_chat_stream

    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    answer_parts: list[str] = []
    try:
        from app.models.chat_message import ChatMessage as ChatMessageModel

        user_row = ChatMessageModel(
            workspace_id=workspace_id,
            message_id=str(uuid.uuid4()),
            role="user",
            content=user_message,
        )
        db.add(user_row)
        await db.commit()
    except Exception as e:
        logger.warning("openai_compat: failed to persist user message: %s", e)
        await db.rollback()

    final_sources: list[Any] = []
    final_images: list[Any] = []
    final_thinking: str | None = None
    final_entities: list[str] = []

    try:
        async for event in agent_chat_stream(
            workspace_id=workspace_id,
            message=user_message,
            history=history_dicts,
            enable_thinking=False,
            db=db,
            system_prompt=system_prompt,
            force_search=False,
        ):
            et = event["event"]
            ed = event["data"]
            if et == "token":
                answer_parts.append(ed.get("text", ""))
            elif et == "complete":
                answer_parts = [ed.get("answer", "") or "".join(answer_parts)]
                final_sources = ed.get("sources") or []
                final_images = ed.get("image_refs") or []
                final_thinking = ed.get("thinking")
                final_entities = ed.get("related_entities") or []
            elif et == "error":
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=ed.get("message", "stream error"),
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("openai_compat chat error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e

    answer = _publicize_backend_paths(
        (answer_parts[0] if answer_parts else "").strip()
        or "Unable to generate a response.",
        origin,
    )

    try:
        from app.models.chat_message import ChatMessage as ChatMessageModel

        assistant_row = ChatMessageModel(
            workspace_id=workspace_id,
            message_id=str(uuid.uuid4()),
            role="assistant",
            content=answer,
            sources=final_sources if final_sources else None,
            related_entities=final_entities[:30] if final_entities else None,
            image_refs=final_images if final_images else None,
            thinking=final_thinking,
        )
        db.add(assistant_row)
        await db.commit()
    except Exception as e:
        logger.warning("openai_compat: failed to persist assistant message: %s", e)
        await db.rollback()

    return JSONResponse(
        {
            "id": completion_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": body.model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": answer},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            },
        }
    )


async def _stream_openai_response(
    workspace_id: int,
    model_id: str,
    user_message: str,
    history_dicts: list[dict[str, str]],
    system_prompt: str,
    db: AsyncSession,
    origin: str,
) -> StreamingResponse:
    from app.api.chat_agent import agent_chat_stream, sse_with_heartbeat

    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            from app.models.chat_message import ChatMessage as ChatMessageModel

            user_row = ChatMessageModel(
                workspace_id=workspace_id,
                message_id=str(uuid.uuid4()),
                role="user",
                content=user_message,
            )
            db.add(user_row)
            await db.commit()
        except Exception as e:
            logger.warning("openai_compat stream: user persist failed: %s", e)
            await db.rollback()

        yield _chunk_openai(
            completion_id, model_id, {"role": "assistant", "content": ""}
        )

        final_entities: list[str] = []

        start_time = time.time()
        token_count = 0
        is_completed = False

        try:
            async for event in agent_chat_stream(
                workspace_id=workspace_id,
                message=user_message,
                history=history_dicts,
                enable_thinking=False,
                session_factory=async_session_maker,
                system_prompt=system_prompt,
                force_search=False,
            ):
                et = event["event"]
                ed = event["data"]
                if et == "token":
                    token_count += 1
                    piece = ed.get("text", "")
                    if piece:
                        yield _chunk_openai(completion_id, model_id, {"content": piece})
                elif et == "complete":
                    is_completed = True
                    final_answer = ed.get("answer", "") or ""
                    final_sources = ed.get("sources") or []
                    final_images = ed.get("image_refs") or []
                    final_thinking = ed.get("thinking")
                    final_entities = ed.get("related_entities") or []
                elif et == "error":
                    err = ed.get("message", "unknown error")
                    yield f"data: {json.dumps({'error': {'message': err}})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
        except Exception as e:
            logger.error("openai_compat stream: %s", e, exc_info=True)
            yield f"data: {json.dumps({'error': {'message': str(e)}})}\n\n"
            yield "data: [DONE]\n\n"
            return

        text = _publicize_backend_paths(final_answer.strip(), origin)
        if token_count == 0 and text:
            yield _chunk_openai(completion_id, model_id, {"content": text})

        yield _chunk_openai(completion_id, model_id, {}, finish_reason="stop")
        yield "data: [DONE]\n\n"

        duration = time.time() - start_time
        status_str = "completed" if is_completed else "disconnected"
        logger.info(
            f"OpenAI Stream {status_str}: workspace={workspace_id}, "
            f"duration={duration:.2f}s, tokens={token_count}"
        )

        try:
            from app.models.chat_message import ChatMessage as ChatMessageModel

            assistant_row = ChatMessageModel(
                workspace_id=workspace_id,
                message_id=str(uuid.uuid4()),
                role="assistant",
                content=text or final_answer or "",
                sources=final_sources if final_sources else None,
                related_entities=final_entities[:30] if final_entities else None,
                image_refs=final_images if final_images else None,
                thinking=final_thinking,
            )
            async with async_session_maker() as fresh_db:
                fresh_db.add(assistant_row)
                await fresh_db.commit()
        except Exception as e:
            logger.warning("openai_compat stream: assistant persist failed: %s", e)

    return StreamingResponse(
        sse_with_heartbeat(event_generator()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
