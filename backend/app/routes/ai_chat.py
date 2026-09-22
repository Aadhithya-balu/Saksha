"""Conversational AI assistant endpoints — backend-grounded via the Chat Orchestrator.

Persistence: when a conversation_id is supplied (or auto-created), the completed
user/assistant exchange is persisted atomically AFTER successful generation —
failed generations never leave partial records behind. Temporary chats send
persist=false and stay purely in-memory.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.rbac import ALL_ROLES, require_roles
from app.core.exceptions import NotFoundException
from app.database.postgres import get_db
from app.models.user import User
from app.schemas.chat_history import ConversationCreate
from app.services.chat import history_service

logger = logging.getLogger("saksha")

router = APIRouter(prefix="/ai/chat", tags=["AI Chat"], dependencies=[Depends(require_roles(*ALL_ROLES))])

_orchestrator = None


def _get_orchestrator():
    global _orchestrator
    # The orchestrator's system context (ContextBuilder.SYSTEM_PROMPT) carries
    # the multilingual answer instructions, so every /ai/chat exchange
    # understands English, Kannada, Kanglish, and other languages and responds
    # in the user's own language.
    if _orchestrator is None:
        from app.ai.chat.orchestrator import ChatOrchestrator
        _orchestrator = ChatOrchestrator()
    return _orchestrator


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None
    stream: bool = False
    conversation_id: uuid.UUID | None = Field(
        None, description="Existing owned conversation to continue. Omit to start a new one."
    )
    persist: bool = Field(
        False,
        description="Persist the exchange to chat history (opt-in; false keeps the chat server-side-transient).",
    )


class ChatCitationOut(BaseModel):
    source: str
    title: str
    score: float
    records: list[dict[str, Any]] | None = None


class ChatProvenanceOut(BaseModel):
    source_records: list[dict[str, Any]] = Field(default_factory=list)
    verified_ids: list[str] = Field(default_factory=list)
    unverified_ids: list[str] = Field(default_factory=list)
    verified_names: list[str] = Field(default_factory=list)
    unverified_names: list[str] = Field(default_factory=list)
    grounding_score: float = 0.0
    has_fabricated_claims: bool = False
    refusal_issued: bool = False


class ChatResponse(BaseModel):
    answer: str
    summary: str
    entities: list[str]
    classification: str
    sources: list[str]
    chart_suggestion: str | None = None
    citations: list[ChatCitationOut] = Field(default_factory=list)
    data: list[dict[str, Any]] = Field(default_factory=list)
    conversation_id: uuid.UUID | None = None
    conversation_title: str | None = None
    engine: str | None = None
    provenance: ChatProvenanceOut | None = None


def _resolve_conversation(db: Session, current_user: User, payload: ChatRequest):
    """Resolve (or lazily create) the owning conversation for this exchange."""
    if payload.conversation_id is not None:
        try:
            return history_service.get_owned_conversation(db, current_user.id, payload.conversation_id), False
        except NotFoundException:
            raise HTTPException(status_code=404, detail="Conversation not found")
    if payload.persist:
        return history_service.create_conversation(db, current_user, ConversationCreate()), True
    return None, False


def _persist_exchange(db: Session, user: User, conversation, message: str, result: dict[str, Any]) -> bool:
    """Persist one completed exchange atomically. Never logs message content."""
    try:
        history_service.add_messages(db, user, conversation.id, [
            {
                "role": "user",
                "content": message,
            },
            {
                "role": "assistant",
                "content": result.get("answer", ""),
                "classification": result.get("classification"),
                "sources": result.get("sources") or [],
                "citations": result.get("citations") or [],
            },
        ])
        db.refresh(conversation)
        return True
    except Exception:
        db.rollback()
        logger.warning(
            "Chat history persistence failed for user %s / conversation %s",
            user.username, conversation.id, exc_info=True,
        )
        return False


def _ndjson(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, default=str) + "\n").encode("utf-8")


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    from app.database.postgres import SessionLocal
    db = SessionLocal()
    user_sid = f"user:{current_user.username}:{payload.session_id or 'default'}"
    orch = _get_orchestrator()
    conversation, auto_created = _resolve_conversation(db, current_user, payload)
    llm_history = (
        history_service.load_llm_context(db, conversation.id) if conversation is not None else None
    )

    if payload.stream:
        async def event_stream() -> AsyncIterator[bytes]:
            acc = ""
            final_result: dict[str, Any] | None = None
            try:
                if conversation is not None:
                    yield _ndjson({
                        "type": "meta",
                        "content": {
                            "conversation_id": str(conversation.id),
                            "title": None if auto_created else conversation.title,
                            "temporary": False,
                        },
                    })
                async for chunk in orch.process_message(
                    payload.message, user_sid, db, history=llm_history, current_user=current_user,
                ):
                    yield chunk
                    try:
                        line = chunk.decode("utf-8").strip()
                        if line:
                            obj = json.loads(line)
                            if obj.get("type") == "token":
                                acc += str(obj.get("content") or "")
                            elif obj.get("type") == "final":
                                final_result = obj.get("content")
                    except Exception:
                        continue
                if conversation is not None:
                    result = final_result if isinstance(final_result, dict) else {"answer": acc}
                    persist_db = SessionLocal()
                    try:
                        conversation = persist_db.merge(conversation)
                        if not str(result.get("answer") or "").strip():
                            if auto_created:
                                history_service.discard_if_empty(persist_db, current_user, conversation)
                            return
                        if _persist_exchange(persist_db, current_user, conversation, payload.message, result):
                            yield _ndjson({
                                "type": "meta",
                                "content": {
                                    "conversation_id": str(conversation.id),
                                    "title": conversation.title,
                                    "temporary": False,
                                },
                            })
                    finally:
                        persist_db.close()
            except Exception:
                # Generation failed — make sure no orphan empty conversation remains.
                try:
                    db.rollback()
                    if conversation is not None and auto_created:
                        history_service.discard_if_empty(db, current_user, conversation)
                except Exception:
                    db.rollback()
                raise

        return StreamingResponse(event_stream(), media_type="application/x-ndjson")

    try:
        result = orch.process_message_sync(payload.message, user_sid, db, history=llm_history, current_user=current_user)
    except Exception:
        # Generation failed — make sure no orphan empty conversation remains.
        db.rollback()
        if conversation is not None and auto_created:
            history_service.discard_if_empty(db, current_user, conversation)
        raise
    saved_conversation = conversation
    if conversation is not None:
        if not _persist_exchange(db, current_user, conversation, payload.message, result):
            if auto_created:
                history_service.discard_if_empty(db, current_user, conversation)
            saved_conversation = None
    response = _build_response(result)
    if saved_conversation is not None:
        response.conversation_id = saved_conversation.id
        response.conversation_title = saved_conversation.title
    return response


@router.post("/query", response_model=ChatResponse)
async def chat_query(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_sid = f"user:{current_user.username}:{payload.session_id or 'default'}"
    try:
        result = _get_orchestrator().process_message_sync(payload.message, user_sid, db, current_user=current_user)
        return _build_response(result)
    except Exception:
        raise HTTPException(status_code=422, detail="Failed to process chat message.")


@router.post("/investigation-chat", response_model=ChatResponse)
async def investigation_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_sid = f"user:{current_user.username}:{payload.session_id or 'default'}"
    try:
        result = _get_orchestrator().process_message_sync(payload.message, user_sid, db, current_user=current_user)
        return _build_response(result)
    except Exception:
        raise HTTPException(status_code=422, detail="Failed to process investigation chat.")


def _build_response(result: dict[str, Any]) -> ChatResponse:
    provenance_data = result.get("provenance")
    provenance = None
    if isinstance(provenance_data, dict):
        provenance = ChatProvenanceOut(**provenance_data)
    return ChatResponse(
        answer=result.get("answer", ""),
        summary=result.get("summary", ""),
        entities=result.get("entities", []),
        classification=result.get("classification", "general"),
        sources=result.get("sources", []),
        chart_suggestion=result.get("chart_suggestion"),
        engine=result.get("engine"),
        citations=[
            ChatCitationOut(
                source=c.get("source", ""),
                title=c.get("title", ""),
                score=c.get("score", 0.0),
                records=c.get("records"),
            )
            for c in result.get("citations", [])
            if isinstance(c, dict)
        ],
        data=[{
            "classification": result.get("classification", "general"),
            "entities": result.get("entities", []),
        }],
        provenance=provenance,
    )
