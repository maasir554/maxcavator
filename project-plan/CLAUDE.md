MAXCAVATOR
Legacy PDF Document Data Extractor & Contextual Querying Tool

Technical Project Plan & Implementation Guide

Version 1.0
February 2026
Table of Contents
1. Executive Summary
2. System Architecture Overview
3. Technology Stack
4. Core Components & Technical Specifications
5. Data Flow Architecture
6. Sequential Implementation Plan
7. Development Phases
8. Technical Dependencies & Requirements
9. Performance Optimization Strategies
10. Security & Privacy Considerations
11. Testing Strategy
12. Deployment & DevOps
13. Future Enhancements
Appendices
1. Executive Summary
Project Overview:
MAXCAVATOR is a client-side-first web application designed to extract, process, and intelligently query data from legacy PDF documents. The system leverages advanced OCR technology, generative AI, and vector databases to transform unstructured PDF content into queryable structured data, all while maintaining user privacy through client-side processing.
Key Features:
Client-side PDF processing with zero server dependency for sensitive data
Multi-page PDF extraction with real-time progress tracking
AI-powered table schema detection and data extraction
Intelligent table matching and data consolidation
Semantic vector search for contextual querying
SQL-based structured data retrieval
Pause/resume capability for long-running extractions
Offline-capable progressive web application
Target Use Cases:
Legacy document digitization for enterprises
Financial data extraction from historical reports
Medical records processing and querying
Legal document analysis and information retrieval
Research paper data extraction and analysis
2. System Architecture Overview
2.1 Architecture Principles
Client-First Processing: All sensitive data processing occurs in the browser
Progressive Enhancement: Core functionality works offline after initial load
Asynchronous Operations: Non-blocking UI with Web Workers for heavy processing
Modular Design: Loosely coupled components for maintainability
Data Privacy: No server-side data persistence of user documents
2.2 High-Level Architecture Diagram
The system consists of four primary layers:
Presentation Layer: React-based UI with Vite bundling, Material-UI components, real-time progress visualization
Processing Layer: Web Workers for PDF processing, Tesseract.js OCR engine, background task management
Intelligence Layer: Groq AI integration (Moonshot Kimi-K2 Instruct), schema detection, SQL agent, semantic search
Data Layer: PGlite embedded database, PGVector for embeddings, IndexedDB for persistence
3. Technology Stack
3.1 Frontend Framework


3.2 Processing & AI


3.3 Data Storage

4. Core Components & Technical Specifications
4.1 PDF Input Handler
Responsibilities:
Accept PDF uploads via file input or drag-and-drop
Validate PDF file format and size (max 100MB recommended)
Accept HTTP/HTTPS URLs for remote PDF loading
Handle CORS and fetch remote PDFs with appropriate headers
Extract PDF metadata (page count, title, author, creation date)
Technical Implementation:
The component uses PDF.js to parse PDF files and extract individual pages. For URL-based inputs, the system fetches the PDF with proper CORS handling and validates content-type headers. File validation includes MIME type checking and magic number verification to ensure genuine PDF files.
4.2 OCR Processing Engine
Responsibilities:
Convert PDF pages to images at optimal resolution (300 DPI)
Execute Tesseract.js OCR on each page image
Run in Web Worker to prevent UI blocking
Emit progress events for UI updates
Support pause/resume functionality
Handle OCR errors gracefully
Worker Architecture:
The OCR engine runs in a dedicated Web Worker, communicating with the main thread via Comlink for simplified message passing. The worker maintains a processing queue and can be paused/resumed through state management. Progress is reported as a percentage based on pages completed.
4.3 AI Schema Detection & Extraction Agent
Core Functions:
Analyze first page text to detect tabular data presence
Generate JSON schema for detected tables
Extract data from subsequent pages using the schema
Handle multi-table pages (return array of table objects)
Validate extracted data against schema
AI Model Configuration:
The system uses Groq's Moonshot Kimi-K2 Instruct model via the Groq API. The model is configured with structured output formatting to ensure consistent JSON responses. Temperature is set to 0.1 for deterministic schema generation.
Input/Output Format:
Input: Raw OCR text from a page
Output: JSON array of table objects, each containing:
schema: Object defining column names and data types
data: Array of row objects matching the schema
confidence: Float indicating extraction confidence (0-1)
metadata: Page number, table position, extraction timestamp
4.4 Table Matching & Consolidation System
Functionality:
This critical component determines whether extracted table data should be inserted into existing tables or create new ones.
Matching Strategy:
1. First-Pass: Compare with last used schema (continued tables)
2. Second-Pass: Perform vector similarity search on all stored schemas
3. Third-Pass: Structural analysis (column count, data types, column names)
4. Decision: If similarity > 0.85 threshold, append to existing table; else create new
Vector Embeddings:
Each schema is converted to a text representation and embedded using a lightweight embedding model. These embeddings are stored in PGVector for fast similarity searches.
4.5 Data Storage Layer
PGlite Database Schema:
Core Tables:
documents: Stores PDF metadata and processing status
extraction_jobs: Tracks processing jobs with pause/resume state
schemas: Stores table schemas with vector embeddings
Dynamic Tables: User data tables created based on extracted schemas
text_chunks: Vectorized text chunks for semantic search
Vector Store Structure:
PGVector is used to store two types of embeddings:
Schema Embeddings: For table matching (dimensions: 384)
Text Chunk Embeddings: For semantic document search (dimensions: 384)
4.6 Intelligent Query Assistant
Query Processing Pipeline:
1. Query Analysis: Determine if query requires structured or unstructured data
2. Table Search: Vector similarity search on schemas if structured query detected
3. SQL Generation: AI generates SQL query for relevant tables
4. SQL Execution: Execute query against PGlite database
5. Fallback Search: If no tables match, perform semantic chunk search
6. Response Synthesis: AI formats results into natural language response
SQL Agent Implementation:
The SQL agent is implemented as a function-calling pattern where the AI generates SQL based on table schemas. The generated SQL is validated for safety (read-only operations) before execution.
5. Data Flow Architecture
5.1 PDF Upload Flow
User uploads PDF or provides URL → Frontend validates input
PDF metadata extracted → Create document record in PGlite
Create extraction job → Initialize progress tracking
Queue for processing → Display in dashboard with progress bar
5.2 Extraction Flow
Web Worker receives job → Load PDF with PDF.js
For each page:
  - Render page to canvas at 300 DPI
  - Extract image data as PNG
  - Run Tesseract.js OCR
  - Send text to AI for table detection
  - If tables found, perform schema matching
  - Insert data into appropriate table
  - Update progress → Emit to main thread
Store text chunks with embeddings for semantic search
Mark job as complete → Update UI
5.3 Query Flow
User submits query → Analyze query intent
Search schema vectors → Identify relevant tables
If tables found:
  - AI generates SQL query
  - Execute against PGlite
  - Return structured results
Else:
  - Search text chunk vectors
  - Retrieve top-k chunks
  - AI synthesizes response from chunks
Display response in chat interface
6. Sequential Implementation Plan
This section provides a step-by-step guide for implementing MAXCAVATOR from scratch.
6.1 Phase 0: Project Setup (Week 1)
Step 1: Initialize Project
Commands:npm create vite@latest maxcavator -- --template react-tscd maxcavatornpm install
Step 2: Install Core Dependencies
npm install @mui/material @emotion/react @emotion/stylednpm install react-router-dom zustand @tanstack/react-querynpm install pdfjs-dist tesseract.js comlinknpm install @electric-sql/pglitenpm install groq-sdk
Step 3: Install Development Dependencies
npm install -D @types/pdfjs-distnpm install -D vite-plugin-pwa workbox-window
Step 4: Configure TypeScript
Update tsconfig.json with strict mode and proper path aliases.
Step 5: Setup Project Structure
src/├── components/     # React components├── workers/        # Web Workers├── services/       # Business logic├── db/            # Database schemas and queries├── store/         # Zustand state management├── utils/         # Utility functions├── types/         # TypeScript definitions└── pages/         # Route pages
6.2 Phase 1: Core Infrastructure (Week 1-2)
Step 1: Setup PGlite Database
Create db/init.ts:
Initialize PGlite instance with IndexedDB persistence
Enable PGVector extension
Create core tables (documents, extraction_jobs, schemas, text_chunks)
Setup vector indexes
Step 2: Implement State Management
Create Zustand stores for:
useDocumentStore: Manage document list and metadata
useJobStore: Track extraction job states
useQueryStore: Manage chat history and responses
useUIStore: Control UI state (modals, drawers, notifications)
Step 3: Setup Routing
Configure React Router with routes:
/ - Dashboard with job queue
/upload - PDF upload interface
/tables - Table preview screen
/query - AI assistant chat interface
/settings - Configuration panel
6.3 Phase 2: PDF Upload & Input (Week 2)
Step 1: Create Upload Component
Implement drag-and-drop zone
File input with PDF validation
URL input field with validation
Display selected file metadata
Size and format validation
Step 2: Implement PDF Loader Service
Create services/pdfLoader.ts:
Load PDF from File object using PDF.js
Fetch PDF from URL with CORS handling
Extract metadata (pages, title, etc.)
Return PDF document proxy for processing
6.4 Phase 3: OCR Processing Engine (Week 3-4)
Step 1: Create OCR Web Worker
Create workers/ocrWorker.ts:
Initialize Tesseract.js worker
Implement page-to-image conversion
Execute OCR on image data
Emit progress events
Handle pause/resume signals
Cleanup resources on completion
Step 2: Implement Worker Communication
Create services/ocrService.ts:
Wrap worker with Comlink for typed communication
Create job queue management
Implement pause/resume functionality
Handle progress updates
Manage worker lifecycle
Step 3: Create Progress Visualization
Build components:
JobQueueDashboard: Display all active and pending jobs
JobCard: Individual job with circular progress
PauseResumeControls: Interactive controls for each job
6.5 Phase 4: AI Integration (Week 4-5)
Step 1: Setup Groq Client
Create services/aiClient.ts:
Initialize Groq SDK with API key
Configure Moonshot Kimi-K2 Instruct model
Implement retry logic with exponential backoff
Add request rate limiting
Error handling and logging
Step 2: Implement Table Extraction Agent
Create services/tableExtractor.ts:
Design prompt for table detection
Implement schema generation logic
Parse AI responses into structured format
Validate extracted data
Handle multi-table pages
Step 3: Create Embedding Service
Create services/embeddings.ts:
Note: Use a lightweight client-side embedding model or call a free embedding API.
6.6 Phase 5: Schema Matching System (Week 5-6)
Step 1: Implement Schema Vectorization
Create services/schemaManager.ts:
Convert schema to text representation
Generate embedding vector
Store in schemas table with PGVector
Implement schema retrieval by ID
Step 2: Build Matching Algorithm
Check against last used schema (cache)
Perform vector similarity search
Structural comparison (columns, types)
Calculate composite similarity score
Return match decision with confidence
Step 3: Dynamic Table Creation
Create services/tableManager.ts:
Generate CREATE TABLE statement from schema
Execute DDL safely in PGlite
Create indexes on key columns
Handle column type mapping
Track table metadata
6.7 Phase 6: Query Assistant (Week 6-7)
Step 1: Create Chat Interface
ChatWindow: Message display area
MessageInput: User input field
MessageBubble: Individual message component
TypingIndicator: Loading state display
Step 2: Implement Query Analyzer
Create services/queryAnalyzer.ts:
Classify query type (structured vs unstructured)
Extract query intent and entities
Search for relevant table schemas
Determine appropriate response strategy
Step 3: Build SQL Agent
Create services/sqlAgent.ts:
Generate SQL from natural language query
Validate SQL for read-only operations
Execute query against PGlite
Format results for display
Handle SQL errors gracefully
Step 4: Implement Semantic Search
Create services/semanticSearch.ts:
Embed user query
Search text_chunks table with PGVector
Retrieve top-k relevant chunks
Re-rank results by relevance
Pass to AI for response synthesis
6.8 Phase 7: Table Preview UI (Week 7)
Step 1: Create Table Browser
TableList: Display all available tables
TableViewer: Interactive table display
SchemaInspector: Show table structure
ExportButton: Export table data as CSV/JSON
Step 2: Implement Data Grid
Use MUI DataGrid for features:
Pagination for large datasets
Column sorting and filtering
Column resizing and reordering
Row selection
Export functionality
7. Development Phases Timeline


Total Estimated Duration: 10-14 weeks
8. Technical Dependencies & Requirements
8.1 External API Requirements
Groq AI API:
API Key: Required for Moonshot Kimi-K2 Instruct access
Rate Limits: 30 requests/minute (free tier)
Model: moonshot-v1-32k
Environment Variable: VITE_GROQ_API_KEY
8.2 Browser Requirements
WebAssembly support (for PGlite)
Web Workers API
IndexedDB API
Canvas API (for PDF rendering)
Modern JavaScript (ES2020+)
Minimum 4GB RAM for large PDFs
8.3 Supported Browsers
Chrome/Edge: Version 90+
Firefox: Version 88+
Safari: Version 15+
Opera: Version 76+
9. Performance Optimization Strategies
9.1 Client-Side Optimizations
Web Workers: Offload OCR and AI processing to prevent UI blocking
Lazy Loading: Code-split routes and heavy components
Virtual Scrolling: Use virtualization for large table datasets
Debouncing: Limit AI API calls during query input
Caching: Store AI responses for repeated queries
Batch Processing: Group similar operations (embeddings, inserts)
9.2 Database Optimizations
Indexes: Create indexes on frequently queried columns
Vector Indexes: Use IVFFlat or HNSW indexes for PGVector
Connection Pooling: Reuse PGlite connections
Prepared Statements: Use for repeated queries
Batch Inserts: Insert multiple rows in single transaction
9.3 OCR Optimizations
Resolution Control: Use 300 DPI for OCR (balance between quality and speed)
Worker Pool: Create multiple workers for parallel page processing
Image Preprocessing: Apply filters to improve OCR accuracy
Progressive Processing: Show partial results as pages complete
Resource Cleanup: Properly dispose of canvas and image data
10. Security & Privacy Considerations
10.1 Data Privacy
Client-Side Processing: All document data remains in the browser
No Server Persistence: No document data sent to servers (except AI API)
API Key Security: Store Groq API key in environment variables, not in code
Clear User Consent: Inform users that text is sent to Groq for processing
Data Deletion: Provide clear UI to delete all local data
10.2 Code Security
SQL Injection Prevention: Validate and sanitize all AI-generated SQL
XSS Protection: Sanitize user inputs and AI outputs before rendering
CORS Configuration: Properly configure for remote PDF loading
Content Security Policy: Implement strict CSP headers
Dependency Auditing: Regular npm audit and updates
10.3 API Security
Rate Limiting: Implement client-side rate limiting for Groq API
Error Handling: Don't expose API keys in error messages
Key Rotation: Support easy API key updates
Usage Monitoring: Track API usage to avoid quota exhaustion
11. Testing Strategy
11.1 Unit Testing
Tools: Vitest, React Testing Library
Test Coverage:
Utility functions (data parsing, validation)
Schema matching algorithm
SQL generation and validation
State management (Zustand stores)
Service layer logic
11.2 Integration Testing
End-to-end PDF processing workflow
Worker communication and progress tracking
Database operations (create, read, update)
AI API integration and error handling
Query pipeline (analysis → SQL → response)
11.3 Performance Testing
OCR processing time per page
Memory usage with large PDFs (100+ pages)
Database query performance
Vector search latency
UI responsiveness during heavy processing
11.4 User Acceptance Testing
Upload various PDF types (scanned, native, mixed)
Process multi-table documents
Query accuracy across different data types
Pause/resume functionality
Table consolidation accuracy
12. Deployment & DevOps
12.1 Build Configuration
Vite Configuration:
Enable PWA plugin for offline support
Configure code splitting for optimal bundle sizes
Setup environment variable handling
Configure worker plugin for Web Workers
Enable compression and minification
12.2 Progressive Web App Setup
Service Worker Configuration:
Cache static assets (HTML, CSS, JS)
Cache PGlite WASM files
Implement offline fallback page
Background sync for failed API requests
App install prompts
12.3 Hosting Options
Vercel: Recommended for Vite apps, automatic deployments
Netlify: Alternative with similar features
Cloudflare Pages: Global CDN, excellent performance
GitHub Pages: Free static hosting
12.4 CI/CD Pipeline
GitHub Actions Workflow:
Trigger on push to main branch
Install dependencies with caching
Run linters (ESLint, Prettier)
Execute test suite
Build production bundle
Deploy to hosting platform
Run post-deployment smoke tests
13. Future Enhancements
13.1 Short-Term (3-6 months)
Multi-language OCR support
Custom table schema templates
Batch PDF processing
Export entire database to SQLite file
Advanced query syntax (filters, sorting)
Dark mode theme
Collaborative features (share tables via URL)
13.2 Medium-Term (6-12 months)
OCR quality enhancement with AI preprocessing
Support for Excel and Word documents
Graph/chart extraction from PDFs
Natural language SQL query builder
Integration with cloud storage (Google Drive, Dropbox)
Data validation rules for tables
Automated table relationship detection
13.3 Long-Term (12+ months)
Multi-user collaboration platform
Enterprise SSO integration
Custom AI model fine-tuning
Advanced analytics and reporting
API for third-party integrations
Mobile native apps (React Native)
On-premise deployment option
Appendices
Appendix A: Code Examples
A.1 Database Initialization Example
// db/init.tsimport { PGlite } from '@electric-sql/pglite';import { vector } from '@electric-sql/pglite/vector';export const initDatabase = async () => {  const db = await PGlite.create({    dataDir: 'idb://maxcavator-db',    extensions: { vector }  });  await db.exec(`    CREATE EXTENSION IF NOT EXISTS vector;        CREATE TABLE IF NOT EXISTS documents (      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),      filename TEXT NOT NULL,      page_count INTEGER,      created_at TIMESTAMP DEFAULT NOW()    );        CREATE TABLE IF NOT EXISTS schemas (      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),      table_name TEXT UNIQUE NOT NULL,      schema_json JSONB NOT NULL,      embedding vector(384),      created_at TIMESTAMP DEFAULT NOW()    );        CREATE INDEX ON schemas USING ivfflat (embedding vector_cosine_ops);  `);  return db;};
A.2 OCR Worker Example
// workers/ocrWorker.tsimport Tesseract from 'tesseract.js';import { expose } from 'comlink';const ocrWorker = {  async processPage(imageData: ImageData) {    const result = await Tesseract.recognize(imageData, 'eng', {      logger: (m) => {        if (m.status === 'recognizing text') {          self.postMessage({ type: 'progress', progress: m.progress });        }      }    });    return result.data.text;  }};expose(ocrWorker);
Appendix B: Database Schema Reference
Complete PGlite Schema:
-- Core tablesCREATE TABLE documents (  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  filename TEXT NOT NULL,  file_size BIGINT,  page_count INTEGER,  source_url TEXT,  status TEXT DEFAULT 'pending',  created_at TIMESTAMP DEFAULT NOW());CREATE TABLE extraction_jobs (  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  document_id UUID REFERENCES documents(id),  status TEXT DEFAULT 'pending',  current_page INTEGER DEFAULT 0,  total_pages INTEGER,  is_paused BOOLEAN DEFAULT FALSE,  created_at TIMESTAMP DEFAULT NOW(),  completed_at TIMESTAMP);CREATE TABLE schemas (  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  table_name TEXT UNIQUE NOT NULL,  schema_json JSONB NOT NULL,  schema_text TEXT,  embedding vector(384),  created_at TIMESTAMP DEFAULT NOW());CREATE TABLE text_chunks (  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  document_id UUID REFERENCES documents(id),  page_number INTEGER,  chunk_text TEXT,  embedding vector(384),  created_at TIMESTAMP DEFAULT NOW());-- IndexesCREATE INDEX idx_jobs_status ON extraction_jobs(status);CREATE INDEX idx_chunks_doc ON text_chunks(document_id);CREATE INDEX ON schemas USING ivfflat (embedding vector_cosine_ops);CREATE INDEX ON text_chunks USING ivfflat (embedding vector_cosine_ops);
Appendix C: AI Prompts Reference
C.1 Table Detection Prompt
You are a table detection and extraction expert. Analyze the following OCR text from a PDF page.Task:1. Determine if this page contains tabular data2. If yes, extract each table as a structured schema and dataOutput Format (JSON):{  "tables": [    {      "schema": {        "name": "suggested_table_name",        "columns": [          {"name": "column1", "type": "TEXT"},          {"name": "column2", "type": "NUMERIC"}        ]      },      "data": [        {"column1": "value1", "column2": 123},        ...      ],      "confidence": 0.95    }  ]}OCR Text:{ocr_text}
C.2 SQL Generation Prompt
You are a SQL expert. Generate a PostgreSQL query based on the user's question.Available Tables:{table_schemas}User Question:{user_query}Requirements:- Generate ONLY SELECT queries (no INSERT, UPDATE, DELETE)- Use proper JOIN syntax if querying multiple tables- Include appropriate WHERE clauses for filtering- Return valid PostgreSQL syntaxOutput Format (JSON):{  "sql": "SELECT ...",  "explanation": "Brief explanation of the query"}
Appendix D: Environment Variables
Required .env file configuration:
# .envVITE_GROQ_API_KEY=your_groq_api_key_hereVITE_APP_TITLE=MAXCAVATORVITE_MAX_FILE_SIZE_MB=100VITE_OCR_DPI=300VITE_VECTOR_DIMENSIONS=384VITE_SIMILARITY_THRESHOLD=0.85
Appendix E: Glossary

Document Control

