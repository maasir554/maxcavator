import json
from typing import Dict, Any, List, Optional
from extraction import get_next_client

# ==============================================================================
# Phase 0: Controller Agent — decides next actions autonomously
# ==============================================================================

CONTROLLER_PROMPT = """You are the Maxcavator Orchestrator Controller, an autonomous AI agent.
Your job is to decide the NEXT BEST ACTION to answer the user's query, using a set of available tools.
You have access to a continuous loop. On each turn, you examine what has been done so far (the Accumulator), how much time has passed, how many searches have been executed, and the summary of currently collected data.

AVAILABLE ACTIONS:
- "search_tier_1": Search documents starting from PDF level down to chunks. Best for broad searches or finding specific tables.
  - Required Input: { "query": "specific search string" }
- "search_tier_2": Search at the table and chunk level. Best for finding data within tables.
  - Required Input: { "query": "specific search string" }
- "search_tier_3": Search flat text chunks only. Best for unstructured data lookups.
  - Required Input: { "query": "specific search string" }
- "get_nearby_rows": Fetch adjacent rows for a specific chunk/row to get context up or down.
  - Required Input: { "chunk_id": 1, "direction": "up" | "down" | "both", "count": 5 } (Use the mapped integer ID of the chunk)
- "get_table_info": Fetch the summary, notes, and full schema for a specific table id.
  - Required Input: { "table_id": 2 } (Use the mapped integer ID of the pdf_table)
- "analyze_chunks": Filter the collected chunks for relevance to the user's intent. Do this before synthesizing if you have collected many chunks.
  - Required Input: {} (No input needed, it uses the current collected_chunks)
- "math": Execute arithmetic operations.
  - Required Input: { "op": "add" | "subtract" | "multiply", "a": "number1", "b": "number2" }
- "meta_query": Fetch database metadata (what documents and tables exist).
  - Required Input: {}
- "synthesize": Generate the final answer using the collected chunks and end the loop. Use this when you have enough information to answer the user's query.
  - Required Input: {}
- "general_chat": Respond directly to the user (e.g., greetings, general questions not requiring data) and end the loop.
  - Required Input: { "response": "your direct response" }

CRITICAL RULES:
- Break complex queries into multiple simple search actions if needed.
- If you have executed searches but the collected chunks don't seem to contain the answer, try a different search string or a different search tier.
- Be mindful of search counts and time elapsed. If you hit a dead end, use "synthesize" to tell the user what you found and what is missing.
- When doing math, DO NOT do it yourself. ALWAYS use the "math" action.
- You must ONLY output a valid JSON object with EXACTLY two keys: "action" and "action_input".

Respond ONLY in JSON. Example:
{
  "action": "search_tier_1",
  "action_input": {
    "query": "total revenue 2023"
  }
}
"""

def orchestrator_controller(
    user_query: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
    accumulator: str = "",
    search_count: int = 0,
    time_elapsed_ms: int = 0,
    collected_chunks_summary: str = ""
) -> Dict[str, Any]:
    messages = [{"role": "system", "content": CONTROLLER_PROMPT}]
    
    if chat_history:
        for msg in chat_history[-4:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
    # Build the current state context for the agent
    state_context = f"User Query: {user_query}\n\n"
    state_context += f"--- CURRENT EXECUTION STATE ---\n"
    state_context += f"Time Elapsed: {time_elapsed_ms}ms\n"
    state_context += f"Searches Executed: {search_count}\n"
    if collected_chunks_summary:
        state_context += f"\nCurrently Collected Chunks Summary:\n{collected_chunks_summary}\n"
    else:
        state_context += "\nCurrently Collected Chunks Summary: None\n"
        
    if accumulator:
        state_context += f"\nAccumulator (What has happened so far):\n{accumulator}\n"
    else:
        state_context += "\nAccumulator: No actions taken yet.\n"
        
    state_context += "\nBased on the above state, what is the NEXT BEST ACTION? Respond in JSON."
    
    messages.append({"role": "user", "content": state_context})

    try:
        completion = get_next_client().chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        data = json.loads(completion.choices[0].message.content)
        
        action = data.get("action", "synthesize")
        action_input = data.get("action_input", {})
        
        return {
            "action": action,
            "action_input": action_input
        }
    except Exception as e:
        print(f"Orchestrator controller error: {e}")
        return {
            "action": "synthesize",
            "action_input": {}
        }


# ==============================================================================
# Phase 1: Intent Router — classifies user intent, generates search queries
# ==============================================================================

CLASSIFY_PROMPT = """You are an intent classifier for a PDF data analysis tool.
Read the user's query and classify it.

Intents:
- general_chat: greetings, generic questions not about PDF data
- data_lookup: questions about specific data/facts in the uploaded PDFs
- meta_query: questions about what data is available, what topics exist, which docs were uploaded
- math: arithmetic operations (add, subtract, multiply numbers)

CRITICAL RULES for sub_queries:
- If data_lookup, break the query into specific search strings.
- Each search string MUST be fully self-contained and specific. It must make sense on its own without any chat history.
- For follow-up questions, RESOLVE all pronouns and implicit references using chat history.
  Example: If user previously asked about "CPI of industrial workers" and now asks "and what about agricultural labourers?", the sub_query MUST be "CPI of agricultural labourers" (NOT just "agricultural labourers").
- Include the specific metric/indicator name, the entity, time period, etc. in each search string.

If math, extract the operation and operands.

Respond in JSON:
- intent: one of general_chat, data_lookup, meta_query, math
- sub_queries: array of search strings (for data_lookup only)
- direct_response: friendly reply (for general_chat only)
- math_ops: array of operations (for math only), each with op, a, b
"""

def orchestrator_classify(
    user_query: str,
    chat_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    messages = [{"role": "system", "content": CLASSIFY_PROMPT}]
    if chat_history:
        for msg in chat_history[-4:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_query})

    try:
        completion = get_next_client().chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        data = json.loads(completion.choices[0].message.content)
        
        # Robust parsing for classification
        intent = data.get("intent", "data_lookup")
        if intent not in ["general_chat", "data_lookup", "meta_query", "math"]:
            intent = "data_lookup"
            
        sub_queries = data.get("sub_queries", [])
        if not isinstance(sub_queries, list):
            sub_queries = [str(sub_queries)] if sub_queries else []
        sub_queries = [str(sq) for sq in sub_queries]
        
        math_ops = data.get("math_ops") or []
        if not isinstance(math_ops, list):
            math_ops = []
        valid_math = []
        for op in math_ops:
            if isinstance(op, dict) and "op" in op:
                valid_math.append({
                    "op": str(op["op"]),
                    "a": str(op.get("a", "0")),
                    "b": str(op.get("b", "0"))
                })

        return {
            "intent": intent,
            "sub_queries": sub_queries,
            "direct_response": str(data.get("direct_response")) if data.get("direct_response") else None,
            "math_ops": valid_math
        }
    except Exception as e:
        print(f"Orchestrator classify error: {e}")
        return {
            "intent": "data_lookup",
            "sub_queries": [user_query],
            "direct_response": None,
            "math_ops": []
        }


# ==============================================================================
# Phase 3: Context Analyst — filters and shortlists chunks
# ==============================================================================

ANALYZE_PROMPT = """You are a context relevance analyst. You receive a user query and a list of retrieved data chunks from a PDF database.

Your ONLY job is to decide which chunks are relevant to the user's query and which are not.

CRITICAL RULES:
- When in doubt, KEEP the chunk. Discarding a relevant chunk is MUCH WORSE than keeping an irrelevant one.
- A chunk is relevant if it contains ANY data, term, indicator, or topic that could help answer the user's question — even partially or indirectly.
- Do NOT discard chunks just because they seem tangentially related. Only discard chunks that are clearly and obviously about a completely different topic.
- Pay attention to table names, column headers, and specific data values — they often contain the answer even if the text summary seems generic.

For each chunk, output:
- keep: true or false
- reason: a short explanation of why this chunk is or isn't relevant

Respond in JSON with a single key "assessments" containing an array. Each item must have:
- source_id: the source_id from the input
- keep: boolean
- reason: short string
"""

def orchestrator_analyze(
    user_query: str,
    chunks: List[Dict[str, Any]],
    intent: Optional[str] = None,
    sub_queries: Optional[List[str]] = None
) -> Dict[str, Any]:
    # Build simplified chunk list for the LLM
    chunk_summaries = []
    for c in chunks:
        chunk_summaries.append({
            "source_id": c.get("source_id"),
            "filename": c.get("filename"),
            "table_name": c.get("table_name"),
            "page_number": c.get("page_number"),
            "content": c.get("text_summary", "")[:500]  # truncate long content
        })

    context_prefix = ""
    if intent:
        context_prefix += f"User Intent: {intent}\n"
    if sub_queries:
        context_prefix += f"Planned Search Queries: {', '.join(sub_queries)}\n"

    messages = [
        {"role": "system", "content": ANALYZE_PROMPT + (f"\n\nContext:\n{context_prefix}" if context_prefix else "")},
        {"role": "user", "content": json.dumps({
            "user_query": user_query,
            "chunks": chunk_summaries
        })}
    ]

    try:
        completion = get_next_client().chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        data = json.loads(completion.choices[0].message.content)
        raw_assessments = data.get("assessments", [])
        
        # Robust filtering: ensure each item is a dict and has source_id
        valid_assessments = []
        if isinstance(raw_assessments, list):
            for item in raw_assessments:
                if isinstance(item, dict) and "source_id" in item:
                    valid_assessments.append({
                        "source_id": item["source_id"],
                        "keep": bool(item.get("keep", True)),
                        "reason": str(item.get("reason", "No reason provided"))
                    })
        
        # If no valid assessments found, fallback to keeping everything
        if not valid_assessments:
            print("Orchestrator analyze: No valid assessments found in LLM response, falling back to keep-all")
            return {
                "assessments": [
                    {"source_id": c.get("source_id"), "keep": True, "reason": "No valid analysis, keeping by default"}
                    for c in chunks
                ]
            }
            
        return {"assessments": valid_assessments}
    except Exception as e:
        print(f"Orchestrator analyze error: {e}")
        # If analysis fails, keep all chunks
        return {
            "assessments": [
                {"source_id": c.get("source_id"), "keep": True, "reason": "Analysis failed, keeping by default"}
                for c in chunks
            ]
        }


# ==============================================================================
# Phase 4: Synthesizer — generates final cited answer
# ==============================================================================

SYNTHESIZE_PROMPT = """You are an intelligent, highly accurate analyst.
You receive a user query and curated data chunks from PDF documents.

Requirements:
1. ONLY use information from the provided chunks. If the answer is not there, say so.
2. For EVERY fact, number, or data point you mention, you MUST cite it inline using the chunk's source_id in brackets. Example: "The CPI was 146.5 [doc_0] with a change of +2.66% [doc_1]."
3. NEVER skip citations. Every statement backed by data must have [doc_N] next to it.
4. If this is a follow-up question describing prior context, use the prior_context to understand what was discussed, but still cite the current chunks.

Respond in JSON:
- response: your markdown-formatted answer with [doc_N] citations
- used_source_ids: array of source_id strings you actually used
"""

def orchestrator_synthesize(
    user_query: str,
    curated_chunks: List[Dict[str, Any]],
    chat_history: Optional[List[Dict[str, str]]] = None,
    prior_sources: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    # Build context for synthesis
    chunk_context = []
    for c in curated_chunks:
        chunk_context.append({
            "source_id": c.get("source_id"),
            "filename": c.get("filename"),
            "table_name": c.get("table_name"),
            "page_number": c.get("page_number"),
            "content": c.get("text_summary", "")
        })

    # Build prior context summary for follow-ups
    prior_context = None
    if prior_sources and len(prior_sources) > 0:
        prior_context = []
        for ps in prior_sources[:5]:  # limit to last 5 prior sources
            prior_context.append({
                "source_id": ps.get("source_id"),
                "filename": ps.get("filename"),
                "table_name": ps.get("table_name"),
                "content_preview": (ps.get("text_summary") or "")[:200]
            })

    messages = [{"role": "system", "content": SYNTHESIZE_PROMPT}]

    if chat_history:
        for msg in chat_history[-4:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    user_payload = {
        "user_query": user_query,
        "chunks": chunk_context
    }
    if prior_context:
        user_payload["prior_context"] = prior_context

    messages.append({"role": "user", "content": json.dumps(user_payload)})

    try:
        completion = get_next_client().chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        data = json.loads(completion.choices[0].message.content)
        
        used_source_ids = data.get("used_source_ids", [])
        if not isinstance(used_source_ids, list):
            used_source_ids = []
        used_source_ids = [str(sid) for sid in used_source_ids]

        return {
            "response": str(data.get("response", "I could not formulate an answer.")),
            "used_source_ids": used_source_ids
        }
    except Exception as e:
        print(f"Orchestrator synthesize error: {e}")
        return {
            "response": f"Sorry, I encountered an error while synthesizing the answer.",
            "used_source_ids": []
        }
