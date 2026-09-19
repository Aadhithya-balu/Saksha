# SAKSHA — AI-Powered Crime Intelligence & Investigation Platform

> **From fragmented data to connected intelligence.**

SAKSHA is an **AI-powered crime intelligence and investigation platform** designed to help law-enforcement authorities transform information from the **physical world, digital world, investigative records, and forensic sources** into connected, searchable, and actionable intelligence.

Unlike a conventional crime-record management system that primarily stores and retrieves information, SAKSHA is designed around the complete investigation lifecycle:

**Detect → Extract → Connect → Analyze → Investigate → Verify → Record**

---

## Table of Contents

* [Problem Statement](#problem-statement)
* [Why Existing Approaches Are Not Enough](#why-existing-approaches-are-not-enough)
* [Proposed Solution](#proposed-solution)
* [How SAKSHA Works](#how-saksha-works)
* [Data Sources](#data-sources)
* [Core Capabilities](#core-capabilities)

  * [AI CCTV Intelligence](#1-ai-cctv-intelligence)
  * [Social Media & Digital Intelligence](#2-social-media--digital-intelligence)
  * [Document Intelligence](#3-document-intelligence)
  * [NER & NLP](#4-ner--nlp)
  * [Entity Resolution](#5-entity-resolution)
  * [AI-Assisted FIR & Case Creation](#6-ai-assisted-fir--case-creation)
  * [Knowledge Graph](#7-knowledge-graph--criminal-network-intelligence)
  * [Hidden Relationship Discovery](#8-hidden--indirect-relationship-discovery)
  * [Evidence Management](#9-evidence-management--forensics)
  * [Investigation Timeline](#10-investigation-timeline)
  * [RAG Investigation Assistant](#11-rag-powered-investigation-assistant)
  * [Geographic Crime Intelligence](#12-geographic-crime-intelligence)
  * [Role-Based Workspaces](#13-role-based-workspaces)
  * [Real-Time Intelligence](#14-event-driven-intelligence)
* [End-to-End Investigation Flow](#end-to-end-investigation-flow)
* [System Architecture](#system-architecture)
* [AI Architecture](#ai-architecture)
* [Knowledge Graph Model](#knowledge-graph-model)
* [Evidence & Chain of Custody](#evidence--chain-of-custody)
* [Role-Based Access Control](#role-based-access-control)
* [Security & Privacy](#security--privacy)
* [Human-in-the-Loop](#human-in-the-loop)
* [Open-Source & Adaptable Architecture](#open-source--adaptable-architecture)
* [Technology Direction](#technology-direction)
* [Deployment Models](#deployment-models)
* [Example Investigation](#example-investigation)
* [Project Vision](#project-vision)
* [Future Scope](#future-scope)
* [Disclaimer](#disclaimer)

---

# Problem Statement

## The Challenge: Crime Is No Longer Limited to a Single Physical Location

Modern crime investigations can involve information originating from many different sources.

An incident may be captured by a CCTV camera, discussed on a social-media platform, referenced in an investigation report, connected to a vehicle, associated with a previous case, and supported by forensic evidence.

However, these pieces of information are often stored or processed separately.

### Information can come from:

* CCTV footage
* Photographs
* Videos
* Social-media platforms
* Publicly available online information
* Websites and digital sources
* FIRs
* Crime records
* Investigation reports
* Witness information
* Vehicle records
* Location data
* Audio recordings
* Scanned documents
* Forensic evidence
* Digital evidence
* Previous cases
* Other authorized departmental databases

The challenge is not simply **collecting data**.

The real challenge is:

> **Understanding how all these pieces of information relate to one another.**

---

## 1. Unstructured Data

A large amount of investigative information exists in forms that are difficult to search directly.

Examples:

```text
CCTV Video
      ↓
Person / Vehicle / Object

PDF Report
      ↓
Names / Dates / Locations / Events

Image
      ↓
Face / Text / Vehicle / Object

Social Media Content
      ↓
Entities / Events / Locations / Relationships

Audio
      ↓
Speech → Text → Entities
```

Manually converting all of this information into structured records requires significant effort.

---

## 2. Fragmented Information

Important information may exist across different systems.

For example:

```text
Person A
   │
   ├── Previous FIR
   │
   ├── Vehicle
   │
   ├── CCTV appearance
   │
   ├── Associated Person B
   │
   ├── Location X
   │
   └── Related Case
```

When these records are disconnected, understanding the complete context of an investigation becomes difficult.

---

## 3. CCTV Is Often Used as Storage Instead of Intelligence

Traditional CCTV infrastructure primarily answers:

> **"What was recorded?"**

A modern intelligence platform should also help answer:

> **"What entities appear in the footage?"**

> **"Is there relevant existing information?"**

> **"Are there related incidents?"**

> **"Are there connected vehicles, locations or people?"**

> **"What should an investigator review?"**

SAKSHA treats CCTV as a potential **intelligence source**, not simply a video-storage system.

---

## 4. Crime Can Have a Digital Dimension

Crime-related activity can also involve online environments.

Relevant information may originate from:

* Public social-media posts
* Public profiles
* Websites
* Online images
* Public videos
* Digital documents
* Other legally accessible digital sources

The challenge is to identify relevant information and connect it to an investigation without treating unrelated online activity as evidence of wrongdoing.

---

## 5. Hidden Relationships Are Difficult to Identify

A relationship may not appear directly in one record.

For example:

```text
Person A
   ↓
Vehicle X
   ↓
CCTV Camera 12
   ↓
Location Y
   ↓
Incident B
   ↓
Person C
```

Manually identifying these multi-step relationships across large datasets is difficult.

---

## 6. Evidence Is Distributed Across the Investigation

Evidence can include:

* CCTV
* Images
* Videos
* Documents
* Audio
* Forensic reports
* Digital files
* Metadata
* Investigation records

Investigators and forensic teams need to understand not only **what evidence exists**, but also:

* Where it came from
* Which case it belongs to
* Who handled it
* When it was collected
* Whether it was analyzed
* What findings are associated with it

---

## 7. Different Users Need Different Information

An investigator does not need the same interface as a forensic officer.

A crime analyst does not need the same information as a supervisor.

A legal user should not automatically have access to every investigative record.

Therefore, SAKSHA requires **role-based access and role-specific workflows**.

---

# Why Existing Approaches Are Not Enough

A conventional system may look like:

```text
User
 ↓
Search Database
 ↓
View Record
```

SAKSHA aims for:

```text
Real-World Event
       ↓
Data Collection
       ↓
AI Processing
       ↓
Entity Extraction
       ↓
Entity Resolution
       ↓
Knowledge Graph
       ↓
Pattern & Relationship Analysis
       ↓
Evidence
       ↓
Investigation
       ↓
Human Verification
       ↓
Updated Intelligence
```

The difference is:

> **Traditional systems primarily help users retrieve records. SAKSHA is designed to help users discover relationships between records and investigate information.**

---

# Proposed Solution

## SAKSHA

SAKSHA is designed as an **AI-assisted crime intelligence and investigation platform** that connects physical-world data, digital information, case records, evidence, and forensic information.

It transforms:

```text
Raw Information
      ↓
AI-Assisted Processing
      ↓
Structured Entities
      ↓
Connected Knowledge
      ↓
Investigation Intelligence
```

---

# How SAKSHA Works

At a high level:

```text
                    DATA SOURCES
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
      CCTV          Digital Data       Documents
       │                 │                 │
       │            Social Media        FIRs
       │             Websites         Reports
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ↓
                 ┌───────────────┐
                 │  SAKSHA AI    │
                 │     CORE      │
                 └───────┬───────┘
                         ↓
              Detection & Extraction
                         ↓
                Entity Resolution
                         ↓
                 Knowledge Graph
                         ↓
              Intelligence Layer
                         ↓
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
       Analytics        RAG          Evidence
          ↓              ↓              ↓
          └──────────────┼──────────────┘
                         ↓
                  Investigation
                         ↓
                 Human Verification
                         ↓
                 Official Records
```

---

# Data Sources

SAKSHA is designed to support multiple categories of information.

## Physical-World Sources

* CCTV cameras
* Images
* Videos
* Vehicle information
* Geographic information
* Incident locations
* Other authorized sensors

## Digital Sources

* Public social-media information
* Public websites
* Online content
* Digital documents
* Digital media
* Other legally accessible sources

## Police / Investigation Sources

* FIRs
* Crime records
* Investigation reports
* Case records
* Previous incidents
* Person records
* Vehicle records
* Location records

## Forensic Sources

* Digital evidence
* Forensic reports
* Images
* Video
* Audio
* Documents
* Other forensic artifacts

The actual availability and use of each source depends on applicable law, authorization, data-sharing policies, and deployment configuration.

---

# Core Capabilities

## 1. AI CCTV Intelligence

SAKSHA can process CCTV footage using computer-vision models.

Potential detections include:

* Persons
* Vehicles
* Objects
* Faces
* Number plates
* Text
* Events
* Movement
* Timestamps

### Example

```text
CCTV Video
     ↓
Frame / Event Processing
     ↓
Object Detection
     ↓
Person / Vehicle / Object
     ↓
Face / Plate / Text Analysis
     ↓
Entity Resolution
     ↓
Existing Records
     ↓
Investigator Review
```

Instead of simply storing:

```text
camera_12_18-09-2026.mp4
```

SAKSHA can associate extracted information with:

```text
Camera
 ↓
Time
 ↓
Location
 ↓
Person Candidate
 ↓
Vehicle Candidate
 ↓
Incident
 ↓
Case
```

---

# 2. Social Media & Digital Intelligence

Crime and investigation intelligence can also involve digital environments.

SAKSHA can be designed to ingest **authorized or publicly available information** from digital sources.

Potential information includes:

* Public posts
* Public profiles
* Public images
* Public videos
* Publicly available text
* Dates
* Locations
* Named entities
* Relevant online events

### Example

```text
Authorized Digital Source
          ↓
      Data Collection
          ↓
      NLP / Vision
          ↓
Entity / Event Extraction
          ↓
Entity Resolution
          ↓
Existing SAKSHA Records
          ↓
Potential Relationship
          ↓
Investigator Verification
```

SAKSHA does not treat the existence of an online association as proof of criminal activity.

The purpose is to help authorized investigators **identify potentially relevant information that can be reviewed and verified**.

---

# 3. Document Intelligence

Investigative documents can contain large amounts of useful information.

SAKSHA can use OCR and NLP to extract information from:

* FIR documents
* Reports
* PDFs
* Scanned documents
* Investigation notes
* Evidence descriptions
* Other authorized documents

Example:

```text
Investigation Report
        ↓
       OCR
        ↓
      Text
        ↓
       NLP
        ↓
Named Entity Recognition
        ↓
Person / Place / Date / Event
        ↓
Structured Records
```

---

# 4. NER & NLP

Named Entity Recognition can identify entities such as:

```text
PERSON
LOCATION
DATE
ORGANIZATION
VEHICLE
CASE NUMBER
CRIME TYPE
```

For example:

```text
"Person A was seen near Location X
on 18 September 2026."

             ↓

PERSON
Person A

LOCATION
Location X

DATE
18 September 2026
```

The extracted entities can then be connected with existing records.

---

# 5. Entity Resolution

Different sources may refer to the same entity in different ways.

For example:

```text
"Rajesh Kumar"

"R. Kumar"

"Rajesh K."

```

SAKSHA can use configurable matching and entity-resolution techniques to identify **potential matches**.

The workflow becomes:

```text
New Information
      ↓
Entity Extraction
      ↓
Candidate Matching
      ↓
Existing Entity Candidates
      ↓
Confidence / Supporting Information
      ↓
Human Verification
      ↓
Confirmed Relationship
```

This helps reduce duplicate entities while avoiding automatic assumptions about identity.

---

# 6. AI-Assisted FIR & Case Creation

SAKSHA can help convert information about an incident into structured case information.

```text
Incident
   ↓
Reports / CCTV / Evidence
   ↓
AI Extraction
   ↓
Person / Location / Time / Event
   ↓
Case Information
   ↓
FIR Draft / Case Draft
   ↓
Officer Review
   ↓
Authorized Confirmation
```

The AI can assist with drafting and extraction, while the authorized officer remains responsible for verification and official registration.

---

# 7. Knowledge Graph & Criminal Network Intelligence

A central component of SAKSHA is a **knowledge graph**.

Instead of representing information only as rows and columns, the graph represents entities and their relationships.

Example:

```text
                    PERSON A
                   /        \
                  /          \
             PERSON B      VEHICLE X
                |              |
              CASE A        CCTV 12
                |              |
           LOCATION X      LOCATION Y
                \              /
                 \            /
                    CASE B
```

### Graph entities

* Person
* Suspect
* Victim
* Vehicle
* Crime
* FIR
* Case
* Location
* CCTV
* Evidence
* Organization
* Event
* Document

### Graph relationships

* INVOLVED_IN
* ASSOCIATED_WITH
* SEEN_IN
* LOCATED_AT
* OWNS
* MENTIONED_IN
* EVIDENCE_FOR
* RELATED_TO
* OCCURRED_AT
* CONNECTED_TO

The graph provides investigators with a visual and queryable representation of connected information.

---

# 8. Hidden & Indirect Relationship Discovery

SAKSHA can help investigators explore multi-hop relationships.

Example:

```text
Person A
   ↓
Vehicle X
   ↓
CCTV Camera 5
   ↓
Location Y
   ↓
Incident Z
   ↓
Person B
```

The system can surface such relationships for review.

Possible relationship categories can include:

### Direct

```text
A → B
```

### Two-hop

```text
A → B → C
```

### Multi-hop

```text
A → B → C → D → E
```

### Temporal

```text
Same person
+
Repeated locations
+
Similar time windows
```

### Geographic

```text
Multiple incidents
+
Common location
```

These relationships should be presented with their supporting records and context.

---

# 9. Evidence Management & Forensics

SAKSHA provides a structured environment for investigation evidence.

Evidence may include:

* CCTV footage
* Images
* Videos
* Audio
* Documents
* Digital files
* Forensic reports
* Extracted metadata

Each evidence item can have:

```text
Evidence ID
Case ID
Evidence Type
Source
Date
Time
Location
Collected By
Current Custodian
Analysis Status
Verification Status
Chain of Custody
```

---

# 10. Investigation Timeline

Every case can be represented as a chronological sequence.

Example:

```text
18 Sep — 21:32
Incident detected

18 Sep — 21:35
CCTV event identified

18 Sep — 21:41
Vehicle detected

18 Sep — 21:44
Potential person match

18 Sep — 22:02
Evidence uploaded

18 Sep — 22:20
Forensic analysis started

18 Sep — 22:45
Investigator reviewed findings
```

This gives investigators a unified understanding of the case history.

---

# 11. RAG-Powered Investigation Assistant

SAKSHA can provide an AI assistant using **Retrieval-Augmented Generation (RAG)**.

Instead of asking a general-purpose AI to answer from its training knowledge, SAKSHA retrieves relevant authorized records first.

### Example

**Investigator:**

> "Show me the relevant information connected to this case."

SAKSHA retrieves:

```text
FIR
 ↓
Previous Cases
 ↓
Persons
 ↓
Vehicles
 ↓
CCTV
 ↓
Locations
 ↓
Evidence
 ↓
Investigation Reports
 ↓
Related Graph Entities
```

The AI then generates a grounded response.

### Another example

> "What evidence is currently associated with this case?"

The system retrieves the relevant evidence records and summarizes them.

### Source-grounded responses

Important AI responses should provide references to the underlying records so that investigators can verify the information.

---

# 12. Geographic Crime Intelligence

SAKSHA can combine crime data with geographic information.

The platform can visualize:

* Incident locations
* CCTV locations
* Crime clusters
* Investigation areas
* Repeated locations
* Case distribution
* Temporal geographic patterns

Example:

```text
CITY
 │
 ├── Zone A
 │    ├── Incidents
 │    ├── CCTV
 │    └── Cases
 │
 ├── Zone B
 │    ├── Incidents
 │    ├── CCTV
 │    └── Cases
 │
 └── Zone C
      ├── Incidents
      ├── CCTV
      └── Cases
```

This helps analysts understand where and when incidents are occurring.

---

# 13. Role-Based Workspaces

SAKSHA is designed to support multiple authorized roles.

## Investigator

* Active investigations
* Cases
* Suspects / persons
* CCTV
* Evidence
* Timelines
* Network intelligence
* AI investigation assistant

## Crime Analyst

* Crime trends
* Geographic patterns
* Network analysis
* Cross-case relationships
* Statistical insights
* Intelligence reports

## Forensic Officer

* Evidence
* Digital evidence
* Forensic analysis
* Chain of custody
* Evidence verification

## Supervisor

* Investigation status
* Case workload
* Operational overview
* Alerts
* Investigation progress

## Authorized Legal Users

Depending on permissions:

* FIR information
* Case records
* Evidence
* Investigation documents
* Relevant case history

## Administrator

* Users
* Roles
* Permissions
* Configuration
* Integrations
* Audit logs

---

# 14. Event-Driven Intelligence

The long-term architecture of SAKSHA is designed around continuous information processing.

Instead of:

```text
User
 ↓
Search
 ↓
Database
```

the system can evolve toward:

```text
EVENT
 ↓
INGESTION
 ↓
AI PROCESSING
 ↓
ENTITY EXTRACTION
 ↓
ENTITY RESOLUTION
 ↓
KNOWLEDGE GRAPH UPDATE
 ↓
RULES / ANALYTICS
 ↓
ALERT / INSIGHT
 ↓
HUMAN REVIEW
 ↓
OFFICIAL ACTION
```

For example:

```text
CCTV Event
    ↓
Vehicle Detected
    ↓
Number Plate Extracted
    ↓
Potential Vehicle Match
    ↓
Associated Person Retrieved
    ↓
Related Case Retrieved
    ↓
Investigator Alert
    ↓
Human Verification
```

This is the foundation for making SAKSHA an **active intelligence platform rather than a passive database**.

---

# End-to-End Investigation Flow

A complete investigation can follow:

```text
┌────────────────────────────┐
│ Incident / Information     │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ CCTV / Social / Documents  │
│ Reports / Evidence         │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ AI Processing              │
│ Vision / OCR / NLP / NER   │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Entity Extraction          │
│ Person / Vehicle / Place   │
│ Event / Case / Evidence    │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Entity Resolution          │
│ Existing / New Candidates  │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Knowledge Graph            │
│ Relationships & Networks   │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Evidence & Case Management │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ RAG Investigation Assistant│
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Investigator Review        │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ Verified Investigation     │
└────────────────────────────┘
```

---

# System Architecture

SAKSHA can be organized into several major layers.

```text
┌──────────────────────────────────────────────┐
│                 USER LAYER                   │
│                                              │
│ Investigator | Analyst | Forensics | Legal  │
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│              APPLICATION LAYER               │
│                                              │
│ Dashboard | Investigation | Evidence | Graph │
│ Analytics | AI Assistant | Case Management   │
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│                  API LAYER                   │
│                                              │
│ Authentication | RBAC | REST APIs | Services│
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│               INTELLIGENCE LAYER             │
│                                              │
│ Vision | OCR | NLP | NER | Entity Resolution │
│ Embeddings | RAG | Analytics | Rules         │
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│                  DATA LAYER                 │
│                                              │
│ PostgreSQL | Neo4j | Vector Store | Storage  │
└──────────────────────┬───────────────────────┘
                       ↓
┌──────────────────────────────────────────────┐
│                 DATA SOURCES                │
│                                              │
│ CCTV | Documents | Social | Evidence | APIs │
└──────────────────────────────────────────────┘
```

---

# AI Architecture

SAKSHA can use multiple specialized AI components instead of relying on one model.

```text
                    SAKSHA AI
                        │
       ┌────────────────┼────────────────┐
       ↓                ↓                ↓
 Computer Vision       NLP              OCR
       │                │                │
       ↓                ↓                ↓
 Persons             NER             Text
 Vehicles             ↓                ↓
 Objects          Entities        Documents
 Faces                │
 Plates               │
       └───────────────┼────────────────┘
                       ↓
                Entity Resolution
                       ↓
                 Knowledge Graph
                       ↓
                  Vector Search
                       ↓
                      RAG
                       ↓
                Investigation AI
```

This modular architecture allows individual AI components to be replaced or improved without redesigning the entire platform.

---

# Knowledge Graph Model

A simplified graph can contain:

```text
(:Person)
(:Vehicle)
(:Crime)
(:FIR)
(:Case)
(:Location)
(:Evidence)
(:CCTV)
(:Organization)
(:Document)
(:Event)
```

Example relationships:

```text
(Person)-[:INVOLVED_IN]->(Case)

(Person)-[:ASSOCIATED_WITH]->(Person)

(Person)-[:USES]->(Vehicle)

(Vehicle)-[:SEEN_IN]->(CCTV)

(CCTV)-[:LOCATED_AT]->(Location)

(Crime)-[:OCCURRED_AT]->(Location)

(Evidence)-[:EVIDENCE_FOR]->(Case)

(Document)-[:MENTIONS]->(Person)

(Event)-[:RELATED_TO]->(Case)
```

The graph can then support multi-hop investigation queries.

---

# Evidence & Chain of Custody

Evidence management should preserve traceability.

Example:

```text
Evidence Created
      ↓
Collected By Officer A
      ↓
Transferred To Forensic Officer B
      ↓
Analysis Performed
      ↓
Report Generated
      ↓
Reviewed By Officer C
```

Each transition can be recorded as an auditable event.

This allows authorized personnel to understand the history of an evidence item.

---

# Role-Based Access Control

SAKSHA should enforce access at the application and data layers.

Example:

```text
ADMIN
 └── Full system administration

INVESTIGATOR
 ├── Cases
 ├── Evidence
 ├── Investigation
 ├── Network
 └── AI Assistant

CRIME_ANALYST
 ├── Analytics
 ├── Network
 └── Reports

FORENSIC_OFFICER
 ├── Evidence
 ├── Forensics
 └── Chain of Custody

SUPERVISOR
 ├── Operational Dashboard
 ├── Cases
 └── Reports

LEGAL_USER
 └── Authorized case/legal information
```

Permissions should be granular rather than relying only on broad role names.

---

# Security & Privacy

SAKSHA is intended to handle highly sensitive information, so security is a fundamental requirement.

Potential security mechanisms include:

* Role-based access control
* Authentication
* Authorization
* Encryption
* Audit logs
* Evidence access tracking
* Secure file storage
* API security
* Session management
* Data isolation
* Database access controls
* Model access controls
* Source attribution
* Activity monitoring

For digital and social-media intelligence, SAKSHA should only process information that the deployment is **legally authorized to access and use**.

---

# Human-in-the-Loop

SAKSHA is designed to **assist investigators, not replace them**.

The general principle is:

```text
AI
 ↓
Detection
 ↓
Suggestion
 ↓
Evidence / Source
 ↓
Human Review
 ↓
Verification
 ↓
Official Action
```

For example:

```text
AI:
"Potential match found."

        ↓

Investigator:
Reviews supporting information

        ↓

Investigator:
Confirms / rejects / investigates further
```

This is especially important for:

* Identity matching
* Relationship discovery
* AI-generated reports
* FIR drafts
* Evidence interpretation
* Alerts
* Case associations

AI outputs should be treated as **decision-support information**, not automatic legal conclusions.

---

# Open-Source & Adaptable Architecture

SAKSHA is intended to be adaptable to different jurisdictions and datasets.

The core platform should not be permanently tied to one country's administrative structure or one database schema.

For example, one deployment could use:

```text
Country
 └── State
      └── District
           └── Police Station
                └── Case
```

Another deployment could use:

```text
Country
 └── State
      └── County
           └── Department
                └── Case
```

The system can be configured around the data model provided by the deployment.

---

# Database-Agnostic Vision

A major goal of SAKSHA is allowing organizations to connect their own datasets.

Conceptually:

```text
               SAKSHA
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
 Existing Database      New Dataset
        │                   │
        └─────────┬─────────┘
                  ↓
           Data Mapping Layer
                  ↓
        SAKSHA Intelligence
```

The system can adapt its:

* Administrative hierarchy
* Crime categories
* Person schema
* Case schema
* Evidence schema
* Location structure
* Data relationships

to the deployment.

---

# Technology Direction

The architecture can be implemented using open-source technologies.

Possible components include:

| Layer               | Possible Technology             |
| ------------------- | ------------------------------- |
| Frontend            | React / Next.js                 |
| Backend             | FastAPI / Node.js               |
| Relational Database | PostgreSQL                      |
| Graph Database      | Neo4j                           |
| Vector Search       | pgvector / Qdrant / Chroma      |
| Computer Vision     | YOLO / OpenCV                   |
| OCR                 | PaddleOCR / Tesseract           |
| NLP                 | Hugging Face / spaCy            |
| Speech-to-Text      | Whisper                         |
| Local LLM           | Ollama / compatible open models |
| Object Storage      | MinIO                           |
| Background Jobs     | Celery / Redis                  |
| Containers          | Docker                          |

The exact technology stack can evolve as the platform develops.

---

# Deployment Models

SAKSHA can be designed for multiple deployment scenarios.

## Local / Small Deployment

```text
SAKSHA
  ↓
Local Server
  ├── Database
  ├── Graph
  ├── AI Models
  └── Evidence Storage
```

Suitable for development, testing, demonstrations, and smaller deployments.

---

## Department-Level Deployment

```text
Multiple Police Stations
          ↓
Central SAKSHA
          ↓
Central Intelligence
          ↓
Authorized Departments
```

---

## Large-Scale Deployment

```text
CCTV Sources
      ↓
Distributed Processing
      ↓
Central Intelligence Platform
      ↓
Knowledge Graph
      ↓
Investigation Systems
      ↓
Authorized Departments
```

Large-scale deployments would require appropriate GPU infrastructure, storage, networking, security, monitoring, backups, and operational support.

---

# Example Investigation

Consider an incident occurring in a city.

### Step 1 — Incident

A CCTV camera captures an event.

```text
CCTV Camera
     ↓
Video
```

### Step 2 — AI Processing

SAKSHA detects:

```text
2 Persons
1 Vehicle
1 Number Plate
```

### Step 3 — Entity Resolution

The vehicle information is compared against authorized records.

```text
Vehicle Candidate
       ↓
Existing Vehicle Record
       ↓
Associated Person Candidate
```

### Step 4 — Existing Case Discovery

The person candidate is associated with previous records.

```text
Person
 ├── Previous Case
 ├── Previous FIR
 └── Associated Vehicle
```

### Step 5 — Network Analysis

The graph shows:

```text
Person A
   ↓
Vehicle X
   ↓
CCTV Camera
   ↓
Current Incident

Person A
   ↓
Person B
   ↓
Previous Case
```

### Step 6 — Digital Intelligence

Authorized public digital information may provide additional context that investigators can review.

```text
Digital Source
      ↓
Relevant Entity
      ↓
Potential Connection
      ↓
Investigator Review
```

### Step 7 — Evidence

The original CCTV becomes associated with the investigation.

```text
Case
 ↓
Evidence
 ↓
CCTV
 ↓
Analysis
 ↓
Chain of Custody
```

### Step 8 — RAG Assistant

The investigator asks:

> "What information currently connects this case with previous records?"

SAKSHA retrieves relevant records and presents a source-grounded summary.

### Step 9 — Human Verification

The investigator reviews:

* AI findings
* Original CCTV
* Records
* Evidence
* Graph relationships
* Supporting documents

and decides what actions are appropriate.

---

# SAKSHA Intelligence Loop

The complete philosophy of the platform can be represented as:

```text
             ┌──────────────┐
             │    DETECT    │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │   EXTRACT    │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │   IDENTIFY   │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │   CONNECT    │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │   ANALYZE    │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │    ALERT     │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │ INVESTIGATE  │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │    VERIFY    │
             └──────┬───────┘
                    ↓
             ┌──────────────┐
             │    RECORD    │
             └──────┬───────┘
                    │
                    └──────────────→ CONNECT AGAIN
```

---

# What Makes SAKSHA Different?

### Traditional Crime Data System

```text
Store
  ↓
Search
  ↓
View
```

### SAKSHA

```text
Collect
   ↓
Understand
   ↓
Extract
   ↓
Identify
   ↓
Connect
   ↓
Analyze
   ↓
Investigate
   ↓
Verify
   ↓
Record
   ↓
Learn from connected information
```

SAKSHA is therefore designed not merely as a **crime database**, but as an **intelligence layer connecting information across an investigation**.

---

# Project Vision

The long-term vision of SAKSHA is to create a unified platform where authorized law-enforcement personnel can move from raw information to investigation intelligence without manually searching through disconnected systems.

```text
                         REAL WORLD
                             │
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
      CCTV              DIGITAL WORLD         DOCUMENTS
        │              Social / Web              │
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ↓
                         SAKSHA
                             ↓
                      AI PROCESSING
                             ↓
                 ENTITY & EVENT EXTRACTION
                             ↓
                     ENTITY RESOLUTION
                             ↓
                     KNOWLEDGE GRAPH
                             ↓
                ┌────────────┼────────────┐
                ↓            ↓            ↓
             Evidence     Analytics       RAG
                ↓            ↓            ↓
                └────────────┼────────────┘
                             ↓
                       INVESTIGATION
                             ↓
                     HUMAN VERIFICATION
                             ↓
                       LEGAL WORKFLOW
```

The goal is to move from:

> **Fragmented information → Connected intelligence**

and from:

> **Passive record management → AI-assisted investigation**

---

# Future Scope

SAKSHA can evolve toward:

* Real-time CCTV event processing
* Advanced video analytics
* Multi-camera event correlation
* Advanced entity resolution
* Multilingual NLP
* Multilingual document processing
* Voice-based investigation assistant
* Advanced social-media intelligence for authorized/public data
* Automated evidence classification
* Advanced forensic workflows
* Cross-jurisdiction intelligence
* Real-time investigation alerts
* Advanced geospatial analysis
* Predictive resource planning
* Advanced graph analytics
* Federated data integration
* Pluggable AI model providers
* Local/self-hosted AI deployments
* Government-scale deployment architecture

---

# Responsible AI Principles

SAKSHA is intended to operate with the following principles:

### Human Verification

AI suggestions should be reviewed by authorized personnel.

### Source Grounding

AI-generated information should be connected to underlying records wherever possible.

### Explainability

Important AI outputs should provide supporting information and confidence/context where appropriate.

### Data Minimization

Only necessary and authorized information should be processed.

### Access Control

Sensitive information should only be accessible to authorized users.

### Auditability

Important actions and evidence access should be traceable.

### No Automatic Guilt Determination

An AI match, relationship, social-media association, or pattern should not by itself be treated as proof of criminal activity.

---

# Project Status

SAKSHA is being developed as an **AI-powered, modular and open-source-oriented crime intelligence platform**.

The platform is evolving from traditional:

```text
Data Storage
      +
Data Retrieval
      +
Visualization
```

toward:

```text
Data Ingestion
      +
AI Processing
      +
Entity Resolution
      +
Knowledge Graph
      +
Evidence Intelligence
      +
RAG
      +
Investigation Workflows
```

Individual capabilities may have different implementation maturity depending on the current development stage.

---

# Contributing

Contributions are welcome.

Potential contribution areas include:

* AI/ML models
* Computer vision
* NLP
* NER
* OCR
* Knowledge graphs
* Neo4j integrations
* RAG pipelines
* Evidence management
* Geospatial analytics
* Frontend development
* Backend development
* Security
* RBAC
* Database adapters
* Data ingestion pipelines
* Testing
* Documentation

If contributing AI or data-processing functionality, contributors should consider:

* Accuracy
* Bias
* False positives
* False negatives
* Explainability
* Privacy
* Security
* Legal compliance
* Human verification

---

# Disclaimer

SAKSHA is designed as an **AI-assisted investigation and intelligence platform**.

AI-generated detections, matches, relationships, summaries, classifications, and recommendations are intended to assist authorized personnel and should be independently verified before being used for consequential decisions.

Any real-world deployment involving CCTV, biometric information, social-media information, personal data, communications, forensic evidence, or other sensitive information must comply with applicable laws, regulations, organizational policies, data-protection requirements, and authorization procedures.

---

# SAKSHA

### **From fragmented data to connected intelligence.**

**Detect. Extract. Connect. Analyze. Investigate. Verify.**

SAKSHA aims to give investigators a unified intelligence environment where information from the **physical world, digital world, crime records, evidence, and forensic sources** can be connected to help build a clearer picture of an investigation.
