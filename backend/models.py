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

class ExtractionRequest(BaseModel):
    text: str

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
