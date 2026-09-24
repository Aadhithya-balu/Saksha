"""LLM generator — calls external LLM APIs (Groq/Gemini/OpenAI) or falls back to a
relevance-focused local template generation grounded strictly in retrieved context."""
from __future__ import annotations

import json
import re
from typing import AsyncIterator

import httpx

from app.ai.chat.entity_extractor import _CRIME_CATEGORIES, _KARNATAKA_DISTRICTS
from app.core.config import settings


_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
_OPENAI_URL = "https://api.openai.com/v1/chat/completions"
_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={key}"

# Groq is the primary provider (highest free-tier limits). API keys accept a
# comma-separated list; when one key hits its usage/rate limit the generator
# rotates to the next key, then to the next provider, then to local templates.
_PROVIDER_PRIORITY = ("groq", "gemini", "openai")
_PROVIDER_KEY_ATTR = {"groq": "GROQ_API_KEY", "gemini": "GEMINI_API_KEY", "openai": "OPENAI_API_KEY"}
_PROVIDER_MODEL_ATTR = {"groq": "GROQ_MODEL", "gemini": "GEMINI_MODEL", "openai": "OPENAI_MODEL"}

_REQUEST_TIMEOUT = 60.0
_MAX_CONTEXT_LINES = 20
_HISTORY_LIMIT = 10

# HTTP statuses meaning "this key is done" — rotate to the next key.
_KEY_EXHAUSTED_STATUSES = {401, 402, 403, 429}


class _ProviderExhausted(Exception):
    """Raised when a provider attempt yields nothing usable (limits/errors)."""


_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "do", "does", "did", "of", "in", "on", "at", "to", "for", "with",
    "about", "show", "me", "tell", "give", "list", "all", "and", "or",
    "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
    "many", "much", "any", "some", "please", "can", "could", "would",
    "should", "i", "you", "we", "they", "it", "its", "this", "that",
    "these", "those", "there", "here", "get", "need", "want", "know",
    "us", "my", "our", "am", "s", "t",
}

_SMALLTALK = {
    "hi", "hello", "hey", "yo", "thanks", "thank", "thx", "you", "ok",
    "okay", "good", "morning", "afternoon", "evening", "day", "namaste",
    "fine", "great", "cool", "welcome", "bye",
}

# Substrings that mark a context line as "this source had no data" — these must
# never poison an otherwise useful reply (issue #122: one empty source used to
# flip the entire answer into a canned refusal).
_NO_DATA_MARKERS = (
    "no relevant data",
    "no fir found", "no firs match", "no firs in",
    "no case found", "no matching cases", "no cases in database",
    "no criminal record found", "no criminal records match",
    "no officer found", "no officers found",
    "no victims found", "no notifications.", "no network data",
    "no hotspot data", "no anomalies detected", "no anomalies.",
    "no offender data", "no prediction available", "no forecast available",
    "no similar offenders", "no data.", "not implemented",
)

_REFUSAL_MESSAGE = (
    "I could not find matching records in the Saksha database for that query. "
    "If you can tell me a little more — a case or FIR number, a name, or a "
    "district — I'll take another look."
)

_SYSTEM_CLOCK_HEADER = "System Clock"

_RECENT_ACTIVITY_MARK = "recent activity"

_TEMPORAL_WORDS = {
    "today", "tonight", "yesterday", "morning", "evening",
    "recent", "recently", "latest", "newest", "new",
    "week", "month", "year", "day", "now", "current",
}
_MAX_OVERVIEW_LINES = 12

# Words that can never be mistaken for a person's name when they appear in a
# question — question openers, entity/domain vocabulary, districts, temporal
# words, directions, etc. Guard against the name-honesty gate (issue #203) ever
# refusing on plain vocabulary instead of on a genuinely absent person.
_NAME_NOISE = {
    # question openers / commands
    "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
    "tell", "show", "showme", "find", "list", "search", "give", "describe",
    "please", "look", "get", "fetch", "has", "have", "had", "do", "does",
    "did", "is", "are", "was", "were", "will", "would", "can", "could",
    "should", "may", "might", "there", "also", "and", "or", "the", "any",
    "all", "some", "this", "these", "those", "your", "my", "our", "want",
    "need", "check", "help", "support", "login", "password", "access",
    # domain entities / vocabulary
    "crime", "crimes", "criminal", "criminals", "offender", "offenders",
    "suspect", "suspects", "accused", "case", "cases", "complaint",
    "complaints", "fir", "firs", "victim", "victims", "victimology",
    "officer", "officers", "police", "inspector", "superintendent", "badge",
    "record", "records", "stastics", "statistics", "stats", "overview",
    "summary", "dashboard", "analytics", "analysis", "breakdown", "detail",
    "details", "info", "information", "report", "reports", "notification",
    "notifications", "evidence", "evidences", "evidence", "hotspot",
    "hotspots", "prediction", "predictions", "forecast", "forecasts",
    "anomaly", "anomalies", "trend", "trends", "compare", "comparison",
    "risk", "riskiness", "profile", "dossier", "dossiers", "history",
    "activity", "activities", "file", "files", "narrative", "section",
    "sections", "status", "progress", "priority", "category", "categories",
    "district", "districts", "area", "region", "state", "station", "charge",
    "fine", "warrant", "license", "identity", "verify", "verification",
    "approval", "permission", "application", "request", "ticket", "account",
    # crime nouns
    "theft", "robbery", "dacoity", "burglary", "murder", "homicide", "rape",
    "assault", "kidnap", "kidnapping", "extortion", "forgery", "fraud",
    "smuggling", "narcotics", "cyber", "domestic", "property", "illegal",
    "mining", "riot", "riots", "bomb", "gang", "chain", "snatching",
    "counterfeit", "violence", "border",
    # geography / directions / location suffixes
    "karnataka", "india", "bangalore", "bengaluru", "mysuru", "mangaluru",
    "belagavi", "ballari", "kalaburagi", "dharwad", "hassan", "tumkuru",
    "whitefield", "udupi", "davangere", "shivamogga", "raichur", "bidar",
    "urban", "rural", "north", "south", "east", "west", "central",
    "main", "road", "street", "market", "fort", "gate", "harbor", "zone",
    "city", "town", "village",
    # temporal
    "today", "yesterday", "tomorrow", "tonight", "morning", "afternoon",
    "evening", "night", "recent", "recently", "latest", "newest", "new",
    "week", "month", "year", "now", "current",
    # misc capitalized words users type
    "dangerous", "active", "closed", "open", "pending", "released",
    "stations", "database", "databases", "system", "systems", "website",
    "scheme", "schemes", "management", "sectionheaders", "logs",
    "duty", "shift", "roster", "patrol", "beat", "schedule",
    # superlatives / quantities — never person names
    "most", "least", "high", "highest", "low", "lowest", "top", "bottom",
    "maximum", "minimum", "max", "min", "rank", "ranking", "peak", "large",
    "largest", "big", "biggest", "more", "fewer", "less", "few", "several",
    "many", "much", "number", "count", "total", "compare", "comparison",
    "saksha", "crimecases", "northregion", "regarding", "called", "named",
    "about", "involving", "against",
    # graph/relationship vocabulary — "evidence LINKED to case", "CRIMINALS
    # associated with …": linkage words must never be captured as person names
    # (the local template used to refuse "what evidence is linked to case X…?"
    # as if "linked" were a named person).
    "linked", "link", "links", "linkage", "linkages", "related", "relationship",
    "associated", "associates", "association", "attached", "attachment",
    "connected", "connection", "connections", "tied", "linking", "relates",
    # generic attributive adjectives/nouns — common in "…and key details?"
    # style prompts; must never be captured as a person's name
    "key", "such", "various", "important", "certain", "specific", "relevant",
    "particular", "related", "other", "your", "any", "a", "an", "or",
}

# Words that strongly hint the preceding word is a person's name: "X crime
# records?", "X's case history", "records of X".
_PERSON_HINT_AFTER = {
    "crime", "crimes", "record", "records", "case", "cases", "fir", "firs",
    "complaint", "complaints", "criminal", "criminals", "offender",
    "offenders", "suspect", "suspects", "victim", "profile", "dossier",
    "dossiers", "history", "file", "files", "narrative", "details",
    "detail", "activity", "activities", "information", "info", "ioc",
}
_PERSON_HINT_BEFORE = {
    "named", "called", "about", "for", "of", "on", "regarding", "with",
    "against", "involving", "involves", "involve", "says", "who", "whom",
    "is", "are", "was", "were", "am", "be", "does", "has",
}

# Superlative/comparative questions ("which district has the highest crime
# rate?") get a direct ranked answer synthesized from numeric context lines.
_SUPERLATIVE_WORDS = (
    "highest", "high", "most", "top", "maximum", "max", "peak", "largest",
    "biggest", "lowest", "least", "minimum", "rank", "ranking", "compare",
)
_ASC_ORDER_WORDS = ("lowest", "least", "minimum")
_MAX_RANKED_BULLETS = 5
_TRAILING_LABEL_WORDS = {
    "has", "have", "with", "for", "of", "accounts", "record", "records",
    "registered", "total", "count", "is", "are", "at", "about", "and", "the", "in",
}

# Loose domain synonyms so recall survives wording differences between the
# question and database phrasing ("criminal rate" ↔ "registered crime cases").
_SYNONYMS: dict[str, tuple[str, ...]] = {
    "criminal": ("crime", "case", "offender", "suspect"),
    "crime": ("criminal", "case", "fir"),
    "rate": ("count", "total", "number", "cases", "statistic"),
    "district": ("area", "region"),
    "fir": ("case",),
    "victim": ("complainant",),
    "officer": ("police", "badge"),
    "gang": ("network", "organization"),
    # Generic analytics wording (issue #203: "what are the statistics?" used to
    # refuse because no section literally contained the word "statistics").
    "statistics": ("crime", "cases", "breakdown", "district", "category", "rate", "total"),
    "stats": ("statistics", "crimes", "cases", "breakdown", "district", "category", "rate"),
    "overview": ("summary", "statistics", "breakdown", "total"),
    "dashboard": ("summary", "statistics", "breakdown", "total"),
    "summary": ("statistics", "total", "breakdown"),
}

# Distribution lines emitted by the analytics engine ("District Bengaluru Urban
# has 20 registered crime cases", "Category Cyber Crime accounts for 15 cases").
# Used to answer per-area/per-category count questions from the REAL totals
# instead of counting whichever rows happened to be retrieved (issue #203).
_DISTRIBUTION_PATTERNS = (
    re.compile(r"\b([A-Za-z][A-Za-z .\-']{1,40})\s+has\s+(\d[\d,]*)\s+registered\b", re.I),
    re.compile(r"\b([A-Za-z][A-Za-z .\-']{1,40})\s+accounts\s+for\s+(\d[\d,]*)\s+cases?\b", re.I),
)

_GREETING_MESSAGE = (
    "I'm SAKSHA AI, your crime intelligence assistant. "
    "Ask me about cases, FIRs, criminals, suspects, officers, crime statistics, "
    "hotspots or district forecasts — I will pull the answers directly from the Saksha database."
)

_FOOTER_MESSAGE = (
    "Source: Saksha Database. Verify details against official records before taking action."
)

# Record identity extraction for cross-source de-duplication (vector retrieval
# and structured fetches often return the SAME FIR/case/person).
_RECORD_PATTERNS = (
    # Leading ID token that must contain a digit ("FIR-789/MYS/2026",
    # "1234/2026", "CR-2026-MYS-001" once its label prefix is stripped).
    re.compile(r"^[a-z0-9][a-z0-9/\-]*\d[a-z0-9/\-]*", re.IGNORECASE),
    re.compile(r"\bfir[\s:#-]*(?:no\.?\s*)?([a-z0-9/\-]*\d[a-z0-9/\-]*)", re.IGNORECASE),
    re.compile(r"(?:full name|criminal name|officer|victim name|officer name|name)\s*[:=]\s*([^|·\n.]+)", re.IGNORECASE),
)
# Leading "Label:" values that are fields, not person names — never used as identity.
_NON_NAME_LEADING_LABELS = {
    "fir", "fir number", "case", "case number", "case no", "status", "priority",
    "progress", "sections", "narrative", "filed", "complainant", "type",
    "evidence", "evidence title", "evidence type", "storage path", "description",
    "total", "source", "risk", "aliases", "ipc bns sections",
}
_LEADING_LABEL_RE = re.compile(r"^([A-Za-z][A-Za-z .'\-/]{1,38}):")


def _record_signature(line: str) -> str:
    """Stable identifier for a record line so duplicates collapse."""
    # Strip leading record-label prefixes so "FIR Number: 1234/2026" and
    # "FIR Number: FIR-789/MYS/2026" expose their real IDs to the patterns.
    cleaned = re.sub(r"^(?:fir|crime case|case)\s*(?:number|no\.?|id)?\s*[:#\-]\s*", "", line, flags=re.IGNORECASE)
    for pattern in _RECORD_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            value = match.group(1) if match.groups() else match.group(0)
            signature = re.sub(r"[^a-z0-9]", "", value.lower())
            if len(signature) >= 3:
                return signature
    leading = _LEADING_LABEL_RE.match(line)
    if leading and leading.group(1).strip().lower() not in _NON_NAME_LEADING_LABELS:
        return re.sub(r"[^a-z0-9]", "", leading.group(1).lower())
    return ""


def _strip_markdown(text: str) -> str:
    """Chat panels render plain text — strip every markdown decoration."""
    text = re.sub(r"\*+", "", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"`+", "", text)
    text = re.sub(r"^---+$", "", text, flags=re.MULTILINE)
    return text.strip()


_PLATFORM_Q_RE = re.compile(
    r"\b(?:what\s+is|about|tell\s+me\s+about|describe|explain|purpose|goal|"
    r"who\s+(?:made|built|developed)|how\s+(?:does|do|did)|why\s+(?:is|was|are)|"
    r"architecture|tech\s+stack|features|capabilities|modules)\b"
    r".*?\b(?:saksha|platform|system|application|project|tool|crime\s+intelligence)\b",
    re.I,
)
_PLATFORM_KNOWLEDGE_RE = re.compile(
    r"SAKSHA PROJECT OVERVIEW.*?(?=RESPONSE FORMAT GUIDELINES|\Z)", re.S,
)
_PLATFORM_Q_LEAD = re.compile(
    r"^(?:what\s+is|about|tell\s+me\s+about|describe|explain|purpose|goal|overview)\b",
    re.I,
)
_PLATFORM_WORDS = {"saksha", "platform", "system", "application", "project", "crime intelligence"}


def _is_platform_question(message: str) -> bool:
    if _PLATFORM_Q_RE.search(message):
        return True
    lower = message.lower()
    if _PLATFORM_Q_LEAD.match(lower):
        return any(w in lower for w in _PLATFORM_WORDS)
    return False


_CASE_ID_RE = re.compile(r"CR-\d{4}-[A-Z]{2,4}-\d+", re.I)
_FIR_ID_RE = re.compile(
    r"FIR[-\s]*:?\s*("
    r"\d{1,4}/[A-Z]{1,20}/\d{4}"
    r"|[A-Z]{1,16}-?\d{1,6}[A-Z0-9-]*/\d{4}"
    r"|\d{1,4}/\d{4}"
    r")",
    re.I,
)


def _has_concrete_reference(message: str) -> bool:
    """True when the message names a concrete record (case/FIR number).

    A user who cites a specific case or FIR is querying data — never asking
    about the platform itself — so those messages must not fall back to
    platform-knowledge framing when referencing an actual record.
    """
    return bool(_CASE_ID_RE.search(message)) or bool(_FIR_ID_RE.search(message))


def _extract_platform_knowledge(system_prompt: str) -> str:
    """Extracts the SAKSHA PROJECT OVERVIEW section from the system prompt."""
    match = _PLATFORM_KNOWLEDGE_RE.search(system_prompt)
    if match:
        return match.group(0).strip()
    return ""


class LLMGenerator:
    """Generates responses using an external LLM or a local relevance-focused fallback.

    Failover chain: every configured Groq key (primary, highest limits) → the
    next provider's key(s) → local template generation. A single answer is
    never stitched together from two providers: once a provider has streamed
    output, a later failure simply stops generation.
    """

    def __init__(self) -> None:
        self._transport = None  # test seam for httpx.MockTransport
        self._chain = self._provider_chain()
        self.provider = self._chain[0] if self._chain else "local"
        self.model = self._model_for(self.provider)
        # Engine that actually produced the most recent answer ("local-template"
        # when every provider failed) — the UI badge must reflect reality.
        self.last_engine: str = "local-template" if not self._chain else f"{self.provider}/{self.model}"

    @staticmethod
    def _parse_keys(value: str | None) -> list[str]:
        """Parses a comma-separated API key list ("key1,key2") into clean keys."""
        if not value:
            return []
        return [part.strip() for part in re.split(r"[,;]", value) if part.strip()]

    @classmethod
    def _provider_keys(cls, provider: str) -> list[str]:
        keys = cls._parse_keys(getattr(settings, _PROVIDER_KEY_ATTR[provider], None))
        return keys

    @classmethod
    def _provider_chain(cls) -> list[str]:
        requested = (settings.LLM_PROVIDER or "auto").strip().lower()
        if requested == "local":
            return []
        if requested in _PROVIDER_PRIORITY:
            return [requested] if cls._provider_keys(requested) else []
        return [name for name in _PROVIDER_PRIORITY if cls._provider_keys(name)]

    @classmethod
    def _model_for(cls, provider: str) -> str:
        explicit_model = (settings.LLM_MODEL or "").strip()
        if explicit_model and provider != "local":
            return explicit_model
        return getattr(settings, _PROVIDER_MODEL_ATTR.get(provider, "GEMINI_MODEL"))

    async def generate(
        self,
        message: str,
        context_block: str,
        system_prompt: str,
        history: list[dict[str, str]] | None = None,
    ) -> AsyncIterator[str]:
        produced = False
        for provider in self._chain:
            try:
                async for chunk in self._generate_via(provider, message, context_block, system_prompt, history):
                    produced = True
                    self.last_engine = f"{provider}/{self._model_for(provider)}"
                    yield chunk
                return
            except _ProviderExhausted:
                if produced:
                    # Partial answer already streamed — never stitch two providers.
                    return
                continue
        self.last_engine = "local-template"
        async for chunk in self._generate_local(message, context_block, system_prompt):
            yield chunk

    async def _generate_via(
        self,
        provider: str,
        message: str,
        context: str,
        system: str,
        history: list[dict[str, str]] | None,
    ) -> AsyncIterator[str]:
        if provider in ("groq", "openai"):
            url = _GROQ_URL if provider == "groq" else _OPENAI_URL
            async for chunk in self._stream_openai_compatible(
                url=url,
                api_keys=self._provider_keys(provider),
                model=self._model_for(provider),
                message=message,
                context=context,
                system=system,
                history=history,
            ):
                yield chunk
            return
        if provider == "gemini":
            async for chunk in self._stream_gemini(message, context, system, history):
                yield chunk
            return
        raise _ProviderExhausted(f"Unknown provider: {provider}")

    # ── Groq / OpenAI (OpenAI-compatible SSE with key rotation) ──────────

    async def _stream_openai_compatible(
        self,
        url: str,
        api_keys: list[str],
        model: str,
        message: str,
        context: str,
        system: str,
        history: list[dict[str, str]] | None,
    ) -> AsyncIterator[str]:
        messages = [{
            "role": "system",
            "content": system + "\n\n--- RETRIEVED CONTEXT ---\n" + context + "\n--- END CONTEXT ---",
        }]
        if history:
            for msg in history[-_HISTORY_LIMIT:]:
                role = msg.get("role", "user")
                messages.append({"role": "assistant" if role == "assistant" else "user", "content": msg.get("content", "")})
        messages.append({"role": "user", "content": message})

        payload = {"model": model, "messages": messages, "stream": True, "temperature": settings.LLM_CHAT_TEMPERATURE, "max_tokens": settings.LLM_CHAT_MAX_TOKENS}

        for index, api_key in enumerate(api_keys):
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            try:
                async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT, transport=self._transport) as client:
                    async with client.stream("POST", url, json=payload, headers=headers) as response:
                        if response.status_code >= 400:
                            await response.aread()
                            if response.status_code in _KEY_EXHAUSTED_STATUSES and index < len(api_keys) - 1:
                                continue  # key limit reached — rotate to next key
                            raise _ProviderExhausted(f"{url} returned HTTP {response.status_code}")
                        async for line in response.aiter_lines():
                            if not line.startswith("data: "):
                                continue
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                delta = data.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue
                        return
            except _ProviderExhausted:
                raise
            except Exception as exc:
                raise _ProviderExhausted(f"{url} failed: {exc}") from exc
        raise _ProviderExhausted(f"All {len(api_keys)} key(s) exhausted for {url}")

    # ── Gemini ────────────────────────────────────────────────────────────

    async def _stream_gemini(
        self, message: str, context: str, system: str, history: list[dict[str, str]] | None,
    ) -> AsyncIterator[str]:
        contents = []
        if history:
            for msg in history[-_HISTORY_LIMIT:]:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})
        full_user_msg = f"{system}\n\n--- RETRIEVED CONTEXT ---\n{context}\n--- END CONTEXT ---\n\nUser Question: {message}"
        contents.append({"role": "user", "parts": [{"text": full_user_msg}]})

        gemini_keys = self._provider_keys("gemini")
        url = _GEMINI_URL.format(model=self._model_for("gemini"), key=gemini_keys[0] if gemini_keys else "")
        payload = {"contents": contents, "generationConfig": {"temperature": settings.LLM_CHAT_TEMPERATURE, "maxOutputTokens": settings.LLM_CHAT_MAX_TOKENS}}

        try:
            async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT, transport=self._transport) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code >= 400:
                        await response.aread()
                        raise _ProviderExhausted(f"Gemini returned HTTP {response.status_code}")
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                candidates = data.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    for part in parts:
                                        text = part.get("text", "")
                                        if text:
                                            yield text
                            except json.JSONDecodeError:
                                continue
        except _ProviderExhausted:
            raise
        except Exception as exc:
            raise _ProviderExhausted(f"Gemini failed: {exc}") from exc

    # ── Local fallback ────────────────────────────────────────────────────

    async def _generate_local(
        self, message: str, context: str, system: str,
    ) -> AsyncIterator[str]:
        # 1. Conversational / non-data replies come first: they require no
        #    database context and should never be mangled into a record list.
        conversation = self._conversation_reply(message)
        if conversation:
            async for chunk in self._stream_text(conversation):
                yield chunk
            return

        tokens = self._query_tokens(message)
        if not tokens:
            async for chunk in self._stream_text(_GREETING_MESSAGE):
                yield chunk
            return

        sections = self._useful_sections(context)

        # Honesty gate: if the question names a specific person and that name
        # appears in NO retrieved record, say so rather than dumping aggregate
        # statistics that merely share a keyword (issue #203).
        missing_person = self._named_person_not_in_context(message, sections)
        if missing_person:
            full_response = "\n".join([
                f"I could not find any records for **{missing_person}** in the Saksha database.",
                f"Double-check the spelling, or share a case/FIR number and I'll look again.\n\n{_FOOTER_MESSAGE}",
            ]).strip()
            async for chunk in self._stream_text(full_response):
                yield chunk
            return

        if not sections:
            # No database records — try to answer from system prompt knowledge
            # (project overview, general Saksha info).
            if _is_platform_question(message) and not _has_concrete_reference(message):
                platform_knowledge = _extract_platform_knowledge(system)
                if platform_knowledge:
                    answer = (
                        f"**SAKSHA — Crime Intelligence & Analytical Platform**\n\n"
                        f"{platform_knowledge}\n\n"
                        f"{_FOOTER_MESSAGE}"
                    )
                    async for chunk in self._stream_text(answer):
                        yield chunk
                    return
            async for chunk in self._stream_text(_REFUSAL_MESSAGE):
                yield chunk
            return

        scored = []
        for header, lines in sections:
            # Header tokens count toward each line's score so a section whose
            # title matches the question ("Dossiers") surfaces its records.
            line_scores = [self._line_score(f"{header}\n{line}", tokens) for line in lines]
            scored.append((sum(line_scores), max(line_scores), header, lines, line_scores))

        # The clock/recency sections are only relevant to temporal questions;
        # otherwise they are metadata noise inside record lists.
        temporal = any(token in _TEMPORAL_WORDS for token in tokens)
        scored = [item for item in scored if item[2] != _SYSTEM_CLOCK_HEADER or temporal]
        if not scored:
            async for chunk in self._stream_text(_REFUSAL_MESSAGE):
                yield chunk
            return

        # Which entity type the question actually targets (officer/criminal/fir/
        # case/victim). Answers are then shaped around that kind instead of
        # whichever record happened to score highest (issue #203).
        focus_kind = self._query_target_kind(message)

        # Question-type awareness: the response shape follows the KIND of
        # question asked, not merely which context lines match (issue #203).
        intent = self._classify_question(message)

        # When the user pins an exact case/FIR number ("Tell me about case
        # CR-2026-BLR-3954 …"), only that exact record satisfies them. If the
        # retrieved context lacks it, say so instead of dumping whichever
        # keyword-similar case cropped up in retrieval. This leafs out the
        # "could not find any records for **key**" bug: the personal-name
        # honesty gate is skipped for numbered lookups (see
        # _named_person_not_in_context) and the straight missing-number answer
        # is emitted here.
        explicit_id = self._explicit_record_id(message)
        if explicit_id and not self._sections_have_record(sections, focus_kind or "", explicit_id):
            noun = {
                "fir": "FIR", "case": "case", "criminal": "criminal",
                "officer": "officer", "victim": "victim",
            }.get(focus_kind or "", "record")
            article = "an" if focus_kind == "officer" else "a"
            full_response = "\n".join([
                f"I could not find {article} {noun} record matching **{explicit_id}** in the Saksha database.",
                f"Double-check the number and I'll take another look.\n\n{_FOOTER_MESSAGE}",
            ]).strip()
            async for chunk in self._stream_text(full_response):
                yield chunk
            return

        positive = [item for item in scored if item[0] > 0]

        if not positive:
            # No retrieved record actually matched the words of the question.
            # A real ground-truth-only assistant does not echo keywords back or
            # dump whatever partially scored — it is honest about the miss and
            # naturally surfaces what the retrieved (vector/RAG) context DOES
            # cover, so the user can steer (issue #203).
            lead = {
                "count": "I could not find a live count in the Saksha database that answers that.",
                "field": "I could not find that detail in the Saksha database.",
                "profile": "I could not find a matching record in the Saksha database.",
                "rank": "I could not produce that ranking from the Saksha database.",
                "generic": "I could not find anything in the Saksha database that directly answers that question.",
            }[intent]
            coverage = self._context_coverage(sections)
            if coverage:
                response_parts: list[str] = [
                    lead, "",
                    f"The records I have on hand cover {coverage}. "
                    f"Tell me which of those you'd like and I'll pull the specifics.",
                ]
            else:
                response_parts = [lead, "", _REFUSAL_MESSAGE]
            full_response = "\n".join(response_parts).strip()
            async for chunk in self._stream_text(full_response):
                yield chunk
            return

        kept = positive if len(positive) >= 2 or (positive and temporal) else scored
        if temporal:
            # Time-window questions are answered ONLY by the clock/recency
            # sections — timeless dossiers/stats would bury the actual answer.
            windowed = [
                item for item in scored
                if item[2] == _SYSTEM_CLOCK_HEADER or _RECENT_ACTIVITY_MARK in item[2].lower()
            ]
            if windowed:
                kept = windowed
        kept.sort(key=lambda item: (-item[0],))

        # 2. ANSWER THE ACTUAL QUESTION instead of blindly dumping records:
        #    counts, field lookups (status/progress/when/where), and specific
        #    entity profiles are much more useful than a raw list.
        distribution_answer = self._distribution_count_answer(message, kept)
        if distribution_answer:
            async for chunk in self._stream_text(distribution_answer):
                yield chunk
            return

        count_answer = self._count_answer(message, kept, temporal, focus_kind)
        if count_answer:
            async for chunk in self._stream_text(count_answer):
                yield chunk
            return

        # Profile-style prompts ("Tell me about case CR-… + status, priority,
        # key details") must surface the FULL dossier, not just the first
        # field the classifier happens to spot. Ask for a dossier (or name two
        # fields at once) → try the profile before a single-field answer.
        if self._wants_full_profile(message):
            full_answer = self._entity_profile_answer(message, kept, temporal, focus_kind)
            if full_answer:
                async for chunk in self._stream_text(full_answer):
                    yield chunk
                return

        field_answer = self._field_answer(message, kept, temporal, focus_kind)
        if field_answer:
            async for chunk in self._stream_text(field_answer):
                yield chunk
            return

        entity_answer = self._entity_profile_answer(message, kept, temporal, focus_kind)
        if entity_answer:
            async for chunk in self._stream_text(entity_answer):
                yield chunk
            return

        ranked_answer = self._build_ranked_answer(message, kept, temporal)
        if ranked_answer:
            async for chunk in self._stream_text(ranked_answer):
                yield chunk
            return

        # 3. General multi-record answer: a friendly lead-in followed by the
        #    deduplicated records rendered as clean bullet points.
        records = self._dedupe_lines(kept, _MAX_CONTEXT_LINES, temporal, focus_kind)
        if records:
            if (
                focus_kind
                and self._is_specific_entity_request(message)
                and not any(
                    LLMGenerator._record_kind(LLMGenerator._parse_record(line)) == focus_kind
                    for line in records
                )
            ):
                noun = {
                    "fir": "FIR", "case": "case", "criminal": "criminal",
                    "officer": "officer", "victim": "victim",
                }.get(focus_kind, "record")
                article = "an" if focus_kind == "officer" else "a"
                full_response = "\n".join([
                    f"I could not find {article} {noun} record matching that in the Saksha database.",
                    f"Double-check the name or number and I'll take another look.\n\n{_FOOTER_MESSAGE}",
                ]).strip()
                async for chunk in self._stream_text(full_response):
                    yield chunk
                return
            response_parts: list[str] = self._list_intro(message, len(records)) + [""]
            for i, line in enumerate(records, 1):
                response_parts.append(f"{i}. {self._format_line(line)}")
            response_parts.append("")
            response_parts.append(_FOOTER_MESSAGE)
            full_response = "\n".join(response_parts).strip()
            async for chunk in self._stream_text(full_response):
                yield chunk
            return

        async for chunk in self._stream_text(_REFUSAL_MESSAGE):
            yield chunk

    # -- Conversational helpers -------------------------------------------------

    @staticmethod
    def _conversation_reply(message: str) -> str | None:
        """Returns a natural reply for greetings/thanks/capability questions
        that are NOT database lookups. Returns None when the message should be
        treated as a data query."""
        cleaned = message.strip().lower().rstrip("?.!")
        words = [w.strip(".,!?;:") for w in message.lower().split()]
        words = [w for w in words if w]

        if not words:
            return _GREETING_MESSAGE

        # Gratitude / acknowledgement phrases ("thanks", "thank you", "thanks
        # for the help", "ok thanks") — even when extra connective words are
        # present, these are pure social replies, never data queries.
        if any(w in words for w in ("thanks", "thank", "thx", "ty", "gratitude")):
            return "You're welcome! Anything else you'd like me to pull from the Saksha database — cases, FIRs, criminals, or crime trends?"
        if any(w in words for w in ("bye", "goodbye", "goodnight")):
            return "Stay safe — I'm here whenever you need another look at the Saksha data."

        # Pure smalltalk (handles "hi", "hello", "ok", "good morning" etc.).
        core = [w for w in words if w not in _STOPWORDS]
        if 0 < len(words) <= 6 and all(w in _SMALLTALK for w in words):
            if any(w in {"hello", "hi", "hey", "yo", "namaste"} for w in words) and not any(w in {"crime", "case", "fir", "criminal"} for w in core):
                return _GREETING_MESSAGE
            return "Glad to help. Ask me about cases, FIRs, criminals, officers, crime statistics, hotspots or district forecasts."

        # Who / what are you
        if "who" in core and any(w in {"you", "are", "r"} for w in words):
            return (
                "I'm **SAKSHA AI**, the intelligence assistant for the Karnataka State Police platform. "
                "I can look up cases, FIRs, criminals, victims, officers and live statistics straight from the "
                "Saksha database, and I'll always cite the records I use. What would you like me to check?"
            )
        # What can you do / help
        if any(w in {"capabilities", "modules", "features"} for w in words) or cleaned in {
            "what can you do", "help", "what do you do", "how do you work", "what can you help with",
        }:
            return (
                "I can help you with the crime intelligence in Saksha. A few things I do well:\n\n"
                "- **Cases & FIRs** — pull case numbers, status, priority, sections and linked suspects.\n"
                "- **Criminals & offenders** — profile a person, their aliases, gang and linked cases.\n"
                "- **Statistics** — district and category breakdowns, trends and hotspots.\n"
                "- **Predictions** — district risk and 6-month crime forecasts.\n\n"
                "Try asking something like *\"Show case CR-2026-MYS-001\"* or *\"Which district has the most crime?\"*"
            )
        return None

    @staticmethod
    def _is_count_question(message: str) -> bool:
        lower = message.lower()
        return any(p in lower for p in (
            "how many", "number of", "count", "total number", "how much",
        ))

    @staticmethod
    def _count_answer(message: str, kept: list, temporal: bool = False, focus_kind: str | None = None) -> str | None:
        """Answers 'how many' type questions with a concrete number."""
        if not LLMGenerator._is_count_question(message):
            return None
        records = LLMGenerator._dedupe_records(kept, temporal, focus_kind)
        if not records:
            return None
        tokens = [t.rstrip("s") for t in LLMGenerator._query_tokens(message)]
        subject = LLMGenerator._count_subject(message)
        kind = LLMGenerator._kind_for_subject(subject)
        # Narrow by subject type first, then by the query tokens.
        pool = records
        if kind is not None:
            pool = [r for r in records if LLMGenerator._record_kind(r) == kind]
        if not pool:
            pool = [r for r in records if LLMGenerator._line_score(LLMGenerator._record_text(r), tokens) > 0]
        if not pool:
            pool = records
        count = len(pool)
        matched = [r for r in pool if LLMGenerator._line_score(LLMGenerator._record_text(r), tokens) > 0]
        if matched and len(matched) < len(pool):
            count = len(matched)
        lead = "I found" if LLMGenerator._line_score(subject, tokens) or matched else "There are"
        noun = subject if count != 1 else subject.rstrip("s")
        return (
            f"{lead} **{count}** {noun} in the Saksha database matching your query."
            + f"\n\n{_FOOTER_MESSAGE}"
        )

    @staticmethod
    def _count_subject(message: str) -> str:
        lower = message.lower()
        for word in ("firs", "crimes", "cases", "criminals", "victims", "officers", "notifications", "anomalies"):
            if word in lower:
                return word
        return "records"

    @staticmethod
    def _named_district_or_category(lower: str) -> tuple[str, str] | None:
        """Returns ('district'|'category', canonical lower-case name) when the
        message explicitly names a Karnataka district or crime category."""
        for label in sorted(_KARNATAKA_DISTRICTS, key=len, reverse=True):
            if label.lower() in lower:
                return "district", label.lower()
        for label in sorted(_CRIME_CATEGORIES, key=len, reverse=True):
            if re.search(rf"\b{re.escape(label)}\b", lower):
                return "category", label.lower()
        return None

    @staticmethod
    def _label_dimension(label: str) -> str | None:
        """Classifies a distribution label as district/category (or None)."""
        low = label.lower()
        if any(district.lower() in low or low in district.lower() for district in _KARNATAKA_DISTRICTS):
            return "district"
        if any(category.lower() in low or low in category.lower() for category in _CRIME_CATEGORIES):
            return "category"
        return None

    @staticmethod
    def _question_dimension(message: str) -> str | None:
        """Infers whether a question is asking for a district- or category-level
        breakdown ('which district has the highest crime?' → district)."""
        lower = message.lower()
        if LLMGenerator._named_district_or_category(lower):
            return LLMGenerator._named_district_or_category(lower)[0]
        if re.search(r"\b(?:district|districts|area|region)\b", lower):
            return "district"
        if re.search(r"\b(?:category|categories|crime|criminal)\b", lower):
            return "category"
        return None

    @staticmethod
    def _distribution_count_answer(message: str, kept: list) -> str | None:
        """Answers 'how many <thing> in <named district/category>?' from the
        analytics distribution lines ('District Bengaluru Urban has 20 registered
        crime cases'), i.e. from the REAL per-area totals rather than the number
        of record rows that happened to be retrieved (issue #203)."""
        lower = message.lower()
        if not LLMGenerator._is_count_question(message):
            return None
        target = LLMGenerator._named_district_or_category(lower)
        if not target:
            return None
        dimension, name = target
        for _total, _max_score, _header, lines, _line_scores in kept:
            for line in lines:
                for pattern in _DISTRIBUTION_PATTERNS:
                    match = pattern.search(line)
                    if not match:
                        continue
                    raw_label = re.sub(
                        r"^(?:district|category|area|region)\s+", "", match.group(1), flags=re.I,
                    ).strip()
                    number = int(match.group(2).replace(",", ""))
                    label = raw_label.lower()
                    if not (
                        label.startswith(name) and (len(label) == len(name) or label[len(name)] in " ()-")
                    ):
                        continue
                    if LLMGenerator._label_dimension(raw_label) != dimension:
                        continue
                    noun = "case" if number == 1 else "cases"
                    return (
                        f"**{raw_label}** has **{number}** {noun} on record in the Saksha database."
                        + f"\n\n{_FOOTER_MESSAGE}"
                    )
        return None

    @staticmethod
    def _field_answer(message: str, kept: list, temporal: bool = False, focus_kind: str | None = None) -> str | None:
        """Answers field-specific questions (status/progress/when/where/who)."""
        lower = message.lower()
        # Ranking/comparison questions ("which district has the most crime
        # cases?") must reach the ranked path instead of collapsing into one
        # random record's field (issue #203).
        if set(LLMGenerator._query_tokens(message)) & set(_SUPERLATIVE_WORDS):
            return None
        field = None
        if any(w in lower for w in ("status", "state of", "condition")):
            field = "status"
        elif any(w in lower for w in ("progress", "how far", "investigation progress")):
            field = "progress"
        elif any(w in lower for w in ("when", "date", "filed on", "occurred")):
            field = "date"
        elif any(w in lower for w in ("where", "location", "district", "area")):
            field = "location"
        if field is None:
            return None

        records = LLMGenerator._dedupe_records(kept, temporal, focus_kind)
        if not records:
            return None
        # Pick the record that best matches the question tokens.
        tokens = [t.rstrip("s") for t in LLMGenerator._query_tokens(message)]
        records.sort(key=lambda r: -LLMGenerator._line_score(LLMGenerator._record_text(r), tokens))
        best = records[0]
        text = LLMGenerator._record_text(best)
        # Keep only field/values that are non-trivial and reasonably short.
        kept_bits = []
        for key, val in LLMGenerator._field_pairs(best):
            key_l = key.lower()
            if field == "status" and key_l in ("status", "case status", "fir status", "state"):
                kept_bits.append(f"Status: {val}")
            elif field == "progress" and "progress" in key_l:
                kept_bits.append(f"Progress: {val}")
            elif field == "location" and key_l in ("location", "district", "station", "area", "place", "region"):
                kept_bits.append(f"{key}: {val}")
            elif field == "date" and key_l in ("occurred", "reported", "filed", "filed at", "date", "occurred at", "reported at"):
                kept_bits.append(f"{key}: {val}")
        if not kept_bits:
            return None
        ident = LLMGenerator._record_ident(best) or "this record"
        return (
            f"Here's what the database shows for **{ident}**:\n\n"
            + "\n".join(f"- **{k}**: {v}" for k, v in (b.split(": ", 1) for b in kept_bits))
            + f"\n\n{_FOOTER_MESSAGE}"
        )

    @staticmethod
    def _entity_profile_answer(message: str, kept: list, temporal: bool = False, focus_kind: str | None = None) -> str | None:
        """Builds a clean profile for a specific named/id'd entity.

        Only fires when the message clearly targets one entity (an explicit id,
        a named person, or a short 'tell me about X' request); blanket analytics
        questions never collapse into a single-entity profile.

        When the question names a record kind (officer/criminal/fir/case/victim)
        the candidate pool is narrowed to THAT kind first, so an officer query is
        never answered with a random case record that merely mentions the
        officer's name (issue #203).
        """
        tokens = [t.rstrip("s") for t in LLMGenerator._query_tokens(message)]
        if not tokens:
            return None
        records = LLMGenerator._dedupe_records(kept, temporal, focus_kind)
        if not records:
            return None
        if focus_kind:
            candidates = [r for r in records if LLMGenerator._record_kind(r) == focus_kind]
            if not candidates:
                return None
            records = candidates
        records.sort(key=lambda r: -LLMGenerator._line_score(LLMGenerator._record_text(r), tokens))
        best = records[0]
        if not LLMGenerator._mentions_specific_entity(message, best):
            return None
        pairs = LLMGenerator._field_pairs(best)
        if len(pairs) < 2:
            return None
        ident = LLMGenerator._record_ident(best)
        if not ident:
            return None
        lines = [f"Here's the profile I found for **{ident}**:", ""]
        for key, val in pairs[:12]:
            if key == "_id":
                continue
            if LLMGenerator._is_no_data_line(f"{key}: {val}"):
                continue
            if val.lower() in {"n/a", "na", "none", "-", ""}:
                continue
            lines.append(f"- **{key}**: {val}")
        lines += ["", _FOOTER_MESSAGE]
        return "\n".join(lines)

    @staticmethod
    def _wants_full_profile(message: str) -> bool:
        """True when the question asks for a dossier rather than one field:
        an explicit 'tell me about' / 'details' / 'profile' opener, or a single
        sentence naming two or more record fields (e.g. "What is the status,
        priority, and key details?"). Such multi-field prompts must not
        collapse into a lone field answer."""
        lower = message.lower()
        if any(phrase in lower for phrase in ("tell me about", "details", "profile", "info on", "info about", "show me", "describe")):
            return True
        fields = [w for w in (
            "status", "priority", "progress", "category", "location",
            "when", "where", "who", "date", "officer", "sections",
        ) if w in lower]
        return len(fields) >= 2

    @staticmethod
    def _is_specific_entity_request(message: str) -> bool:
        """True when the question targets ONE specific entity (an id, a named
        person, or 'tell me about X') rather than a collection/list of records.
        Used to decide whether a list answer may safely refuse when no record of
        the requested kind was retrieved (issue #203)."""
        lower = message.lower()
        if re.search(r"\b(?:show\s+all|list|all\s+the|every)\b", lower):
            return False
        if re.search(r"\b(?:cr|case|fir|if?r|no)[\s:-]{0,2}\d", lower) or re.search(r"\b\w{1,4}-\d{3,}\b", lower):
            return True
        if re.search(r"\b(?:about|profile|tell me about|details? on|info on|who is|what is)\b", lower):
            return True
        return False

    @staticmethod
    def _mentions_specific_entity(message: str, best: dict) -> bool:
        """True when the message points at one specific record (id, name, or a
        direct 'about <X>' / '<name>' request), not a broad analytics query."""
        lower = message.lower()
        # Explicit record id present in the message.
        if re.search(r"\b(?:cr|case|fir|if?r|no)[\s:-]{0,2}\d", lower) or re.search(r"\b\w{1,4}-\d{3,}", lower):
            return True
        ident = LLMGenerator._record_ident(best) or ""
        # A person/case name from the best record appears in the question.
        if ident and len(ident) >= 3 and ident.lower() in lower:
            return True
        if re.search(r"\b(?:about|profile|tell me about|details? on|info on|who is|what is)\b", lower):
            # Only a "specific" opener if followed by a noun, not "statistics/overview".
            if any(w in lower for w in ("statistics", "stats", "overview", "trend", "summary", "breakdown", "highest", "lowest", "most", "compare")):
                return False
            return True
        return False

    @staticmethod
    def _field_pairs(record: dict) -> list[tuple[str, str]]:
        """Flattens a parsed record dict to ('key', 'value') preserving order."""
        out: list[tuple[str, str]] = []
        for k, v in record.items():
            if isinstance(v, dict):
                for kk, vv in v.items():
                    out.append((kk, str(vv)))
            else:
                out.append((k, str(v)))
        return out

    @staticmethod
    def _record_text(record: dict) -> str:
        return " ".join(f"{k}: {v}" for k, v in LLMGenerator._field_pairs(record))

    @staticmethod
    def _record_ident(record: dict) -> str | None:
        """Best identity token for a record (id/case/fir/name/badge)."""
        # Leading bare identifier captured by _parse_record (e.g. "CR-2026-MYS-001").
        if record.get("_id"):
            return str(record["_id"]).strip()
        normalized = {k.lower().replace(" ", "_"): str(v) for k, v in LLMGenerator._field_pairs(record)}
        for key in ("case_number", "fir_number", "criminal_name", "full_name", "person_name",
                    "offender_name", "officer_name", "victim_name", "name", "badge_number",
                    "id", "record_id", "case", "fir"):
            if normalized.get(key, "").strip():
                return normalized[key].strip()
        return None

    @staticmethod
    def _record_kind(record: dict) -> str:
        """Classifies a parsed record as case/fir/criminal/victim/officer.

        Ordering matters:
        1. Leading _id is the strongest signal (CR- → case, FIR → fir).
        2. Case-specific keys (Case/Priority/Category/Progress) must be
           checked BEFORE criminal keys, because case records expose an
           'Accused/Suspects' column whose key contains 'accused' — which
           would incorrectly trigger criminal classification (issue #203).
        3. FIR keys checked before criminal keys for the same reason
           (FIR records expose 'Sections' and 'Accused/Suspects' columns).
        """
        _id = str(record.get("_id", "")).upper()
        if _id.startswith(("CR-", "CASE")):
            return "case"
        if _id.startswith("FIR"):
            return "fir"
        keys = [k.lower().replace(" ", "_") for k in record.keys()]
        if "fir_number" in keys or "complainant" in keys or "sections" in keys:
            return "fir"
        if any(k in ("officer", "officer_name", "badge", "badge_number") for k in keys):
            return "officer"
        if any("victim" in k or "complainant" in k for k in keys):
            return "victim"
        if any(k.startswith("case_") or k in ("case", "priority", "category") or "progress" in k for k in keys):
            return "case"
        if any(("criminal" in k or "offender" in k or "suspect" in k or "accused" in k) for k in keys):
            return "criminal"
        joined = " ".join(keys)
        if any(n in joined for n in ("aliases", "identifying_marks", "mo_", " marks")) and any(
            k in ("name", "person_name", "full_name") for k in keys
        ):
            return "criminal"
        return "record"

    @staticmethod
    def _kind_for_subject(subject: str) -> str | None:
        s = subject.lower().rstrip("s")
        if s == "case":
            return "case"
        if s in ("criminal", "offender", "suspect"):
            return "criminal"
        if s in ("fir",):
            return "fir"
        if s == "victim":
            return "victim"
        if s == "officer":
            return "officer"
        return None

    @staticmethod
    def _dedupe_lines(kept: list, cap: int, temporal: bool = False, focus_kind: str | None = None) -> list[str]:
        """Collects deduplicated, non-junk context lines up to a cap."""
        emitted = 0
        seen_signatures: set[str] = set()
        out: list[str] = []
        for _header, lines, line_scores in LLMGenerator._filtered_sections(kept, temporal, focus_kind):
            if emitted >= cap:
                break
            ranked = sorted(zip(lines, line_scores), key=lambda pair: -pair[1])
            for line, _score in ranked:
                if emitted >= cap:
                    break
                clean = _strip_markdown(line)
                if not clean:
                    continue
                signature = _record_signature(clean)
                if signature:
                    if signature in seen_signatures:
                        continue
                    seen_signatures.add(signature)
                emitted += 1
                out.append(clean)
        return out

    @staticmethod
    def _dedupe_records(kept: list, temporal: bool = False, focus_kind: str | None = None) -> list[dict]:
        """Parses raw lines into ordered field/values, deduped by signature."""
        seen: set[str] = set()
        records: list[dict] = []
        for _header, lines, line_scores in LLMGenerator._filtered_sections(kept, temporal, focus_kind):
            ranked = sorted(zip(lines, line_scores), key=lambda pair: -pair[1])
            for line, _score in ranked:
                clean = _strip_markdown(line)
                if not clean:
                    continue
                sig = _record_signature(clean)
                if sig:
                    if sig in seen:
                        continue
                    seen.add(sig)
                records.append(LLMGenerator._parse_record(clean))
        return [r for r in records if r]

    @staticmethod
    def _metadata_section(header: str) -> bool:
        """Headers that carry recency/clock noise rather than records."""
        lower = header.lower()
        return header == _SYSTEM_CLOCK_HEADER or _RECENT_ACTIVITY_MARK in lower

    @classmethod
    def _filtered_sections(
        cls,
        kept: list[tuple[int, int, str, list[str], list[int]]],
        temporal: bool = False,
        focus_kind: str | None = None,
    ) -> list[tuple[str, list[str], list[int]]]:
        """Narrows context sections for list/record rendering:
        - metadata sections are dropped unless the question is temporal;
        - sections that explicitly target one record kind (focus_kind) keep only
          lines whose relevance score is strictly positive, so a firm list is
          never diluted by unrelated records;
        - generic questions (no focus_kind) keep every non-metadata line, so a
          broad query such as 'show me all data' still surfaces whatever context
          exists instead of silently emptying the answer (issue #203 regression);
        - temporal questions always show the whole recency window — filtered
          highlights would drop 'New FIRs filed: 0'-style facts from the answer;
        - entity-kind lists never include aggregate-analytics sections ('Show all
          FIRs' must not answer with the summary line 'Total FIRs: 449') — unless
          the question is temporal, where the full recency window must survive;
        - sections matching the focused entity kind lead the answer;
        - when a focus section exists, non-focus sections must clear a higher
          relevance bar so a direct entity question is never buried in noise.
        """
        lenient = focus_kind is None or temporal
        gathered: list[tuple[str, list[str], list[int], list[tuple[str, int]]]] = []
        for _total, _max_score, header, lines, line_scores in kept:
            if not temporal and cls._metadata_section(header):
                continue
            if focus_kind is not None and not temporal and cls._is_aggregate_section(header):
                continue
            usable = [
                (line, score) for line, score in zip(lines, line_scores)
                if score > 0 or lenient
            ]
            if not usable:
                continue
            gathered.append((header, lines, line_scores, usable))
        focus_found = focus_kind is not None and any(
            cls._section_matches_kind(header, focus_kind) for header, *_ in gathered
        )
        out: list[tuple[str, list[str], list[int]]] = []
        for header, _lines, _scores, usable in gathered:
            if focus_found and not cls._section_matches_kind(header, focus_kind):
                usable = [(line, score) for line, score in usable if score >= 2]
            if not usable:
                continue
            out.append((header, [line for line, _ in usable], [score for _, score in usable]))
        if focus_kind is not None:
            out.sort(key=lambda item: not cls._section_matches_kind(item[0], focus_kind))
        return out

    @staticmethod
    def _section_matches_kind(header: str, kind: str | None) -> bool:
        """True when a section header belongs to the focused entity kind."""
        if not kind:
            return False
        lower = header.lower()
        if kind == "case":
            return re.search(r"\b(?:cases?|crime case|crime cases)\b", lower) is not None
        if kind == "fir":
            return re.search(r"\bfirs?\b", lower) is not None or "first information" in lower
        if kind == "criminal":
            return re.search(r"\b(?:criminals?|offenders?|dossiers?|suspects?)\b", lower) is not None or "gang" in lower
        if kind == "officer":
            return re.search(r"\b(?:officers?|police|badge)\b", lower) is not None
        if kind == "victim":
            return re.search(r"\b(?:victims?|complainants?|witnesses?)\b", lower) is not None
        return False

    @staticmethod
    def _extract_person_names(message: str) -> list[str]:
        """Pulls person-name candidates from a question.

        A word is treated as a person reference when it survives the noise set
        AND either starts with an uppercase letter (proper noun) or sits next to
        a strong hint ('X crime records?', 'cases involving X', 'named X').
        Running capitalized words are grouped into full names ('Ramu Swamy').
        """
        compact = re.sub(r"[^\w\s'-]", " ", message)
        compact = re.sub(r"(\w+)'(?:s|re|ve|d|m)\b", r" \1 ", compact)
        tokens = [t for t in compact.split() if t]
        names: list[str] = []
        i = 0
        while i < len(tokens):
            bare = tokens[i].strip("'-")
            low = bare.lower()
            if (
                len(bare) >= 3
                and not any(ch.isdigit() for ch in bare)
                and bare.isalnum()
                and low not in _NAME_NOISE
            ):
                nxt = tokens[i + 1].strip("'-").lower() if i + 1 < len(tokens) else ""
                prev = tokens[i - 1].strip("'-").lower() if i > 0 else ""
                highlighted = (
                    bare[0].isupper()
                    or nxt in _PERSON_HINT_AFTER
                    or prev in _PERSON_HINT_BEFORE
                )
                if highlighted:
                    j = i
                    while j + 1 < len(tokens):
                        nxt_bare = tokens[j + 1].strip("'-")
                        nxt_low = nxt_bare.lower()
                        if (
                            nxt_bare
                            and nxt_bare[0].isupper()
                            and nxt_low not in _NAME_NOISE
                            and len(nxt_bare) >= 3
                            and not any(ch.isdigit() for ch in nxt_bare)
                        ):
                            j += 1
                        else:
                            break
                    names.append(" ".join(t.strip("'-") for t in tokens[i:j + 1]))
                    i = j + 1
                    continue
            i += 1
        return names

    @classmethod
    def _named_person_not_in_context(
        cls, message: str, sections: list[tuple[str, list[str]]],
    ) -> str | None:
        """Returns a person's name when the question names a specific person
        whose name appears in NO retrieved record. The chat must answer 'I don't
        have that information' instead of dumping partially-matching aggregate
        statistics (issue #203) — a personal name is a strong relevance signal
        that a generic summary cannot satisfy."""
        if cls._has_explicit_record_id(message):
            # A numbered case/FIR is identified by its ID, not a personal name.
            # Stray generic words in prompts like "…and key details?" must never
            # be mistaken for a person and hijack the lookup (case-page Ask AI).
            return None
        names = cls._extract_person_names(message)
        if not names:
            return None
        haystack = ""
        for header, content in sections:
            haystack += " " + header + " " + " ".join(content)
        haystack = haystack.lower()
        for name in names:
            if name.lower() in haystack:
                return None  # this person exists in context — let the normal path answer
        return names[0]

    @staticmethod
    def _has_explicit_record_id(message: str) -> bool:
        """True when the question pins an exact FIR or case number (e.g.
        'CR-2026-MYS-001' or 'FIR 2026/104'). Mirrors the ID patterns used by
        _query_target_kind so the two decisions always agree."""
        return LLMGenerator._explicit_record_id(message) is not None

    @staticmethod
    def _explicit_record_id(message: str) -> str | None:
        """Returns the normalized exact case/FIR id a question pins (uppercase),
        or None. The honesty-gate skip and the ID-miss guard both use this, so
        the two decisions can never disagree."""
        fir = re.search(r"\bFIR[-\s]?\d{2,4}[\w/\-]*", message, re.IGNORECASE)
        if fir:
            return fir.group(0).upper()
        case = re.search(r"\bCR[-\s]?\d{4}[\w/\-]*", message, re.IGNORECASE)
        if case:
            return case.group(0).upper()
        return None

    @classmethod
    def _sections_have_record(cls, sections: list[tuple[str, list[str]]], focus_kind: str, explicit_id: str) -> bool:
        """Exact check that the retrieved context contains a record of the
        focus kind whose number equals the pinned case/FIR id. Keyword scoring
        is intentionally bypassed — if the user names the number, only that
        exact record satisfies them.

        Two matching rules, both confined to records of the right kind:
        1. normalized substring (strips '-', '/', ' ' so CR-2026-BLR-002 and
           'CR2026BLR002' agree), then
        2. digit-sequence substring (covers schema-style FIRs rendered as
           'FIR Number: 2026/104' where the 'FIR' prefix lives in the column
           name, not the value). A min-length guard avoids prefix collisions.
        """
        wanted = explicit_id.translate(str.maketrans("", "", "-/ "))
        wanted_digits = "".join(ch for ch in wanted if ch.isdigit())
        for _header, lines in sections:
            for line in lines:
                rec = cls._parse_record(line)
                if cls._record_kind(rec) != focus_kind:
                    continue
                values = [str(rec.get("_id") or "")]
                values += [str(v) for v in rec.values() if v is not None]
                blob = " ".join(values).upper().translate(str.maketrans("", "", "-/ "))
                if wanted in blob:
                    return True
                if len(wanted_digits) >= 5:
                    blob_digits = "".join(ch for ch in blob if ch.isdigit())
                    if wanted_digits in blob_digits:
                        return True
        return False

    @staticmethod
    def _classify_question(message: str) -> str:
        """Names the KIND of question being asked so answers are shaped by
        intent — counts stay counts, single fields stay single fields, and a
        broad query is never answered with one random profile (issue #203).

        One of:
        - 'count':   "how many …?" — a bare number is the right answer;
        - 'field':   single-attribute lookups (status/progress/when/where);
        - 'rank':    superlative/comparative ("which district has the most?");
        - 'profile': one specific named/id'd entity ("tell me about X");
        - 'generic': an open request for records (list / overview).
        """
        lower = message.lower()
        if LLMGenerator._is_count_question(message):
            return "count"
        if any(w in lower for w in (
            "status", "state of", "condition", "progress", "how far",
            "when", "date", "filed on", "occurred", "where", "location",
            "district", "area",
        )):
            return "field"
        if LLMGenerator._has_superlative_intent(message)[0]:
            return "rank"
        if LLMGenerator._is_specific_entity_request(message):
            return "profile"
        return "generic"

    @staticmethod
    def _query_target_kind(message: str) -> str | None:
        """Maps an entity word in the question to a record kind so answers focus
        on the requested entity type (issue #203: officer queries used to be
        answered with whichever record merely mentioned the officer's name).

        Explicit FIR/case number patterns override generic entity words like
        'suspects' — if a user says 'Show me FIR-789/MYS/2026 details and
        suspects' they want the FIR record, not a criminal profile."""
        lower = message.lower()
        if re.search(r"\bFIR[-\s]?\d{2,4}[-/]", message, re.IGNORECASE):
            return "fir"
        if re.search(r"\bCR[-\s]?\d{4}[-/]", message, re.IGNORECASE):
            return "case"
        if re.search(r"\b(?:officer|officers|police|badge|inspector|superintendent)\b", lower):
            return "officer"
        if re.search(r"\b(?:criminal|criminals|offender|offenders|suspect|suspects|accused)\b", lower):
            return "criminal"
        # 'complainant' is deliberately excluded: that wording usually asks for a
        # field of an FIR record, not for the victim profile itself.
        if re.search(r"\b(?:victim|victims|witness|witnesses)\b", lower):
            return "victim"
        if re.search(r"\bfirs?\b|\bfirst\s+information\b", lower):
            return "fir"
        if re.search(r"\bcases?\b|\bcomplaints?\b", lower):
            return "case"
        return None

    @staticmethod
    def _parse_record(line: str) -> dict:
        """Parses 'Key: Value | Key2: Value2' (or 'Key: Value') into an ordered dict.

        A leading bare token without a colon (e.g. 'CR-2026-MYS-001') is captured
        as the record's identifier under the '_id' key."""
        parts = [p.strip() for p in re.split(r"\s*\|\s*", line) if p.strip()]
        if not parts:
            return {}
        record: dict[str, str] = {}
        first = parts[0]
        if ":" not in first:
            record["_id"] = first
            parts = parts[1:]
        for part in parts:
            if ":" in part:
                key, _, val = part.partition(":")
                record[key.strip()] = val.strip()
            else:
                record.setdefault("value", part)
        return record if (record.get("_id") or len(record) > 0) else {}

    @staticmethod
    def _list_intro(message: str, count: int) -> list[str]:
        lower = message.lower()
        if _is_platform_question(message) and not _has_concrete_reference(message):
            return ["Here's what I found about Saksha:", ""]
        if any(w in lower for w in _TEMPORAL_WORDS):
            return [f"Here's what the Saksha database shows for that period ({count} details):", ""]
        if any(w in lower for w in ("criminal", "offender", "suspect", "gang")):
            return [f"Here are the criminal/offender records I found ({count}):", ""]
        if any(w in lower for w in ("fir", "first information")):
            return [f"Here are the FIR records I found ({count}):", ""]
        if any(w in lower for w in ("case", "complaint")):
            return [f"Here are the case records I found ({count}):", ""]
        if any(w in lower for w in ("officer", "police", "badge")):
            return [f"Here are the officer records I found ({count}):", ""]
        if any(w in lower for w in ("statistic", "trend", "overview", "district", "category", "rate")):
            return [f"Here's the breakdown I found in the database ({count} entries):", ""]
        return [f"Here's what I found in the Saksha database ({count} records):", ""]

    @staticmethod
    async def _stream_text(text: str) -> AsyncIterator[str]:
        """Yields typing-effect chunks while preserving EVERY newline and blank
        line — the chat UI's markdown renderer needs intact line breaks to lay
        out headings, lists and record rows (issue #124)."""
        import asyncio
        segments = re.findall(r"\S+\s*|\s+", text)
        if not segments:
            return
        chunk_size = max(5, len(segments) // 30)
        for i in range(0, len(segments), chunk_size):
            yield "".join(segments[i:i + chunk_size])
            await asyncio.sleep(0.01)

    @staticmethod
    def _is_smalltalk(message: str) -> bool:
        words = [w.strip(".,!?;:") for w in message.lower().split()]
        words = [w for w in words if w]
        return 0 < len(words) <= 4 and all(w in _SMALLTALK for w in words)

    @staticmethod
    def _query_tokens(message: str) -> list[str]:
        raw_tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9/\-]*", message.lower())
        tokens: list[str] = []
        for token in raw_tokens:
            if token in _STOPWORDS:
                continue
            if len(token) <= 2 and not any(ch.isdigit() for ch in token):
                continue
            if token not in tokens:
                tokens.append(token)
        return tokens

    @staticmethod
    def _split_sections(context: str) -> list[tuple[str, list[str]]]:
        sections: list[tuple[str, list[str]]] = []
        current_header = ""
        current_lines: list[str] = []
        for raw_line in context.split("\n"):
            line = raw_line.strip()
            if line.startswith("### "):
                if current_header or current_lines:
                    sections.append((current_header, current_lines))
                current_header = line[4:].strip()
                current_lines = []
                continue
            if not line:
                continue
            current_lines.append(line)
        if current_header or current_lines:
            sections.append((current_header, current_lines))
        return sections

    @classmethod
    def _useful_sections(cls, context: str) -> list[tuple[str, list[str]]]:
        useful = []
        for header, lines in cls._split_sections(context):
            content_lines = [
                line for line in lines
                if not cls._is_no_data_line(line) and not cls._is_junk_line(line)
            ]
            if content_lines:
                useful.append((header, content_lines))
        return useful

    @staticmethod
    def _is_aggregate_section(header: str) -> bool:
        """Headers that carry aggregate analytics (summaries, category/district
        breakdowns, forecasts) rather than concrete record lines. These must
        never leak into an entity-kind list answer ('Show all FIRs' is answered
        by FIR records, not by 'Total FIRs: 449'% statistics)."""
        return bool(re.search(
            r"(?:summary|statistics|comparison|breakdown|analytics\s+engine|forecast|hotspot)",
            header.lower(),
        ))

    @staticmethod
    def _context_coverage(sections: list[tuple[str, list[str]]]) -> str | None:
        """A natural phrase describing what the retrieved context covers, used
        when no record matched the user's words — a grounded assistant name-drops
        what it DOES hold instead of repeating the question back."""
        labels: list[str] = []
        for header, _lines in sections:
            lower = header.lower()
            if _RECENT_ACTIVITY_MARK in lower or lower == _SYSTEM_CLOCK_HEADER.lower():
                continue
            if "vector retrieval" in lower:
                label = "retrieved record snippets"
            elif "recent activity" in lower:
                continue
            elif "comparison" in lower:
                label = "district-by-district comparisons"
            elif "breakdown" in lower or "distribution" in lower:
                label = "category-by-category breakdowns"
            elif "summary" in lower or "statistics" in lower:
                label = "crime statistics"
            elif "network" in lower or "gang" in lower:
                label = "criminal network relationships"
            elif "hotspot" in lower:
                label = "hotspot predictions"
            elif "forecast" in lower:
                label = "district forecasts"
            elif "fir" in lower:
                label = "FIR records"
            elif "case" in lower:
                label = "crime case records"
            elif "criminal" in lower or "offender" in lower or "dossier" in lower:
                label = "criminal profiles"
            elif "victim" in lower:
                label = "victim records"
            elif "officer" in lower:
                label = "officer records"
            else:
                continue
            if label not in labels:
                labels.append(label)
        if not labels:
            return None
        if len(labels) == 1:
            return labels[0]
        return ", ".join(labels[:-1]) + f", and {labels[-1]}"

    @staticmethod
    def _is_no_data_line(line: str) -> bool:
        lowered = line.lower()
        return any(marker in lowered for marker in _NO_DATA_MARKERS)

    @staticmethod
    def _is_junk_line(line: str) -> bool:
        """Lines dominated by missing values (e.g. 'N/A: Status=..., Risk=N/A')
        carry zero intelligence and must never reach the answer."""
        lowered = line.lower()
        if lowered.count("n/a") >= 2:
            return True
        leading_field = re.split(r"[:=|]", line, 1)[0].strip().lower()
        return leading_field in {"n/a", "na", "unknown", "null", "-"}

    @classmethod
    def _line_score(cls, line: str, tokens: list[str]) -> int:
        lowered = line.lower()
        score = 0
        for token in tokens:
            if token in lowered:
                score += 1
                continue
            # Naive plural stem so "crimes" matches "cyber crime" etc.
            stemmed = token[:-1] if len(token) > 3 and token.endswith("s") else token
            if len(stemmed) > 2 and stemmed in lowered:
                score += 1
                continue
            if any(syn in lowered or syn.rstrip("s") in lowered
                   for syn in _SYNONYMS.get(token, ())):
                score += 1
        return score

    @staticmethod
    def _has_superlative_intent(message: str) -> tuple[bool, bool]:
        """Returns (is_superlative, ascending)."""
        words = set(re.findall(r"[a-z]+", message.lower()))
        if not words & set(_SUPERLATIVE_WORDS):
            return False, False
        ascending = bool(words & set(_ASC_ORDER_WORDS))
        return True, ascending

    @staticmethod
    def _extract_ranked_pairs(
        lines: list[str], tokens: list[str], dimension: str | None = None,
    ) -> list[tuple[str, int]]:
        """Extracts (label, single_number) pairs like 'District Bengaluru Urban
        has 28 registered crime cases'. Comma-joined enumerations (how the
        analytics service emits district/category distributions) are split
        into fragments first. When `dimension` is set ('district'/'category'),
        only labels of that dimension survive so a district question is not
        answered with a summary metric like 'Total crimes' (issue #203)."""
        pairs: list[tuple[str, int]] = []
        seen_labels: set[str] = set()
        for line in lines:
            for fragment in re.split(r",\s+(?=[A-Z])", line):
                if "=" in fragment:
                    continue  # Key=Value dossier fields pollute rankings
                numbers = re.findall(r"\d[\d,]*", fragment)
                if len(numbers) != 1:
                    continue  # summaries/narratives pollute rankings
                match = re.search(r"\d[\d,]*", fragment)
                label = fragment[:match.start()].strip(" -–—*:|")
                # Drop a leading category word already implied by the question.
                first_word = label.split(" ", 1)
                if len(first_word) == 2 and first_word[0].lower().rstrip("s") in tokens:
                    label = first_word[1].strip()
                # Drop trailing connectives so labels read naturally.
                label_words = label.split()
                while label_words and label_words[-1].lower() in _TRAILING_LABEL_WORDS:
                    label_words.pop()
                label = " ".join(label_words)
                if dimension is not None and LLMGenerator._label_dimension(label) != dimension:
                    continue
                number = int(numbers[0].replace(",", ""))
                if not label or len(label) > 60 or number < 0 or label.lower() in seen_labels:
                    continue
                seen_labels.add(label.lower())
                pairs.append((label, number))
        return pairs

    @classmethod
    def _build_ranked_answer(
        cls, message: str, kept: list[tuple[int, int, str, list[str], list[int]]], temporal: bool = False,
    ) -> str | None:
        superlative, ascending = cls._has_superlative_intent(message)
        if not superlative:
            return None

        tokens = [t.rstrip("s") for t in cls._query_tokens(message)]
        dimension = cls._question_dimension(message)
        scored_lines: list[tuple[str, int]] = []
        for total, _max_score, header, lines, line_scores in kept:
            if total <= 0:
                continue
            if not temporal and cls._metadata_section(header):
                continue
            for line, line_score in zip(lines, line_scores):
                if line_score > 0:
                    scored_lines.append((line, line_score))

        ranked = cls._extract_ranked_pairs([line for line, _ in scored_lines], tokens, dimension)
        if not ranked:
            return None
        ranked.sort(key=lambda pair: pair[1], reverse=not ascending)

        top_label, top_number = ranked[0]
        rest = ranked[1:4]
        if rest:
            tail = ", ".join(f"{label} ({number})" for label, number in rest)
            lead = f"{top_label} has the highest count with {top_number}, followed by {tail}."
            if ascending:
                lead = f"{top_label} has the lowest count with {top_number}, ahead of {tail}."
        else:
            lead = f"{top_label} has the highest count with {top_number}."
            if ascending:
                lead = f"{top_label} has the lowest count with {top_number}."

        parts = [lead, ""]
        for label, number in ranked[:_MAX_RANKED_BULLETS]:
            parts.append(f"- {label}: {number}")
        parts += ["", _FOOTER_MESSAGE]
        return "\n".join(parts)

    @staticmethod
    def _format_line(line: str) -> str:
        """Renders one record as a single plain-text entry (no markdown)."""
        if "|" in line:
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 2:
                normalized = []
                for part in parts:
                    if ":" in part:
                        key, val = part.split(":", 1)
                        normalized.append(f"{key.strip()}: {val.strip()}")
                    else:
                        normalized.append(part)
                return " | ".join(normalized)
            return parts[0] if parts else line
        if line.startswith("- ") or line.startswith("* "):
            return line[2:].strip()
        if ":" in line:
            key, val = line.split(":", 1)
            return f"{key.strip()}: {val.strip()}"
        return line


