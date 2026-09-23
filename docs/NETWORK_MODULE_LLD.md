# Network Module LLD

**Project:** SAKSHA — AI-Powered Crime Intelligence Platform  
**Component:** Investigation Relationship Graph, Link Analysis & Knowledge Network  
**Inspection Date:** September 2026  
**Status:** Implementation Blueprint (Based on Actual Codebase Inspection)

---

## 1. Module Overview

| Item | Details |
|---|---|
| **Purpose** | Discovers, synthesizes, and visualizes multi-entity relational intelligence (suspects, co-accused, victims, cases, locations, weapons, gangs) as an interactive 3D knowledge graph with link analysis and pathfinding. |
| **Responsibilities** | 1. Construct dynamic relationship graphs centered around persons, cases, or multi-attribute filters.<br>2. Derive co-accused connections (`KNOWS` / `SHARED_CASE`) from shared FIR links in PostgreSQL.<br>3. Track relationship provenance (`DIRECT_DATABASE`, `ANALYTICAL_INFERENCE`, `DEMO_SEED`) and verification status (`VERIFIED`, `POTENTIAL`, `UNVERIFIED`).<br>4. Calculate graph centrality metrics (degree, betweenness, closeness, PageRank, key broker nodes).<br>5. Execute evidence-backed shortest connection path queries (BFS up to 5 hops).<br>6. Support dual-backend graph execution: Primary Neo4j graph queries with seamless fallback to PostgreSQL relational joins.<br>7. Render interactive 3D WebGL force-directed graphs (`react-force-graph-3d`) with camera targeting and particle flow animations. |
| **Inputs** | Person UUIDs, Case UUIDs, multi-parameter search filters (crime type, district, station, dates, risk score), BFS hop limits, search strings. |
| **Outputs** | Graph JSON payloads (`nodes`, `edges`), centrality leaderboards, syndicate hierarchy trees, shortest connection paths, AI graph insight alerts. |
| **Dependencies** | FastAPI, SQLAlchemy 2.0, `neo4j` Python driver, `react-force-graph-3d` (Three.js), Recharts, Zustand, Tailwind CSS. |

---

## 2. Scope

### Include
* **3D Graph Exploration (`CriminalGraph3D.tsx`):** Force-directed 3D WebGL canvas, category node coloring, particle flow on edges, camera orbit/pan/zoom, focus centering, and path highlighting.
* **Workspace Panels (`datathon/src/components/network/`):** Node detail drawer (`NodeDetailPanel`), Edge verification & provenance drawer (`EdgeDetailPanel`), Investigative Path Finder (`PathFinderPanel`), Gang Syndicate Hierarchy (`GangNetworkView`), Centrality Link Analysis (`LinkAnalysisPanel`), and Multi-Filter Drawer (`NetworkFilterPanel`).
* **Backend Graph Routing (`routes/network.py`):** 11 endpoints serving full graph rollups, person-centric expansions, case subgraphs, gang structures, BFS shortest path, link centrality, and Neo4j synchronization.
* **Graph Synthesis Engine (`services/network/network_service.py`):** 1,605-line relational-to-graph translation engine deriving nodes and edges from PostgreSQL ORM tables with demo-seed provenance tagging.
* **Neo4j Dual-Mode Integration (`services/neo4j/client.py`):** Cypher query driver supporting 8 node labels and 7 edge types with schema constraints and bi-directional synchronization.

### Exclude
* Analytical spatial KDE clustering (handled by **Hotspot Module**).
* OCR document text extraction (handled by **Data Module**).
* Free-form conversational copilot responses (handled by **AI Copilot Module**).

### Future Scope
* Graph Neural Network (GNN) link prediction models for unobserved syndicate connections.
* Automated real-time police communication call-detail-record (CDR) graph ingest.
* Multi-user shared canvas state collaboration.

---

## 3. Existing Implementation

| Component | File / Location | Status | Description |
|---|---|---|---|
| **Network Page View** | `datathon/src/pages/Network/index.tsx` | Implemented | 22KB page managing views (`3d_explorer`, `shortest_path`, `path_finder`, `gangs`, `link_analysis`, `timeline`), filters, and drawers. |
| **3D Force Graph** | `datathon/src/components/network/CriminalGraph3D.tsx` | Implemented | 33KB `react-force-graph-3d` renderer with camera tweening, custom node geometry, particle flow, and path highlighting. |
| **Node Detail Panel** | `datathon/src/components/network/NodeDetailPanel.tsx` | Implemented | 17KB drawer showing entity profile, photo, criminal status, cases count, gang links, and degree neighbors. |
| **Edge Detail Panel** | `datathon/src/components/network/EdgeDetailPanel.tsx` | Implemented | 10KB drawer showing relationship type, provenance badge, verification status, and supporting evidence references. |
| **Path Finder Panel** | `datathon/src/components/network/PathFinderPanel.tsx` | Implemented | 17KB panel executing evidence-backed connection paths between two entities with hop-by-hop breakdown. |
| **Gang Network View** | `datathon/src/components/network/GangNetworkView.tsx` | Implemented | 9.5KB hierarchical tree view displaying syndicate leadership, lieutenants, foot soldiers, and territory stations. |
| **Link Analysis Panel** | `datathon/src/components/network/LinkAnalysisPanel.tsx` | Implemented | 6.3KB panel presenting centrality metrics, bridge nodes, and broker detection tables. |
| **Network Filter Drawer**| `datathon/src/components/network/NetworkFilterPanel.tsx`| Implemented | 13.4KB multi-parameter filter drawer: crime types, districts, stations, FIR numbers, victim names, risk slider. |
| **Network Hook** | `datathon/src/hooks/useNetwork.ts` | Implemented | Custom React hook managing active views, filter state, graph data loading, and pathfinding state. |
| **Network Backend Router**| `backend/app/routes/network.py` | Implemented | 341-line router with 11 endpoints for graph queries, entity search, pathfinding, and Neo4j sync. |
| **Graph Service Engine** | `backend/app/services/network/network_service.py` | Implemented | 1,605-line query engine deriving nodes/edges from PostgreSQL or Neo4j with demo provenance separation. |
| **Neo4j Client** | `backend/app/services/neo4j/client.py` | Implemented | 456-line Cypher client managing schema constraints, full-graph sync, and native shortest-path traversal. |
| **Neo4j Database Driver**| `backend/app/database/neo4j.py` | Implemented | Driver lifecycle and connection pooling (`GraphDatabase.driver`). |
| **Network Pydantic Models**| `backend/app/models/network.py` | Implemented | 222-line schema file: `NetworkNode`, `NetworkEdge`, `NetworkGraphResponse`, `CentralityMetric`, `AIGraphInsight`. |

---

## 4. Architecture / Components

### CURRENT Architecture

```text
[Browser: Datathon React Client]
  │
  ├─► Network/index.tsx (Network Workspace at /network)
  │    │
  │    ├─► useNetwork Hook (manages activeView, filters, graphData, pathfinding)
  │    │
  │    └─► Interactive Sub-Components:
  │         ├─ CriminalGraph3D (react-force-graph-3d WebGL force canvas)
  │         ├─ NodeDetailPanel (entity dossier & direct neighbors)
  │         ├─ EdgeDetailPanel (provenance, verification, supporting evidence)
  │         ├─ PathFinderPanel (evidence-backed connection path finder)
  │         ├─ GangNetworkView (syndicate hierarchy tree)
  │         ├─ LinkAnalysisPanel (centrality metrics & broker detection)
  │         └─ NetworkTimelineSlider (temporal window slider)
  │
  ▼ (HTTP REST with Bearer Token)
+────────────────────────────────────────────────────────────────────────+
| FastAPI Gateway & RBAC Layer (app/routes/network.py)                   |
| - Depends(require_roles(*ALL_ROLES))                                   |
+────────────────────────────────────────────────────────────────────────+
  │
  ▼
+────────────────────────────────────────────────────────────────────────+
| Network Service Engine (app/services/network/network_service.py)       |
| - Relational-to-graph synthesis across 7 PostgreSQL ORM tables         |
| - Demo seed isolation & provenance tagging (_apply_seed_flags)         |
| - In-memory NetworkX-style BFS pathfinding & centrality calculations   |
+────────────────────────────────────────────────────────────────────────+
  │
  ├─► Neo4j Client (app/services/neo4j/client.py)
  │    ├─ If Neo4j Active: Runs Cypher queries (`fetch_full_graph_neo4j`)|
  │    └─ If Neo4j Down: Transparent fallback to PostgreSQL synthesis    |
  │
  ▼
+────────────────────────────────────────────────────────────────────────+
| PostgreSQL Database (Supabase)                                         |
| Tables: criminals, firs, fir_criminal_links, fir_victim_links,         |
|         crime_cases, locations, officers                               |
+────────────────────────────────────────────────────────────────────────+
```

### TARGET / REQUIRED Architecture

```text
[Browser: Datathon Client]
  │
  ▼ (REST / Realtime WebSockets)
+────────────────────────────────────────────────────────────────────────+
| FastAPI Gateway                                                        |
+────────────────────────────────────────────────────────────────────────+
  │
  ▼
+────────────────────────────────────────────────────────────────────────+
| Dual-Sync Graph Pipeline                                               |
| - PostgreSQL handles transactional operational truth (ACID).           |
| - Automated Change Data Capture (CDC) / background worker updates      |
|   Neo4j graph instantly upon case/FIR commits (replaces manual sync).  |
+────────────────────────────────────────────────────────────────────────+
  │
  ├─► Neo4j Graph Database (Aura / Bolt)
  │    └─ Cypher graph traversals, GDS centrality, community detection   |
  │
  └─► PostgreSQL Primary Storage
       └─ Relational entities, evidence documents, chain-of-custody      |
```

---

## 5. Components / Classes / Services

### Frontend Components

| Component | File Path | Props / State | Responsibilities |
|---|---|---|---|
| `NetworkPage` | `datathon/src/pages/Network/index.tsx` | State: `activeView`, `selectedNode`, `selectedLink`, `highlightPath`. | Orchestrates toolbar, filters, 3D canvas, and right-hand side panels. |
| `CriminalGraph3D` | `datathon/src/components/network/CriminalGraph3D.tsx` | Props: `graphData`, `onNodeSelect`, `onLinkSelect`, `highlightPath`. | 3D WebGL force simulation, particle flows, node color badges, camera focus tweening. |
| `NodeDetailPanel` | `datathon/src/components/network/NodeDetailPanel.tsx` | Props: `node`, `nodes`, `links`, `onClose`, `onSelectNode`. | Displays node risk score, alias list, contact info, gang links, and neighbor connections. |
| `EdgeDetailPanel` | `datathon/src/components/network/EdgeDetailPanel.tsx` | Props: `link`, `nodes`, `onClose`, `onSelectNode`. | Displays edge relationship type, verification badge, provenance, and supporting evidence list. |
| `PathFinderPanel` | `datathon/src/components/network/PathFinderPanel.tsx` | Props: `nodes`, `onPathFound`, `onReset`. | Select source/target nodes, set max hops (1–5), execute BFS search. |
| `GangNetworkView` | `datathon/src/components/network/GangNetworkView.tsx` | Props: `gangs`, `onSelectMember`. | Renders expandable hierarchical tree: Boss → Lieutenants → Operators. |
| `LinkAnalysisPanel`| `datathon/src/components/network/LinkAnalysisPanel.tsx`| Props: `data: LinkAnalysisData`. | Centrality tables: Degree, Betweenness, Closeness, PageRank, and key brokers. |
| `useNetwork` | `datathon/src/hooks/useNetwork.ts` | State: `graphData`, `loading`, `error`, `isNeo4jBacked`, `seedNodeCount`. | Custom hook executing network APIs with debounced filter evaluation. |

### Backend Routes & Services

| Component | File Path | Responsibility | Important Methods / Functions |
|---|---|---|---|
| `network_router` | `backend/app/routes/network.py` | Exposes REST endpoints for graph data, search, pathfinding, and Neo4j sync. | `get_full_graph()`, `get_person_network()`, `search_network_entities()`, `get_case_network()`, `list_gang_networks()`, `calculate_shortest_path()`, `find_connection_path()`, `perform_graph_link_analysis()`, `sync_neo4j_database()`. |
| `network_service` | `backend/app/services/network/network_service.py` | Derives graph structures, calculates centralities, isolates demo seed content. | `get_full_network_graph()`, `get_person_network_graph()`, `get_case_network_graph()`, `find_connection_path()`, `perform_link_analysis()`, `get_organization_gang_networks()`, `generate_ai_graph_insights()`. |
| `neo4j_client` | `backend/app/services/neo4j/client.py` | Cypher driver queries and Postgres-to-Neo4j database synchronization. | `sync_postgres_to_neo4j()`, `fetch_full_graph_neo4j()`, `query_shortest_path_neo4j()`, `is_neo4j_available()`. |

---

## 6. Database Design

### 1. PostgreSQL Relational Foundation
The Network module does not require a proprietary relational graph table; it derives graph intelligence from operational domain tables:

### Consumed Table: `criminals`

| Column | Type | Constraints | Network Usage |
|---|---|---|---|
| `id` | UUID | PK | Maps to graph node ID: `criminal-{id}` |
| `full_name` | VARCHAR(255) | NOT NULL | Node display label (`node.name`) |
| `aliases` | VARCHAR(500) | NULLABLE | Search index and node detail card |
| `status` | VARCHAR(50) | DEFAULT `'active'` | Node category: `suspect` (if at large) or `offender` |
| `gang_affiliation` | VARCHAR(150) | NULLABLE | Generates `GANG_ASSOCIATION` edges to Organization nodes |

### Consumed Table: `firs`

| Column | Type | Constraints | Network Usage |
|---|---|---|---|
| `id` | UUID | PK | Maps to case node ID: `case-{id}` |
| `fir_number` | VARCHAR(50) | NOT NULL, UNIQUE | Node display label: `FIR #{fir_number}` |
| `crime_case_id` | UUID | FK -> `crime_cases.id` | Links FIR node to parent Case node |

### Consumed Table: `fir_criminal_links`

| Column | Type | Constraints | Network Usage |
|---|---|---|---|
| `fir_id` | UUID | FK -> `firs.id`, PK | Connects criminal to FIR (`PERSON_CASE` / `LINKED_TO`) |
| `criminal_id` | UUID | FK -> `criminals.id`, PK | Co-accused link: 2 criminals on 1 FIR -> `SHARED_CASE` edge |
| `role` | VARCHAR(50) | NOT NULL | Edge attribute: `accused`, `co_accused`, `kingpin` |

### Consumed Table: `fir_victim_links`

| Column | Type | Constraints | Network Usage |
|---|---|---|---|
| `fir_id` | UUID | FK -> `firs.id`, PK | Connects victim to FIR (`VICTIM_OF`) |
| `victim_id` | UUID | FK -> `victims.id`, PK | Connects accused criminal to victim (`PERSON_VICTIM`) |

### Consumed Table: `crime_cases`

| Column | Type | Constraints | Network Usage |
|---|---|---|---|
| `id` | UUID | PK | Maps to case node ID: `case-{id}` |
| `case_number` | VARCHAR(50) | NOT NULL, UNIQUE | Display title: `Case {case_number}` |
| `location_id` | UUID | FK -> `locations.id` | Generates `OCCURRED_AT` edge to Location node |
| `assigned_officer_id`| UUID | FK -> `officers.id` | Generates `INVESTIGATED_BY` edge to Officer node |

---

### 2. Neo4j Graph Database Schema (When Active)

When Neo4j is connected, records are mapped to native graph nodes and edges:

#### Node Labels & Constraints:
* `(:Criminal {id: STRING UNIQUE})`: Suspects and convicted offenders.
* `(:Case {id: STRING UNIQUE})`: Crime cases and registered FIRs.
* `(:Location {id: STRING UNIQUE})`: Police stations and districts.
* `(:Victim {id: STRING UNIQUE})`: Complainants and victims.
* `(:Officer {id: STRING UNIQUE})`: Investigating and arresting police officers.
* `(:Vehicle {id: STRING UNIQUE})`: Identified motor vehicles / license plates.
* `(:Weapon {id: STRING UNIQUE})`: Seized weapons or firearms.
* `(:Organization {id: STRING UNIQUE})`: Gang syndicates and criminal outfits.

#### Relationship Types:
* `(:Criminal)-[:KNOWS {provenance: 'SHARED_CASE'}]->(:Criminal)`: Co-accused in same FIR.
* `(:Criminal)-[:ASSOCIATED_WITH]->(:Organization)`: Member of syndicate.
* `(:Criminal)-[:USED]->(:Weapon|:Vehicle)`: Tool utilized during incident.
* `(:Officer)-[:ARRESTED_BY]->(:Criminal)`: Custodial arrest record.
* `(:Criminal)-[:LINKED_TO]->(:Case)`: Charged in case/FIR.
* `(:Case)-[:OCCURRED_AT]->(:Location)`: Incident jurisdiction.
* `(:Victim)-[:VICTIM_OF]->(:Case)`: Complainant/victim in FIR.

---

## 7. API Design

| Method | Endpoint | Purpose | Query / Body Parameters | Response Schema | Auth / Roles |
|---|---|---|---|---|---|
| `GET` | `/api/v2/network/graph` | Full criminal relationship network | `category_filter`, `min_risk`, `limit`, `criminal_name`, `crime_type`, `district`, `police_station`, `fir_number`, `victim_name`, `date_from`, `date_to`, `exclude_demo` | `NetworkGraphResponse` | All authenticated roles |
| `GET` | `/api/v2/network/person/{id}` | Ego-network centered on person | Path: `id`, Query: `depth` (1–4), `exclude_demo`, `provenance_filter` | `NetworkGraphResponse` | All authenticated roles |
| `GET` | `/api/v2/network/case/{id}` | Relationship network around case | Path: `id`, Query: `exclude_demo`, `provenance_filter` | `NetworkGraphResponse` | All authenticated roles |
| `GET` | `/api/v2/network/search` | Search entities across all categories | Query: `q` (min 1 char), `limit` (max 50) | `{results: NetworkSearchResult[], query, total}` | All authenticated roles |
| `GET` | `/api/v2/network/gangs` | List active gang networks | None | `GangNetworkSummary[]` | All authenticated roles |
| `GET` | `/api/v2/network/gangs/{id}` | Syndicate hierarchy tree | Path: `id` | `GangNetworkSummary` | All authenticated roles |
| `POST` | `/api/v2/network/shortest-path` | BFS shortest path | Body: `{source_id, target_id, max_depth}` | `ShortestPathResponse` | All authenticated roles |
| `GET` | `/api/v2/network/path` | Evidence-backed connection path | Query: `source_id`, `target_id`, `max_hops` (1–5) + same filters as `/graph` | `NetworkPathResponse` | All authenticated roles |
| `POST` | `/api/v2/network/link-analysis` | Centrality and broker detection | None | `LinkAnalysisResponse` | All authenticated roles |
| `GET` | `/api/v2/network/insights` | AI graph threat intelligence alerts| None | `AIGraphInsight[]` | All authenticated roles |
| `POST` | `/api/v2/network/sync-neo4j` | Sync Postgres rows to Neo4j | None | `{status, message, synced_nodes, synced_edges}` | `admin`, `crime_analyst` |

---

## 8. Input / Output

### Inputs
* **Graph Filters:**
  * `category_filter`: Node type filter (`suspect`, `offender`, `case`, `location`, `victim`, `gang`, `officer`).
  * `min_risk`: Minimum risk score slider (0.0 – 100.0).
  * `criminal_name`, `victim_name`: Case-insensitive substring matching.
  * `crime_type`, `district`, `police_station`, `fir_number`: Comma-separated multi-value OR filters.
  * `date_from`, `date_to`: ISO-8601 or YYYY-MM-DD date range filters.
  * `exclude_demo`: Boolean flag stripping demo/seed records (`isSeed=True`).
* **Path Parameters:** `source_id`, `target_id`, `max_hops` (1–5).

### Outputs
* **Graph JSON Object (`NetworkGraphResponse`):**
  * `nodes`: Array of `NetworkNode` objects (`id`, `name`, `category`, `riskScore`, `casesCount`, `district`, `isSeed`).
  * `edges`: Array of `NetworkEdge` objects (`source`, `target`, `relationship`, `weight`, `provenance`, `verification_status`, `evidence`).
  * `is_neo4j_backed`: Boolean indicating if query was resolved by Neo4j or SQL fallback.
  * `seed_node_count`: Number of demo seed nodes present in the response.
* **Centrality Metrics (`LinkAnalysisResponse`):** Degree, betweenness, closeness, PageRank scores, and bridge node identifiers.

---

## 9. Data Flow

### 1. Dynamic Graph Hydration Flow

```text
User selects Filters (District, Category, Date Range)
  │
  ▼
useNetwork Hook calls getFullNetworkGraph(filters)
  │
  ▼ (HTTP GET /api/v2/network/graph)
FastAPI Router (routes/network.py: get_full_graph)
  │
  ▼
network_service.get_full_network_graph()
  │
  ├─► Check Neo4j Connectivity (is_neo4j_available)
  │    │
  │    ├─► [TRUE] Execute Cypher via fetch_full_graph_neo4j():
  │    │          MATCH (n)-[r]->(m) WHERE ... RETURN n, r, m
  │    │
  │    └─► [FALSE] Execute PostgreSQL Relational Synthesis:
  │               1. Query FIRs matching date/district/station filters.
  │               2. Query FIRCriminalLink & FIRVictimLink for matching FIRs.
  │               3. Synthesize nodes (Criminals, Victims, Cases, Locations).
  │               4. Synthesize co-accused edges (Criminal <-> Criminal) with evidence.
  │               5. Synthesize accused-victim edges (Criminal <-> Victim).
  │               6. Apply demo-seed flags (_apply_seed_flags).
  │
  ▼
JSON Response (NetworkGraphResponse)
  │
  ▼
CriminalGraph3D: Renders 3D WebGL force simulation with particle animations
```

### 2. Evidence-Backed Path Finder Flow

```text
User selects Source Node ("criminal-uuid1") and Target Node ("victim-uuid2")
  │
  ▼
PathFinderPanel triggers GET /api/v2/network/path?source_id=...&target_id=...&max_hops=3
  │
  ▼
network_service.find_connection_path():
  1. Executes Breadth-First Search (BFS) bounded by max_hops over filtered FIR links.
  2. For every hop, retrieves the exact linking record (FIR number, sections, date).
  3. Returns NetworkPathResponse with nodes array and connecting relationships.
  │
  ▼
Frontend highlights the path:
  - Non-path nodes and links are dimmed in CriminalGraph3D.
  - PathFinderPanel displays step-by-step evidence justification cards.
```

---

## 10. Module Interactions

| Source Module | Interaction | Target Module | Status |
|---|---|---|---|
| **Criminals** | Supplies offender profiles, aliases, and gang affiliations | **Network** | Current |
| **FIR** | Supplies registered charges, complainants, and co-accused rosters | **Network** | Current |
| **Crime Cases** | Supplies incident dates, categories, locations, and priorities | **Network** | Current |
| **Victims** | Supplies victim demographics and links to filed FIRs | **Network** | Current |
| **Officers** | Supplies assigned investigating officers and badge identifiers | **Network** | Current |
| **Evidence** | Supplies physical evidence references attached to edge detail panels | **Network** | Current |
| **Network** | Dispatches `navigate-tab` events with `targetId` to open entity dossiers | **Cases / Criminals** | Current |
| **Neo4j** | Graph database engine executing Cypher traversals and shortest paths | **Network** | Current (Dual-mode) |

---

## 11. Business Logic / Rules

| Rule # | Condition | Action |
|---|---|---|
| **BR-NET01** | Non-Accusatory Graph Association Rule. | **A graph connection must NEVER be interpreted as proof of guilt.** Co-accused, association, or victim edges represent recorded investigatory linkages, not judicial guilt. UIs must label relationships objectively. |
| **BR-NET02** | Filter-Guarded Pathfinding. | Path searches (`/network/path`) must apply the exact same active filter constraints (district, dates, crime type) as the main graph, ensuring connections never leak through excluded records. |
| **BR-NET03** | Demo Seed Separation. | Nodes and edges originating from the bundled demo seed dataset must be tagged with `isSeed=True`, `provenance='DEMO_SEED'`, and visual amber tags to maintain transparency with live intelligence. |
| **BR-NET04** | Dual-Engine Failover. | If Neo4j is offline, the service must transparently fall back to PostgreSQL relational synthesis without throwing 500 errors to the user. |
| **BR-NET05** | Breadth-First Search Hop Limit. | Connection path searches are strictly bounded to a maximum of 5 hops (`max_hops <= 5`) to prevent exponential memory consumption and thread blocking. |
| **BR-NET06** | Self-Loop Prevention. | Path searches between an entity and itself (`source_id == target_id`) are rejected immediately with HTTP 400 Bad Request. |

---

## 12. Validation

| Input / Condition | Validation Rule | Failure Behaviour |
|---|---|---|
| **Date Range** | `date_from` and `date_to` must be valid YYYY-MM-DD or ISO-8601 strings. | Rejected with HTTP 422 Unprocessable Entity with descriptive date error. |
| **Hop Bounds** | `max_hops` must be an integer between 1 and 5. | FastAPI returns HTTP 422 if out of bounds. |
| **Risk Score Bounds** | `min_risk` must be a float between 0.0 and 100.0. | FastAPI returns HTTP 422 if out of bounds. |
| **Graph Node Limit** | `limit` query parameter capped between 1 and 2,000 nodes. | Enforced by FastAPI `Query(le=2000)`; prevents frontend WebGL memory overflow. |
| **Entity ID Strings** | Must follow prefix format: `criminal-{uuid}`, `victim-{uuid}`, `case-{uuid}`, `officer-{uuid}`. | If invalid prefix or entity not found, service returns empty graph or HTTP 404. |

---

## 13. Error Handling

| Error Scenario | Cause | System Behaviour |
|---|---|---|
| **Neo4j Unreachable** | Neo4j Aura service stopped or bad credentials. | `is_neo4j_available()` returns `False`; service logs warning and serves graph from PostgreSQL via SQL fallback. |
| **Empty Filter Matches** | Filter criteria (e.g. non-existent district) match 0 rows. | Returns `NetworkGraphResponse` with `nodes: []`, `edges: []`; UI displays `SearchX` empty state with "Clear Filters" button. |
| **Path Disconnected** | No connection exists between source and target within hop limit. | Returns `NetworkPathResponse` with `path_found: false`; UI displays "No evidence-backed path found within X hops". |
| **Three.js WebGL Context Loss**| GPU driver crash or memory pressure. | `CriminalGraph3D.tsx` catches WebGL error, displays warning banner, and offers "Reset Graph View" button. |
| **Large Node Overload** | Graph query returns >1,500 nodes. | UI limits initial rendering to 500 nodes by default and displays performance advisory chip. |

---

## 14. Security / Access Control

| Area | Requirement / Current Implementation |
|---|---|
| **Authentication Gate** | Mandatory JWT Bearer token authentication validated via `Depends(get_current_user)`. |
| **Role-Based Access** | All official police roles (`admin`, `crime_analyst`, `investigator`, `inspector`, `forensic`, `policymaker`, `viewer`) can view graphs. Neo4j synchronization (`POST /network/sync-neo4j`) is restricted to `admin` and `crime_analyst`. |
| **Audit Logging** | Every network exploration view and dossier export is logged in `audit_logs` via `addLog(user.name, user.badgeId, 'PAGE_VIEW', 'Accessed Network Graph')`. |
| **Sensitive PII Protection**| Victim contact numbers and domestic addresses are hidden in graph nodes; available only within verified role-gated detail drawers. |

---

## 15. Existing vs Required Functionality

### Already Implemented
* Interactive 3D WebGL graph exploration (`react-force-graph-3d`) with camera positioning, node coloring, and particle flow.
* Relational-to-graph synthesis engine deriving nodes and edges dynamically from PostgreSQL tables.
* Dual-backend execution: Primary Neo4j graph queries with seamless fallback to PostgreSQL relational queries.
* Evidence-backed connection path finder (`GET /network/path`) tracing relationships to supporting FIR records.
* Centrality link analysis calculating degree, betweenness, closeness, and PageRank scores.
* Gang syndicate hierarchy explorer with leadership rosters.
* Multi-parameter filter drawer (crime types, districts, stations, FIR numbers, dates, risk score).
* Demo seed provenance tracking (`isSeed`, `DEMO_SEED`, `MIXED`).

### Partially Implemented
* **Automated Neo4j Sync:** Neo4j sync currently requires manual trigger (`POST /network/sync-neo4j`); no automated background worker exists to push new cases/FIRs immediately upon creation.
* **Vehicle & Weapon Nodes:** Extracted from text via regex (`_extract_tools`); no standalone relational tables exist for vehicles or weapons.

### Not Implemented
* Graph Neural Network (GNN) link prediction model.
* Call Detail Record (CDR) telecommunications graph ingestion.

### Required Changes
* Implement an automated background task to trigger incremental Neo4j synchronization when new cases or FIRs are committed.
* Add 2D alternative layout mode (Cytoscape/D3 canvas) for low-end hardware devices that struggle with WebGL 3D.

---

## 16. Implementation Tasks

| ID | Task | Files / Components | Priority | Status |
|---|---|---|---|---|
| **NET-01** | Automated Incremental Neo4j Sync Worker | `backend/app/services/neo4j/client.py`, `crime_cases.py` | High | Required |
| **NET-02** | 2D Alternative Graph View Toggle | `datathon/src/components/network/CriminalGraph3D.tsx` | Medium | Required |
| **NET-03** | Persistent Graph Bookmark & Notes Drawer | `datathon/src/pages/Network/index.tsx`, `api.ts` | Medium | Required |
| **NET-04** | Subgraph PDF Intelligence Dossier Export | `datathon/src/utils/downloader.ts` | Low | Required |

---

## 17. Files to Create / Modify

### Modify

| File | Changes |
|---|---|
| [backend/app/services/neo4j/client.py](file:///c:/Users/aswin/OneDrive/Documents/Saksha/backend/app/services/neo4j/client.py) | Add `sync_single_case_neo4j(case_id)` for lightweight incremental synchronization instead of full-database rebuild. |
| [backend/app/routes/crime_cases.py](file:///c:/Users/aswin/OneDrive/Documents/Saksha/backend/app/routes/crime_cases.py) | Call `sync_single_case_neo4j` in a background worker session following case and FIR creation. |
| [datathon/src/components/network/CriminalGraph3D.tsx](file:///c:/Users/aswin/OneDrive/Documents/Saksha/datathon/src/components/network/CriminalGraph3D.tsx) | Add 2D/3D mode switch toggle in graph toolbar to support low-spec mobile or tablet hardware. |

### Create

| File | Purpose |
|---|---|
| `datathon/src/components/network/GraphExportModal.tsx` | Export active visible network subgraph as high-resolution PNG image or structured intelligence dossier. |

---

## 18. Dependencies

### Current Dependencies
* `react-force-graph-3d` / `three`: 3D WebGL canvas force simulation rendering (`package.json`).
* `neo4j`: Official Python Neo4j driver for Cypher bolt connections (`requirements.txt`).
* `sqlalchemy`: PostgreSQL ORM for relational graph synthesis (`requirements.txt`).
* `recharts`: Centrality distribution bar charts in Link Analysis (`package.json`).
* `lucide-react`: Network node icons and toolbar controls (`package.json`).

### Required Future Dependencies
* `networkx`: Optional Python graph algorithms package for advanced GDS graph clustering in offline environments.

---

## 19. Testing / Verification

| Test Case | Expected Result |
|---|---|
| Request `/network/graph` without filters | Returns full graph of registered criminals, victims, and cases; all edges carry provenance and verification status. |
| Request `/network/person/{id}` with `depth=2` | Returns ego-network up to 2 hops away; zero unconnected orphan nodes. |
| Request `/network/path` between 2 co-accused | Returns 1-hop path connected by `SHARED_CASE` with linking FIR number and sections in evidence list. |
| Disconnect Neo4j database | Service detects offline status, falls back to SQL query synthesis, sets `is_neo4j_backed=false`, returns valid graph. |
| Filter by district "Mysuru City" | Graph contains only incidents and individuals active within Mysuru City jurisdiction. |
| Request `/network/sync-neo4j` as unauthorized user | HTTP 403 Forbidden returned; only `admin` and `crime_analyst` roles permitted. |

---

## 20. Final Implementation Summary

### Current State
* SAKSHA's Network module is an operational **Investigation Relationship Graph** that dynamically translates PostgreSQL relational records (co-accused FIRs, victim links, case locations) into graph nodes and edges.
* It features dual-mode execution: it queries Neo4j via Cypher when available, and smoothly falls back to SQL query synthesis when Neo4j is offline.
* The frontend provides an interactive 3D WebGL force-directed canvas with particle animations, evidence-backed connection pathfinding, centrality link analysis, and gang hierarchy inspection.

### Main Gaps
* Neo4j synchronization currently requires manual invocation (`/network/sync-neo4j`); incremental change-data-capture synchronization is needed.
* Devices without dedicated WebGL acceleration may experience reduced frame rates when rendering >1,000 nodes.

### Required Next Steps
1. Implement incremental single-case Neo4j synchronization hook upon case commit (Task NET-01).
2. Add a 2D canvas layout toggle for resource-constrained hardware (Task NET-02).
3. Connect graph export directly to investigation dossier generator (Task NET-04).
