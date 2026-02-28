from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os
import requests
from fastapi import Response
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

from models import ExtractionRequest, ExtractionResponse, SqlQueryRequest, SqlQueryResponse, PdfSummaryRequest, PdfSummaryResponse, EmbedRequest, EmbedResponse, RagRequest, RagResponse
from extraction import extract_tables_from_text, generate_sql_query, extract_pdf_summary
from vision_ocr import extract_text_from_image
from embeddings import generate_embeddings

@app.post("/extract", response_model=ExtractionResponse)
def extract_tables(request: ExtractionRequest):
    tables, debug_info = extract_tables_from_text(request.text, request.previous_tables)
    return ExtractionResponse(tables=tables, debug_info=debug_info)

@app.post("/pdf_summary", response_model=PdfSummaryResponse)
def pdf_summary(request: PdfSummaryRequest):
    result = extract_pdf_summary(request.page_texts)
    return PdfSummaryResponse(title=result["title"], summary=result["summary"])

@app.post("/embed", response_model=EmbedResponse)
def embed_texts(request: EmbedRequest):
    vectors = generate_embeddings(request.texts)
    return EmbedResponse(embeddings=vectors)

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

from extraction import generate_rag_response

@app.post("/rag_chat", response_model=RagResponse)
def rag_chat(request: RagRequest):
    result = generate_rag_response(request.user_query, request.context_chunks)
    return RagResponse(
        response=result.get("response", ""), 
        used_chunk_ids=result.get("used_chunk_ids", [])
    )

from models import AgentPlanRequest, AgentPlanResponse, AgentAnswerRequest, AgentAnswerResponse
from agent import generate_agent_plan, generate_agent_answer

@app.post("/agent/plan", response_model=AgentPlanResponse)
def agent_plan(request: AgentPlanRequest):
    result = generate_agent_plan(request.user_query, request.chat_history)
    return AgentPlanResponse(
        intent=result.get("intent", "data_lookup"),
        sub_queries=result.get("sub_queries", []),
        direct_response=result.get("direct_response")
    )

@app.post("/agent/answer", response_model=AgentAnswerResponse)
def agent_answer(request: AgentAnswerRequest):
    result = generate_agent_answer(request.user_query, request.retrieved_chunks, request.chat_history)
    return AgentAnswerResponse(
        response=result.get("response", ""),
        used_chunk_ids=result.get("used_chunk_ids", [])
    )

from models import (
    OrchestratorV2ClassifyRequest, OrchestratorV2ClassifyResponse,
    OrchestratorV2AnalyzeRequest, OrchestratorV2AnalyzeResponse,
    OrchestratorV2SynthesizeRequest, OrchestratorV2SynthesizeResponse,
    OrchestratorControllerRequest, OrchestratorControllerResponse
)
from orchestrator import orchestrator_classify, orchestrator_analyze, orchestrator_synthesize, orchestrator_controller

@app.post("/orchestrator/controller", response_model=OrchestratorControllerResponse)
def orch_controller(request: OrchestratorControllerRequest):
    result = orchestrator_controller(
        request.user_query,
        request.chat_history,
        request.accumulator,
        request.search_count,
        request.time_elapsed_ms,
        request.collected_chunks_summary
    )
    return OrchestratorControllerResponse(**result)


@app.post("/orchestrator/v2/classify", response_model=OrchestratorV2ClassifyResponse)
def orch_v2_classify(request: OrchestratorV2ClassifyRequest):
    result = orchestrator_classify(request.user_query, request.chat_history)
    return OrchestratorV2ClassifyResponse(**result)

@app.post("/orchestrator/v2/analyze", response_model=OrchestratorV2AnalyzeResponse)
def orch_v2_analyze(request: OrchestratorV2AnalyzeRequest):
    result = orchestrator_analyze(request.user_query, request.chunks, request.intent, request.sub_queries)
    return OrchestratorV2AnalyzeResponse(**result)

@app.post("/orchestrator/v2/synthesize", response_model=OrchestratorV2SynthesizeResponse)
def orch_v2_synthesize(request: OrchestratorV2SynthesizeRequest):
    result = orchestrator_synthesize(
        request.user_query,
        request.curated_chunks,
        request.chat_history,
        request.prior_sources
    )
    return OrchestratorV2SynthesizeResponse(**result)

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
