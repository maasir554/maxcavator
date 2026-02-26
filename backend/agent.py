import os
import json
import uuid
from typing import Dict, Any, List
from dotenv import load_dotenv
from extraction import get_next_client

load_dotenv()

AGENT_PLAN_PROMPT = """You are an intelligent data-retrieval Agent.
Your job is to read the user's query and decide if you need to search the database.

The database contains data extracted from PDF documents (tables, paragraphs, etc.).

If the user is just saying hello, or asking a generic question that doesn't rely on the PDF data:
- Set intent to "general_chat"
- Provide a friendly "direct_response"
- Leave "sub_queries" empty.

If the user is asking about data that might be in the PDFs:
- Set intent to "data_lookup"
- Break down their query into highly specific semantic search strings. 
- Leave "direct_response" empty or null.

For example, if the user asks "What was the revenue in Q3 2023 and the total expenses?",
your sub_queries should be:
["revenue Q3 2023", "total expenses 2023"]

Respond ONLY in valid JSON format:
{
    "intent": "data_lookup" | "general_chat",
    "sub_queries": ["search string 1", ...],
    "direct_response": "friendly reply if general_chat"
}
"""

def generate_agent_plan(user_query: str, chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
    messages = [
        {"role": "system", "content": AGENT_PLAN_PROMPT}
    ]
    
    if chat_history:
        for msg in chat_history[-4:]: # Only include recent context to save tokens
            messages.append({"role": msg["role"], "content": msg["content"]})
            
    messages.append({"role": "user", "content": user_query})

    completion = get_next_client().chat.completions.create(
        model="openai/gpt-oss-120b", # Ensure it matches groq api
        messages=messages,
        temperature=0.1,
        response_format={"type": "json_object"}
    )
    
    raw = completion.choices[0].message.content
    try:
        data = json.loads(raw)
        return {
            "intent": data.get("intent", "data_lookup"),
            "sub_queries": data.get("sub_queries", []),
            "direct_response": data.get("direct_response")
        }
    except json.JSONDecodeError:
        return {
            "intent": "data_lookup",
            "sub_queries": [user_query],
            "direct_response": None
        }

AGENT_ANSWER_PROMPT = """You are an intelligent, highly accurate analyst agent.
You are given a user query, and a list of retrieved data chunks from a vector database.

First, carefully read all the provided context chunks.
Second, determine which chunks actually contain the answer to the user's query.
Third, provide a clear, concise, and helpful answer to the user based ONLY on the provided context.

Requirements:
1. ONLY use information from the provided context chunks. If the answer is not in the chunks, say so. Do not hallucinate.
2. In your response, whenever you state a fact or data point from a chunk, you must explicitly cite it using the chunk's EXACT `source_id` within brackets, e.g., "The revenue was 5M [doc_1]".
3. DO NOT output high-entropy UUIDs. Only use the simplified `source_id` provided in the JSON context.
4. Output a JSON object containing your `response` (formatted as markdown text) and an array of `used_source_ids` which lists the exact strings of the sources you actually relied upon.

Format your output exactly as this JSON structure:
{
  "response": "Your detailed answer here with citations like [doc_0].",
  "used_source_ids": ["doc_0", "doc_1"]
}
"""

def generate_agent_answer(user_query: str, context_chunks: List[Dict], chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
    # 1. Map UUIDs to simplified IDs for the LLM
    uuid_to_source_id = {}
    source_id_to_uuid = {}
    simplified_chunks = []
    
    for i, chunk in enumerate(context_chunks):
        source_id = f"doc_{i}"
        uuid_to_source_id[chunk["id"]] = source_id
        source_id_to_uuid[source_id] = chunk["id"]
        
        simplified_chunks.append({
            "source_id": source_id,
            "filename": chunk.get("filename", "Unknown"),
            "table_name": chunk.get("table_name"),
            "content": chunk.get("text_summary")
        })

    # Prepare context string
    context_str = json.dumps(simplified_chunks, indent=2)

    messages = [
        {"role": "system", "content": AGENT_ANSWER_PROMPT},
    ]

    if chat_history:
        for msg in chat_history[-4:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
    
    messages.append({
        "role": "user", 
        "content": f"User Query: {user_query}\n\nContext Chunks:\n{context_str}"
    })

    try:
        completion = get_next_client().chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        raw_response = completion.choices[0].message.content
        parsed = json.loads(raw_response)
        
        # Map source_ids back to UUIDs
        used_source_ids = parsed.get("used_source_ids", [])
        used_uuids = [
            source_id_to_uuid[sid] for sid in used_source_ids 
            if sid in source_id_to_uuid
        ]
        
        return {
            "response": parsed.get("response", "I could not formulate an answer."),
            "used_chunk_ids": list(set(used_uuids)) # Deduplicate
        }
        
    except Exception as e:
        print(f"Error in agent answering: {e}")
        return {
            "response": f"Sorry, I encountered an error while trying to formulate the answer: {str(e)}",
            "used_chunk_ids": []
        }
