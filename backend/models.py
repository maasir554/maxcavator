from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class FieldSchema(BaseModel):
    name: str
    type: str          # TEXT, NUMERIC, DATE, BOOLEAN
    description: str   # what this field represents

class ChunkData(BaseModel):
    data: Dict[str, Any]   # the raw JSON entry (one row/record)
    text_summary: str      # natural language summary of this chunk

class TableExtraction(BaseModel):
    table_name: str
    summary: str                    # what this table is about
    notes: str                      # extra context or caveats
    schema_fields: List[FieldSchema]  # field definitions with types + descriptions
    chunks: List[ChunkData]         # each row as a separate chunk
    updated_schema_fields: Optional[List[FieldSchema]] = None # if table is continued and schema improved
    updated_notes: Optional[str] = None                       # if table is continued and notes improved

class ExtractionRequest(BaseModel):
    text: str
    previous_tables: Optional[List[Dict[str, Any]]] = None

class ExtractionResponse(BaseModel):
    tables: List[TableExtraction]
    debug_info: Optional[Dict[str, str]] = None

class SqlQueryRequest(BaseModel):
    user_query: str
    table_schema: Dict[str, Any]

class SqlQueryResponse(BaseModel):
    sql: str

class PdfSummaryRequest(BaseModel):
    page_texts: List[str]  # text from first 1-2 pages

class PdfSummaryResponse(BaseModel):
    title: str
    summary: str

class EmbedRequest(BaseModel):
    texts: List[str]

class EmbedResponse(BaseModel):
    embeddings: List[List[float]]

class RagRequest(BaseModel):
    user_query: str
    context_chunks: List[Dict]

class RagResponse(BaseModel):
    response: str
    used_chunk_ids: List[str]

# Agentic Flow Models
class AgentPlanRequest(BaseModel):
    user_query: str
    chat_history: Optional[List[Dict[str, str]]] = None

class AgentPlanResponse(BaseModel):
    intent: str # 'data_lookup' or 'general_chat'
    sub_queries: List[str] # specific search strings to run against vector DB
    direct_response: Optional[str] = None # if general_chat, the immediate answer

class AgentAnswerRequest(BaseModel):
    user_query: str
    retrieved_chunks: List[Dict] # raw chunks from DB semantic search
    chat_history: Optional[List[Dict[str, str]]] = None

class AgentAnswerResponse(BaseModel):
    response: str
    used_chunk_ids: List[str]
