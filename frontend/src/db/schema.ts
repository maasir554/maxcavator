export const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  source_url TEXT,
  status TEXT DEFAULT 'queued',
  total_pages INT DEFAULT 0,
  processed_pages INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT UNIQUE NOT NULL,
  schema_json JSONB NOT NULL,
  description TEXT,
  embedding vector(384)
);

CREATE TABLE IF NOT EXISTS semantic_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  page_number INT,
  content_text TEXT,
  embedding vector(384)
);
`;
