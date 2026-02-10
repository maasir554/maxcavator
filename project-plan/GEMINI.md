Here is a comprehensive Technical Project Plan for **MAXCAVATOR**.

---

# Project Plan: MAXCAVATOR

**A Client-Side Legacy PDF Data Extractor & Contextual Querying Engine**

## 1. Executive Summary

MAXCAVATOR is a local-first web application designed to unlock data from legacy PDF documents. It moves the heavy lifting (OCR, Parsing, Embedding, Storage) entirely to the client's browser using WebAssembly technologies, ensuring privacy and zero-latency data handling. It utilizes **Groq AI (Moonshot Kimi-k2)** for high-speed inference to structure unstructured data into SQL tables, enabling complex analytical queries via an intelligent chat assistant.

---

## 2. Technical Architecture

### 2.1 Technology Stack

* **Frontend Framework:** Vite + React (TypeScript)
* **State Management:** Zustand (for UI state), TanStack Query (for async data)
* **AI Inference Provider:** Groq SDK (Model: `moonshot-v1-8k` or `kimi-k2-instruct`)
* **OCR Engine:** Tesseract.js (WASM version)
* **PDF Rendering:** PDF.js
* **Database (Client-Side):** PGlite (PostgreSQL in WASM)
* **Vector Search:** `pgvector` extension for PGlite
* **Background Processing:** Web Workers (Comlink for RPC)

### 2.2 System Diagram

---

## 3. Database Schema Strategy (PGlite)

The database will be initialized inside the browser. We utilize a hybrid approach: **Meta Tables** for system tracking and **Dynamic Tables** for user data.

### 3.1 System Tables

1. **`documents`**: Tracks uploaded files.
* `id` (UUID), `filename`, `source_url`, `status` (queued, processing, paused, completed), `total_pages`, `processed_pages`, `created_at`.


2. **`schema_registry`**: Stores schemas of extracted tables to facilitate merging data from different pages into single SQL tables.
* `id` (UUID), `table_name` (SQL compliant), `schema_json` (JSONB), `description_embedding` (VECTOR - for semantic matching).


3. **`semantic_chunks`**: Fallback RAG store.
* `id`, `document_id`, `page_number`, `content_text`, `embedding` (VECTOR).



### 3.2 Dynamic User Tables

When the AI detects a table (e.g., "Invoice Items"), the system creates a table `invoice_items` in PGlite.

* **Columns:** Dynamically generated based on AI inference + `_source_doc_id` + `_page_num`.

---

## 4. Core Engine: The Extraction Pipeline

This entire workflow runs inside a **Web Worker** to prevent UI blocking.

### 4.1 The "Pause/Resume" State Machine

The worker maintains a state object for every document ID.

* **State:** `Queue<Job>` where Job = `{ pdfBlob, processedPages: integer }`.
* **Logic:** Before processing page `N`, check `status` flag in IndexedDB/Zustand. If `PAUSED`, abort loop and save `processedPages` index.

### 4.2 Step-by-Step Extraction Flow

1. **Input:** User provides PDF Blob or URL.
2. **Rasterization:** PDF.js renders Page `N` to an OffscreenCanvas.
3. **OCR:** Tesseract.js extracts raw text from the canvas.
4. **AI Analysis (The Extraction Agent):**
* **Prompt:** Sends raw text to Groq.
* **Instruction:** "Identify tables. Return JSON containing an array of tables. For each table: provide a SQL-friendly name, a text summary of what it contains, the schema (columns/types), and the row data."


5. **Schema Resolution (The Critical Step):**
* *Check Memory:* Is this schema identical to the table on Page `N-1`? -> **Insert into previous table.**
* *Check Vector Store:* Embed the table description/columns. Search `schema_registry`. If High Similarity (>0.95) -> **Insert into existing table.**
* *New Table:* Create new SQL table in PGlite -> Register in `schema_registry` -> **Insert Data.**


6. **Redundancy:** The full raw text of the page is chunked, embedded via Groq (or local embedding model like `transformers.js` if bandwidth allows, otherwise Groq), and stored in `semantic_chunks`.

---

## 5. Intelligent Assistant Layer

The chat interface acts as a router between specific SQL execution and general RAG.

### 5.1 The Logic Flow

**User Query:** *"What was the total cost of widgets in 2023?"*

1. **Intent Classification & Schema Search:**
* Embed User Query.
* Perform Vector Search on `schema_registry`.
* **Decision:**
* *Match Found (e.g., `sales_data` table):* Proceed to SQL Agent.
* *No Match:* Proceed to RAG Fallback.




2. **Path A: SQL Agent (Structured Data)**
* **Context:** Provide Table Schema (`sales_data`) + User Query.
* **AI Task:** "Generate a PGlite-compatible SQL query to answer the user."
* **Execution:** Run SQL against PGlite.
* **Response:** AI summarizes the SQL result into natural language.


3. **Path B: RAG Fallback (Unstructured Data)**
* **Action:** Vector search on `semantic_chunks`.
* **Context:** Retrieve top 5 text chunks.
* **AI Task:** Answer query based on context.
* **Response:** "Based on the text..." or "Data not found."



---

## 6. Implementation Plan (Sequential)

### Phase 1: Foundation & Database (Week 1)

1. **Scaffold:** Vite + React + Tailwind + ShadcnUI.
2. **PGlite Integration:**
* Initialize PGlite in a separate worker.
* Install `pgvector` extension within the WASM build.
* Create helper functions: `executeQuery`, `createTable`, `vectorSearch`.


3. **Data Preview UI:** Build a generic "Database Viewer" component that lists all tables in PGlite and renders them as data grids.

### Phase 2: PDF & OCR Worker (Week 2)

1. **PDF.js Setup:** Implement `pdf-lib` or `pdf.js` to parse documents page-by-page.
2. **Tesseract.js:** Set up the WASM worker for Tesseract.
3. **Queue System:** Implement the circular progress UI.
* **State:** `useExtractionQueue` (Zustand).
* **Visuals:** Dashboard showing list of PDFs, circular progress per PDF, Play/Pause buttons.



### Phase 3: The AI Extraction Engine (Week 3)

1. **Groq Client:** Setup Groq SDK with `moonshot-v1` / `kimi-k2`.
2. **Schema Intelligence:**
* Implement the logic to compare incoming JSON schemas with stored schemas in `schema_registry`.
* Write the "Schema Merger" utility (handles slight column name variations).


3. **Pipeline Integration:** Connect OCR Output -> Groq -> SQL Generation -> PGlite Insert.

### Phase 4: The Chat Assistant (Week 4)

1. **Vector Store Logic:** Ensure all schemas and text chunks are embedded and indexed.
2. **The Router:** Build the logic to switch between SQL generation and Semantic Search.
3. **Chat UI:** Standard chat interface with streaming responses.
4. **SQL Safety:** Implement a read-only transaction mode for the AI agent to prevent it from dropping tables.

### Phase 5: Optimization & Polish (Week 5)

1. **Persistance:** Ensure PGlite data persists to IndexedDB (IDB) so data remains after refresh.
2. **Error Handling:** Retry logic for failed AI requests or OCR glitches.
3. **Testing:** Test with complex PDFs (multi-page tables, rotated text, multi-column layouts).

---

## 7. Technical Specifications for AI Prompts

### 7.1 Table Extraction Prompt (Groq/Moonshot)

```text
You are a data extraction engine. Analyze the following OCR text from a document page.
1. Identify if there are any tables.
2. For each table, extract the data into a JSON structure.
3. Create a unique, snake_case SQL table name based on the content (e.g., 'balance_sheet_2023').
4. infer the data type for each column (TEXT, NUMERIC, DATE).

Output Format (JSON only):
[
  {
    "table_name": "string",
    "description": "string summary of table",
    "schema": [{"name": "col_name", "type": "TEXT|NUMERIC"}],
    "rows": [{"col_name": "value"}]
  }
]

```

### 7.2 SQL Agent Prompt

```text
You have access to a local SQL database (PostgreSQL).
The user asks: "{user_query}"
Relevant Table Schema: {table_schema_json}

Write a SINGLE SQL query to answer this. Do not use Markdown. Do not explain. Just the SQL.

```

---

## 8. UI/UX Dashboard Layout

### Left Sidebar

* **Upload Area:** Drag & Drop / URL Input.
* **Processing Queue:** List of active jobs with Circular Progress (Canvas based).
* **Controls:** Global Pause/Resume.

### Main View (Tabbed)

* **Tab 1: Chat Assistant:** The primary interface for querying.
* **Tab 2: Data Explorer:** A visual SQL client.
* Sidebar: List of detected tables (e.g., `invoices`, `salary_slip`).
* Main: Data Grid showing rows.



### Right Panel (Hidden/Slide-over)

* **Process Logs:** Detailed logs of what the worker is doing (e.g., "Page 4: Table detected", "Page 5: Merging with table 'inventory_list'").

---
