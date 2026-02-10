from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class TableSchema(BaseModel):
    name: str
    type: str  # TEXT, NUMERIC, DATE

class TableData(BaseModel):
    table_name: str
    description: str
    schema_list: List[TableSchema]
    rows: List[Dict[str, Any]]

class ExtractionRequest(BaseModel):
    text: str

class ExtractionResponse(BaseModel):
    tables: List[TableData]
    debug_info: Optional[Dict[str, str]] = None

class SqlQueryRequest(BaseModel):
    user_query: str
    table_schema: Dict[str, Any]

class SqlQueryResponse(BaseModel):
    sql: str
