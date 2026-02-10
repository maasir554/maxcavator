from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Maxcavator Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Maxcavator Backend Running"}

from models import ExtractionRequest, ExtractionResponse, SqlQueryRequest, SqlQueryResponse
from extraction import extract_tables_from_text, generate_sql_query
from vision_ocr import extract_text_from_image

@app.post("/extract", response_model=ExtractionResponse)
def extract_tables(request: ExtractionRequest):
    tables, debug_info = extract_tables_from_text(request.text)
    return ExtractionResponse(tables=tables, debug_info=debug_info)

class VisionOcrRequest(BaseModel):
    image: str  # base64-encoded image

class VisionOcrResponse(BaseModel):
    text: str
    debug_info: dict

@app.post("/vision_ocr", response_model=VisionOcrResponse)
def vision_ocr(request: VisionOcrRequest):
    result = extract_text_from_image(request.image)
    return VisionOcrResponse(text=result["text"], debug_info=result["debug_info"])

@app.post("/query", response_model=SqlQueryResponse)
def query_sql(request: SqlQueryRequest):
    sql = generate_sql_query(request.user_query, request.table_schema)
    return SqlQueryResponse(sql=sql)

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    embedding: List[float]

@app.post("/embed", response_model=EmbedResponse)
def embed_text(request: EmbedRequest):
    return EmbedResponse(embedding=[0.0] * 384)

from fastapi import Response
import requests

@app.get("/proxy_pdf")
def proxy_pdf(url: str):
    try:
        # Simple proxy to bypass CORS
        resp = requests.get(url, stream=True)
        return Response(
            content=resp.content, 
            media_type="application/pdf", 
            headers={"Content-Disposition": "inline"}
        )
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
