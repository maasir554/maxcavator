import os
import json
from groq import Groq
from models import TableExtraction
from typing import List, Tuple, Dict

# Initialize multiple Groq clients for load distribution
# round-robin load distribution scheme
clients = []
key_index = 0

for i in range(7):
    cur_key = os.environ.get(f"GROQ_API_KEY_{i+1}")
    clients.append(Groq(api_key=cur_key))

def get_next_client():
    """Get next client using round-robin distribution"""
    global key_index
    client = clients[key_index % 7]
    key_index += 1
    return client

TABLE_EXTRACTION_PROMPT = """
You are a data extraction engine. Analyze the following OCR text from a document page.

1. Identify ALL tables, lists, or structured data in the text. Look closely at the BOTTOM of tables or pages for footnotes, keys, or abbreviations (e.g., "* denotes estimated values" or "Rev = Revenue").
2. For each table, extract EVERY row as an individual "chunk" — a self-contained JSON record.
3. Provide a schema describing each field's name, data type, and a brief description. Incorporate any abbreviations Found into the column descriptions.
4. Write a concise summary of what the table represents.
5. Add relevant descriptive notes (e.g., currency, units, data quality caveats, footnotes, abbreviation definitions & full forms).
6. For each chunk, write a highly descriptive three-line natural language summary of that specific entry. This summary MUST explicitly feature all vital context parameters of the row including the main entity, and all the parameters present.

Output Format (JSON only):
{
  "tables": [
    {
      "table_name": "snake_case_name",
      "summary": "Brief description of what this table contains",
      "notes": "descriptive relevant context, units, caveats, abbreviations with full forms (important!)",
      "schema_fields": [
        {
          "name": "field_name",
          "type": "TEXT|NUMERIC|DATE|BOOLEAN",
          "description": "What this field represents (include full form if abbreviated in raw text)"
        }
      ],
      "chunks": [
        {
          "data": {"field_name": "value", ...},
          "text_summary": "One-line natural language summary of this entry"
        }
      ],
      "updated_notes": null | string
    }
  ]
}

RULES:
- Every row in the original table must become exactly one chunk.
- The "data" object keys must match the "schema_fields" field names exactly.
- The "text_summary" should be a readable sentence, not just key-value pairs (e.g., "In Q2 2023, Acme Corp generated $5M in revenue"). Include available dates, metric units, and periods!
- Use snake_case for table_name and field names.
- Infer data types: use NUMERIC for numbers, DATE for dates, BOOLEAN for yes/no, TEXT for everything else.
- CRITICAL CONTINUATION RULE: If previous tables are provided and you identify a table that is a continuation of a table from the previous page:
  1. You MUST inherit the exact "table_name" to link them.
  2. For the chunks, you MUST use the exact "schema_fields" from the provided previous table. Do not invent new column keys for the chunk data.
  3. However, if this new page contains crucial NEW context about the table at the bottom (like abbreviation definitions) that wasn't in the previous schema or notes:
     - Provide the NEW, improved notes in "updated_notes".
  4. If no new context is found, leave "updated_schema_fields" and "updated_notes" as null.
- If NO tables are found, return {"tables": []}.
"""

PDF_SUMMARY_PROMPT = """
You are a document analysis assistant. Given the text from the first pages of a PDF document, provide:
1. A concise, descriptive title for the document (not a filename — a proper human-readable title).
2. A brief summary (2-3 sentences) describing what the document is about.

Output Format (JSON only):
{
  "title": "Human-readable document title",
  "summary": "2-3 sentence summary of the document's content and purpose."
}
"""

SQL_GENERATION_PROMPT = """
You have access to a local SQL database (PostgreSQL).
The user asks: "{user_query}"
Relevant Table Schema: {table_schema_json}

Write a SINGLE SQL query to answer this. Do not use Markdown. Do not explain. Just the SQL.
"""


def extract_tables_from_text(text: str, previous_tables: list = None) -> Tuple[List[TableExtraction], Dict[str, str]]:
    messages = [
        {"role": "system", "content": TABLE_EXTRACTION_PROMPT + "\n\nCRITICAL: You must return a valid JSON object with a 'tables' key."}
    ]
    
    if previous_tables:
        messages.append({
            "role": "user", 
            "content": f"PREVIOUS PAGE TABLES SCHEMAS (inherit if continuing, but update via updated_notes if new/important context found):\n{json.dumps(previous_tables, indent=2)}"
        })
        
    messages.append({"role": "user", "content": text})
    
    completion = get_next_client().chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        temperature=0,
        response_format={"type": "json_object"}
    )
    
    content = completion.choices[0].message.content
    debug_info = {
        "ocr_text": text,
        "prompt_sent": json.dumps(messages, indent=2),
        "raw_response": content
    }

    try:
        data = json.loads(content)
        if isinstance(data, list):
            return [TableExtraction(**item) for item in data], debug_info
        if "tables" in data:
            return [TableExtraction(**item) for item in data["tables"]], debug_info
        return [], debug_info
    except Exception as e:
        print(f"Error parsing AI response: {e}")
        return [], debug_info


def extract_pdf_summary(page_texts: list[str]) -> dict:
    """Extract title and summary from first pages of a PDF."""
    combined = "\n\n---PAGE BREAK---\n\n".join(page_texts)
    
    messages = [
        {"role": "system", "content": PDF_SUMMARY_PROMPT + "\n\nCRITICAL: Return valid JSON only."},
        {"role": "user", "content": combined}
    ]
    
    completion = get_next_client().chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        temperature=0,
        response_format={"type": "json_object"}
    )
    
    content = completion.choices[0].message.content
    try:
        data = json.loads(content)
        return {"title": data.get("title", ""), "summary": data.get("summary", "")}
    except Exception as e:
        print(f"Error parsing PDF summary: {e}")
        return {"title": "", "summary": ""}


def generate_sql_query(user_query: str, table_schema: dict) -> str:
    prompt = SQL_GENERATION_PROMPT.format(user_query=user_query, table_schema_json=json.dumps(table_schema))
    
    completion = get_next_client().chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": "You are a SQL expert."},
            {"role": "user", "content": prompt}
        ],
        temperature=0
    )
    
    sql = completion.choices[0].message.content.strip()
    sql = sql.replace("```sql", "").replace("```", "").strip()
    return sql

RAG_CHAT_PROMPT = """
You are a highly intelligent and helpful data assistant for MAXCAVATOR. 
The user will ask a question about their PDF data.
You have been provided with CONTEXT CHUNKS which represent the most semantically relevant data extracted from the user's documents. Each chunk has a unique 'source_id' (e.g., 'doc_0', 'doc_1').

RULES:
1. Answer the user's question explicitly and ONLY using the provided CONTEXT CHUNKS.
2. Formulate your response in clear, concise natural language. Use markdown formatting where it makes sense (bold text, lists, etc) to be readable.
3. If the answer cannot be found in the provided CONTEXT CHUNKS, explicitly state: "I could not find the answer to this question in the extracted documents." Do not guess or hallucinate.
4. You MUST explicitly map which provided chunks you used to formulate your answer using their 'source_id'.

Output Format (JSON only):
{
  "answer": "Your natural language response here...",
  "used_source_ids": ["doc_0", "doc_1"]
}
"""

def generate_rag_response(user_query: str, context_chunks: list) -> dict:
    chunk_mapping = {}
    formatted_chunks = []
    
    for idx, chunk in enumerate(context_chunks):
        source_id = f"doc_{idx}"
        chunk_mapping[source_id] = chunk.get("id")
        
        # Create a simplified chunk for the LLM without high-entropy UUIDs
        simplified_chunk = {
            "source_id": source_id,
            "filename": chunk.get("filename"),
            "table_name": chunk.get("table_name"),
            "page_number": chunk.get("page_number"),
            "data": chunk.get("data"),
            "text_summary": chunk.get("text_summary")
        }
        formatted_chunks.append(simplified_chunk)

    messages = [
        {"role": "system", "content": RAG_CHAT_PROMPT + "\n\nCRITICAL: Return valid JSON only."},
        {"role": "user", "content": f"CONTEXT CHUNKS:\n{json.dumps(formatted_chunks, indent=2)}\n\nUSER QUESTION: {user_query}"}
    ]

    completion = get_next_client().chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        temperature=0.2, # Slight temperature for natural phrasing while remaining factual
        response_format={"type": "json_object"}
    )
    
    content = completion.choices[0].message.content.strip()
    try:
        data = json.loads(content)
        
        # Map source_ids back to original UUIDs for the frontend
        used_source_ids = data.get("used_source_ids", [])
        original_chunk_ids = []
        for sid in used_source_ids:
            if sid in chunk_mapping:
                original_chunk_ids.append(chunk_mapping[sid])
                
        return {
            "response": data.get("answer", "I encountered an error formatting my response."),
            "used_chunk_ids": original_chunk_ids
        }
    except Exception as e:
        print(f"Error parsing RAG response: {e}")
        return {
            "response": "Sorry, I had trouble generating a structured response based on the documents.",
            "used_chunk_ids": []
        }

