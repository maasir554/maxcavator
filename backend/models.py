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



# Orchestrator V2 Models (modular pipeline)

class OrchestratorV2ClassifyRequest(BaseModel):
    user_query: str
    chat_history: Optional[List[Dict[str, str]]] = None

class OrchestratorV2ClassifyResponse(BaseModel):
    intent: str  # general_chat, data_lookup, meta_query, math
    sub_queries: List[str] = []
    direct_response: Optional[str] = None
    math_ops: Optional[List[Dict[str, Any]]] = []

class OrchestratorV2AnalyzeRequest(BaseModel):
    user_query: str
    chunks: List[Dict[str, Any]]  # raw chunks with source_ids
    intent: Optional[str] = None
    sub_queries: Optional[List[str]] = None

class OrchestratorV2AnalyzeResponse(BaseModel):
    assessments: List[Dict[str, Any]]  # {source_id, keep, reason}

class OrchestratorV2SynthesizeRequest(BaseModel):
    user_query: str
    curated_chunks: List[Dict[str, Any]]
    chat_history: Optional[List[Dict[str, str]]] = None
    prior_sources: Optional[List[Dict[str, Any]]] = None  # sources from previous messages for follow-ups

class OrchestratorV2SynthesizeResponse(BaseModel):
    response: str
    used_source_ids: List[str] = []

class OrchestratorControllerRequest(BaseModel):
    user_query: str
    chat_history: Optional[List[Dict[str, str]]] = None
    accumulator: str = ""
    search_count: int = 0
    time_elapsed_ms: int = 0
    collected_chunks_summary: str = ""

class OrchestratorControllerResponse(BaseModel):
    action: str
    action_input: Any

