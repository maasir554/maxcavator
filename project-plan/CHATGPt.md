# MAXCAVATOR

### A Browser-Native Analytical Warehouse for Legacy PDFs

---

## 1. Executive Summary

**MAXCAVATOR** is a **local-first, browser-native analytical system** that transforms legacy PDF documents into **structured, queryable relational data**.

Instead of treating PDFs as text blobs for chat-based Q&A, MAXCAVATOR:

* Extracts **tables and structured data**
* Normalizes them into **PostgreSQL tables (WASM)**
* Maintains a **schema registry + data catalog**
* Enables **SQL-first querying**, with **RAG as a fallback**

All heavy processing (OCR, parsing, embedding, storage) runs **entirely inside the user’s browser**, ensuring:

* Zero data leakage
* Low latency
* Offline persistence

---

## 2. Core Principles

1. **Local-First by Default**
   No document content is stored server-side.

2. **SQL Before Semantics**
   Structured queries are preferred over LLM hallucination.

3. **Deterministic > Generative Where Possible**
   Heuristics first, LLMs second.

4. **Traceability & Provenance**
   Every extracted row maps back to its source document and page.

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Layer         | Technology                           |
| ------------- | ------------------------------------ |
| UI            | Vite + React (TypeScript)            |
| Styling       | TailwindCSS + shadcn/ui              |
| State         | Zustand (UI), TanStack Query (async) |
| PDF Rendering | PDF.js                               |
| OCR           | Tesseract.js (WASM)                  |
| DB            | PGlite (PostgreSQL in WASM)          |
| Vector Search | `pgvector` (WASM build)              |
| AI Inference  | Groq SDK (Moonshot / Kimi-k2)        |
| Workers       | Web Workers + Comlink                |
| Persistence   | IndexedDB                            |

---

## 4. System Overview

### 4.1 Execution Model

* **Main Thread**: UI, chat, visualization
* **Extraction Worker**:

  * PDF rasterization
  * OCR
  * LLM extraction
  * Schema resolution
* **Database Worker**:

  * PGlite execution
  * Vector search
  * SQL sandboxing

---

## 5. Database Design (Client-Side Warehouse)

### 5.1 System Tables

#### `documents`

Tracks ingestion and processing state.

| Column          | Type                                         |
| --------------- | -------------------------------------------- |
| id              | UUID                                         |
| filename        | TEXT                                         |
| source_url      | TEXT                                         |
| status          | ENUM (queued, processing, paused, completed) |
| total_pages     | INT                                          |
| processed_pages | INT                                          |
| created_at      | TIMESTAMP                                    |

---

#### `schema_registry`

Acts as a **local data catalog**.

| Column             | Type   |
| ------------------ | ------ |
| id                 | UUID   |
| table_name         | TEXT   |
| schema_json        | JSONB  |
| description        | TEXT   |
| schema_embedding   | VECTOR |
| column_fingerprint | TEXT   |

> `column_fingerprint` = normalized + sorted column names & types

---

#### `semantic_chunks`

Fallback unstructured store (RAG).

| Column       | Type   |
| ------------ | ------ |
| id           | UUID   |
| document_id  | UUID   |
| page_number  | INT    |
| content_text | TEXT   |
| embedding    | VECTOR |

---

### 5.2 Dynamic User Tables

* Created on demand
* Namespaced when necessary:

  ```
  invoice_items__acme_2023
  ```
* Mandatory metadata columns:

  * `_source_doc_id`
  * `_page_num`

---

## 6. Extraction Engine

### 6.1 Job State Machine (Pause / Resume)

Each document maintains:

```ts
{
  documentId,
  processedPages,
  pageTextHashes[],
  status
}
```

**Resume Logic**

* Skip pages whose OCR hash already exists
* Continue from last clean checkpoint

---

### 6.2 Extraction Pipeline (Per Page)

1. **PDF Rasterization**

   * PDF.js → OffscreenCanvas

2. **OCR**

   * Tesseract.js (WASM)
   * Output: raw text + confidence

3. **Heuristic Pre-Analysis**

   * Numeric density
   * Column alignment patterns
   * Repeated whitespace
   * Delimiters (`|`, tabs)

   → produces `table_likelihood: high | medium | low`

4. **LLM Extraction Agent**

   * Triggered only if likelihood ≥ medium
   * Temperature = 0
   * Strict JSON validation

5. **Schema Resolution**

   * See Section 7

6. **Data Insertion**

   * Insert rows into resolved table
   * Attach provenance metadata

7. **Redundant Storage**

   * Chunk full page text
   * Embed → store in `semantic_chunks`

---

## 7. Schema Resolution (Critical Logic)

### 7.1 Multi-Factor Schema Matching

Schemas are **not matched by embeddings alone**.

**Final Schema Match Score**

```
score =
  0.6 * embedding_similarity +
  0.2 * column_name_overlap +
  0.2 * type_compatibility
```

#### Thresholds

* **≥ 0.85** → candidate match
* **≥ 0.90** → auto-merge
* **< 0.85** → new table

---

### 7.2 Column Normalization

* Snake_case normalization
* Alias mapping (`amt`, `amount`, `total_amount`)
* Levenshtein similarity for OCR errors

---

## 8. Intelligent Assistant Layer

### 8.1 Query Router

**Input:** Natural language question

1. Embed query
2. Vector search on `schema_registry`
3. Decision:

   * **Match found → SQL Agent**
   * **No match → RAG Fallback**

---

### 8.2 SQL Agent (Structured Path)

**Safety Controls**

* Read-only transactions
* Keyword blacklist (`DROP`, `ALTER`, etc.)
* Single-statement enforcement

**Failure Contract**

```sql
SELECT 'INSUFFICIENT_DATA' AS error;
```

**Flow**

1. Generate SQL
2. Execute in PGlite
3. Summarize result in natural language

---

### 8.3 RAG Fallback (Unstructured Path)

* Vector search on `semantic_chunks`
* Top-k (default 5)
* Context-bounded answering
* Explicit uncertainty if data missing

---

## 9. AI Prompt Specifications

### 9.1 Table Extraction Prompt

```text
You are a data extraction engine.

Analyze the OCR text from a document page.
- If no tables exist, return an empty array.
- Do NOT infer or hallucinate data.
- Ensure column names are consistent across rows.

Output JSON ONLY.

[
  {
    "table_name": "snake_case",
    "description": "summary",
    "schema": [{"name": "col", "type": "TEXT|NUMERIC|DATE"}],
    "rows": [{"col": "value"}]
  }
]
```

---

### 9.2 SQL Agent Prompt

```text
You have access to a read-only PostgreSQL database.

User question:
"{user_query}"

Table schema:
{schema_json}

Write ONE SQL query only.
If the answer cannot be computed, return:

SELECT 'INSUFFICIENT_DATA' AS error;
```

---

## 10. UI / UX Layout

### Left Sidebar

* PDF Upload / URL Import
* Processing Queue
* Per-document progress
* Global pause / resume

### Main View (Tabs)

1. **Chat Assistant**
2. **Data Explorer**

   * Table list (grouped by dataset)
   * Data grid
   * SQL preview

### Right Panel (Slide-Over)

* Live worker logs
* Schema merge events
* OCR confidence warnings

---

## 11. Implementation Timeline

### Week 1 – Foundation

* UI scaffold
* PGlite worker
* pgvector setup
* Data Explorer

### Week 2 – PDF + OCR

* PDF.js pipeline
* Tesseract worker
* Pause / resume system

### Week 3 – Extraction Intelligence

* Heuristic analyzer
* Schema scoring engine
* LLM extraction agent

### Week 4 – Assistant

* Query router
* SQL agent
* RAG fallback
* Safety enforcement

### Week 5 – Hardening

* IndexedDB persistence
* Large PDF stress tests
* Export (CSV / Parquet)

---

## 12. Future Extensions (Planned)

* Bounding-box provenance
* Deterministic extractors for invoices / bank statements
* DuckDB WASM support
* Dataset export & sharing
* Plugin architecture for extractors

---

## Final Note

This version of MAXCAVATOR is no longer:

> “Chat with PDFs”

It is:

> **A browser-native data warehouse that happens to talk.**

