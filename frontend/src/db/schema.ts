export const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  source_url TEXT,
  status TEXT DEFAULT 'queued',
  summary TEXT,
  total_pages INT DEFAULT 0,
  processed_pages INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL,
  dismissed_from_queue BOOLEAN DEFAULT FALSE,
  name_embedding vector(3072)
);

CREATE TABLE IF NOT EXISTS pdf_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  summary TEXT,
  notes TEXT,
  schema_json JSONB NOT NULL,
  summary_embedding vector(3072),
  page_number INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_table_id UUID REFERENCES pdf_tables(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  text_summary TEXT,
  summary_embedding vector(3072),
  page_number INT,
  chunk_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migrations for existing databases
DO $$ BEGIN
  ALTER TABLE documents ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE pdf_tables ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE documents ADD COLUMN summary TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE documents ADD COLUMN dismissed_from_queue BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE documents ADD COLUMN name_embedding vector(3072);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Drop legacy tables if they exist (they were never used)
DROP TABLE IF EXISTS semantic_chunks CASCADE;
DROP TABLE IF EXISTS schema_registry CASCADE;
`;
