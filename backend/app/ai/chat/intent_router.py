"""Rule-based intent detection for Saksha AI Chat.

Classifies user queries into one or more domain intents using weighted
keyword matching and regex pattern detection. No external model required.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum


class Intent(Enum):
    FIR_LOOKUP = "fir_lookup"
    CASE_DETAILS = "case_details"
    CRIMINAL_HISTORY = "criminal_history"
    OFFICER_INFO = "officer_info"
    CRIME_STATISTICS = "crime_statistics"
    HOTSPOT_ANALYSIS = "hotspot_analysis"
    CRIMINAL_NETWORK = "criminal_network"
    EVIDENCE_LOOKUP = "evidence_lookup"
    SIMILAR_CASES = "similar_cases"
    PREDICTIONS = "predictions"
    NOTIFICATIONS = "notifications"
    DASHBOARD_ANALYTICS = "dashboard_analytics"
    PLATFORM_GENERAL = "platform_general"
    GENERAL = "general"


_PLATFORM_GENERAL_PATTERNS = re.compile(
    r"\b(?:what\s+is|about|tell\s+me\s+about|describe|explain|introduction|overview\s+of|purpose|goal|"
    r"who\s+(?:made|built|developed|designed)|how\s+(?:does|do|did)|why\s+(?:is|was|are|did)|"
    r"architecture|tech\s+stack|features|capabilities|modules|who\s+is\s+saksha)\b"
    r".*?\b(?:saksha|platform|system|application|project|tool|software|crime\s+intelligence)\b",
    re.I,
)
_PLATFORM_GENERAL_WORDS = {
    "saksha", "platform", "system", "application", "project", "tool", "software",
    "crime intelligence", "crime intelligence platform",
}
_PLATFORM_GENERAL_LEAD = re.compile(
    r"^(?:what\s+is|about|tell\s+me\s+about|describe|explain|introduction|purpose|goal|overview)\b",
    re.I,
)

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
    about the platform itself — so those messages must not be collapsed into
    the platform-general intent (which would skip all backend retrieval).
    """
    return bool(_CASE_ID_RE.search(message)) or bool(_FIR_ID_RE.search(message))


def _is_platform_question(message: str) -> bool:
    """True when the user is asking about Saksha itself, not querying data."""
    if _PLATFORM_GENERAL_PATTERNS.search(message):
        return True
    lower = message.lower()
    if _PLATFORM_GENERAL_LEAD.match(lower):
        for word in _PLATFORM_GENERAL_WORDS:
            if word in lower:
                return True
    return False


_INTENT_RULES: dict[Intent, dict] = {
    Intent.FIR_LOOKUP: {
        "keywords": [
            ("fir", 3), ("first information report", 4), ("fir number", 4),
            ("fir status", 4), ("filed fir", 3), ("show fir", 4),
            ("list fir", 3), ("search fir", 3), ("find fir", 3),
        ],
        "patterns": [
            re.compile(r"\bfir\s*\d{4}/\d+", re.I),
            re.compile(r"\bfir\s+number", re.I),
            re.compile(r"\d{4}/\d{3,}", re.I),
            re.compile(r"\d{1,4}/[A-Z]{1,20}/\d{4}", re.I),
            re.compile(r"\bFIR-[A-Z]{1,6}-\d{1,6}/\d{4}", re.I),
        ],
    },
    Intent.CASE_DETAILS: {
        "keywords": [
            ("case number", 4), ("case status", 4), ("case details", 4),
            ("crime case", 3), ("case summary", 3), ("open case", 3),
            ("closed case", 3), ("case progress", 3), ("case report", 3),
            ("show case", 3), ("investigation status", 3),
            ("tell me about case", 5), ("details of case", 5),
            ("about case", 4), ("case info", 4), ("case file", 3),
            ("case record", 3), ("lookup case", 4), ("find case", 4),
            ("search case", 3), ("get case", 3),
        ],
        "patterns": [
            re.compile(r"CR-\d{4}-[A-Z]{2,4}-\d+", re.I),
            re.compile(r"\bcase\s+(number|status|detail|report|summary)\b", re.I),
        ],
    },
    Intent.CRIMINAL_HISTORY: {
        "keywords": [
            ("criminal", 3), ("offender", 3), ("suspect", 3), ("accused", 3),
            ("criminal record", 4), ("criminal history", 4), ("offender profile", 4),
            ("known criminal", 3), ("repeat offender", 4), ("criminal background", 4),
            ("antecedents", 3), ("previous cases", 3), ("past crimes", 3),
            ("who is", 2), ("tell me about", 2), ("details of", 2),
        ],
        "patterns": [
            re.compile(r"\b(show|find|search|get|who\s+is)\b.*\b(criminal|offender|suspect|accused)\b", re.I),
            re.compile(r"\bcriminal\s+(profile|record|history|background)\b", re.I),
        ],
    },
    Intent.OFFICER_INFO: {
        "keywords": [
            ("officer", 3), ("inspector", 3), ("constable", 3), ("sub inspector", 3),
            ("psi", 3), ("asi", 3), ("badge", 3), ("police officer", 3),
            ("sp ", 2), ("dcp", 3), ("commissioner", 3), ("officer details", 4),
            ("officer profile", 4), ("who is the officer", 3),
        ],
        "patterns": [
            re.compile(r"\bofficer\s+(name|badge|detail|profile|station)\b", re.I),
            re.compile(r"\b(IO|SP|DCP|ACP|PSI|ASI|SI)\s*[-:]?\s*\w+", re.I),
        ],
    },
    Intent.CRIME_STATISTICS: {
        "keywords": [
            ("statistics", 3), ("stats", 3), ("how many crimes", 4),
            ("total crimes", 4), ("crime rate", 3), ("crime count", 3),
            ("number of crimes", 4), ("crime data", 3), ("crime numbers", 3),
            ("breakdown", 2), ("distribution", 2), ("category wise", 3),
            ("district wise", 3), ("compare districts", 3),
        ],
        "patterns": [
            re.compile(r"\bhow\s+many\s+(crimes|cases|firs|offenders)\b", re.I),
            re.compile(r"\b(total|overall|aggregate)\s+(crimes|cases|firs)\b", re.I),
            re.compile(r"\b(crime|case)\s+(statistics|stats|data|numbers|count)\b", re.I),
        ],
    },
    Intent.HOTSPOT_ANALYSIS: {
        "keywords": [
            ("hotspot", 4), ("hot spot", 4), ("crime zone", 3),
            ("high crime area", 4), ("crime cluster", 3), ("crime-prone", 3),
            ("dangerous area", 3), ("unsafe area", 3), ("crime mapping", 3),
            ("spatial analysis", 3), ("heat map", 3), ("heatmap", 3),
        ],
        "patterns": [
            re.compile(r"\bhot\s*spot\b", re.I),
            re.compile(r"\b(high|most)\s+crime\s+(area|zone|region|locality)\b", re.I),
        ],
    },
    Intent.CRIMINAL_NETWORK: {
        "keywords": [
            ("network", 3), ("connected to", 3), ("association", 3),
            ("gang", 3), ("syndicate", 3), ("links to", 3), ("linked with", 3),
            ("relationship", 3), ("knows each other", 3), ("accomplice", 3),
            ("associate", 3), ("connection", 3), ("network graph", 4),
            ("criminal network", 4), ("who knows", 3), ("who is connected", 4),
            ("shortest path", 4), ("link analysis", 4), ("between", 2),
        ],
        "patterns": [
            re.compile(r"\b(who|how)\s+(is|are)\s+\w+\s+(connected|linked|associated)\b", re.I),
            re.compile(r"\bnetwork\s+(graph|analysis|view|map)\b", re.I),
            re.compile(r"\b(shortest|path)\s+between\b", re.I),
        ],
    },
    Intent.SIMILAR_CASES: {
        "keywords": [
            ("similar", 3), ("similar cases", 4), ("same pattern", 3),
            ("modus operandi", 4), ("mo ", 2), ("same method", 3),
            ("same technique", 3), ("resembles", 2), ("match pattern", 3),
            ("matching cases", 3), ("related cases", 3),
        ],
        "patterns": [
            re.compile(r"\bsimilar\s+(cases?|crimes?|offenders?|patterns?)\b", re.I),
            re.compile(r"\bmodus\s+operandi\b", re.I),
        ],
    },
    Intent.EVIDENCE_LOOKUP: {
        "keywords": [
            ("evidence", 5), ("evidences", 5), ("exhibit", 4), ("exhibits", 4),
            ("seized", 4), ("seized items", 5), ("forensic", 3),
            ("impounded", 4), ("recovered", 3), ("material exhibits", 5),
            ("linked evidence", 5), ("related evidence", 4), ("attached evidence", 4),
        ],
        "patterns": [
            re.compile(r"what\s+evidence\b", re.I),
            re.compile(r"(evidence|exhibits?)\s+(linked|related|attached|connected|tied)\b", re.I),
            re.compile(r"\b(any|all|list|show|what)\b.*\bevidence\b", re.I),
            re.compile(r"\bevidence\b.*\b(case|fir)\b", re.I),
        ],
    },
    Intent.PREDICTIONS: {
        "keywords": [
            ("predict", 4), ("forecast", 4), ("risk score", 4),
            ("risk level", 3), ("future", 2), ("will happen", 3),
            ("likely to", 3), ("probability", 3), ("risk assessment", 4),
            ("predictive", 3), ("prediction", 4), ("trend", 2),
            ("outlook", 2), ("risk analysis", 3),
        ],
        "patterns": [
            re.compile(r"\b(predict|forecast)\b", re.I),
            re.compile(r"\brisk\s+(score|level|assessment|analysis)\b", re.I),
        ],
    },
    Intent.NOTIFICATIONS: {
        "keywords": [
            ("notification", 3), ("notifications", 3), ("alert", 2),
            ("alerts", 2), ("unread", 3), ("recent alerts", 4),
            ("system alert", 3), ("intelligence alert", 3),
            ("threat alert", 3), ("new notification", 4),
        ],
        "patterns": [
            re.compile(r"\b(show|list|get|any|new)\s+notifications?\b", re.I),
            re.compile(r"\bunread\s+(notifications?|alerts?)\b", re.I),
        ],
    },
    Intent.DASHBOARD_ANALYTICS: {
        "keywords": [
            ("dashboard", 3), ("overview", 3), ("summary", 2),
            ("kpi", 3), ("metrics", 3), ("overview of", 2),
            ("current status", 3), ("platform status", 3),
            ("system overview", 3), ("crime overview", 3),
            ("what's happening", 3), ("latest", 2),
        ],
        "patterns": [
            re.compile(r"\b(dashboard|overview|summary)\s+(of|for|on)?\s*(crime|system|platform)?", re.I),
            re.compile(r"\bwhat('s| is) happening\b", re.I),
        ],
    },
}

_THRESHOLD = 2.0


@dataclass(frozen=True)
class IntentResult:
    intents: list[Intent]
    confidence: float
    scores: dict[str, float]


class IntentRouter:
    """Classifies user queries into Saksha domain intents."""

    def detect(self, message: str) -> IntentResult:
        if _is_platform_question(message) and not _has_concrete_reference(message):
            return IntentResult(
                intents=[Intent.PLATFORM_GENERAL],
                confidence=1.0,
                scores={"platform_general": 1.0},
            )

        lower = message.lower()
        scores: dict[Intent, float] = {}

        has_case_id = bool(_CASE_ID_RE.search(message))
        has_fir_number = bool(_FIR_ID_RE.search(message))

        for intent, rules in _INTENT_RULES.items():
            score = 0.0
            for keyword, weight in rules["keywords"]:
                if keyword in lower:
                    score += weight
            for pattern in rules["patterns"]:
                if pattern.search(message):
                    score += 3.0
            if has_case_id and intent == Intent.CASE_DETAILS:
                score += 6.0
            if has_fir_number and intent == Intent.FIR_LOOKUP:
                score += 6.0
            if score > 0:
                scores[intent] = score

        if not scores:
            return IntentResult(
                intents=[Intent.GENERAL],
                confidence=1.0,
                scores={"general": 1.0},
            )

        max_score = max(scores.values())
        selected = [
            intent for intent, s in sorted(scores.items(), key=lambda x: -x[1])
            if s >= _THRESHOLD and s >= max_score * 0.5
        ][:3]

        if not selected:
            selected = [max(scores, key=scores.get)]  # type: ignore[arg-type]

        confidence = min(1.0, max_score / 10.0)
        return IntentResult(
            intents=selected,
            confidence=round(confidence, 2),
            scores={i.value: round(s, 2) for i, s in scores.items()},
        )


_THRESHOLD = 2.0
