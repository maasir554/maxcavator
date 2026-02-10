import os
import json
from groq import Groq
from models import TableData
from typing import List

# Initialize Groq client
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

TABLE_EXTRACTION_PROMPT = """
You are a data extraction engine. Analyze the following OCR text from a document page.
1. Identify if there are any tables.
2. For each table, extract the data into a JSON structure.
3. Create a unique, snake_case SQL table name based on the content (e.g., 'balance_sheet_2023').
4. infer the data type for each column (TEXT, NUMERIC, DATE).

Output Format (JSON only):
{
  "tables": [
    {
      "table_name": "string",
      "description": "string summary of table",
      "schema_list": [{"name": "col_name", "type": "TEXT|NUMERIC"}],
      "rows": [{"col_name": "value"}]
    }
  ]
}
"""

SQL_GENERATION_PROMPT = """
You have access to a local SQL database (PostgreSQL).
The user asks: "{user_query}"
Relevant Table Schema: {table_schema_json}

Write a SINGLE SQL query to answer this. Do not use Markdown. Do not explain. Just the SQL.
"""


from typing import List, Tuple, Dict

def extract_tables_from_text(text: str) -> Tuple[List[TableData], Dict[str, str]]:
    messages = [
        {"role": "system", "content": TABLE_EXTRACTION_PROMPT + "\n\nCRITICAL: You must return a valid JSON object with a 'tables' key containing the list of tables."},
        {"role": "user", "content": text}
    ]
    
    completion = client.chat.completions.create(
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
        # Wrap in expected structure if model returns raw array
        data = json.loads(content)
        if isinstance(data, list):
            return [TableData(**item) for item in data], debug_info
        if "tables" in data:
            return [TableData(**item) for item in data["tables"]], debug_info
        return [], debug_info # Empty if structure unknown
    except Exception as e:
        print(f"Error parsing AI response: {e}")
        return [], debug_info

def generate_sql_query(user_query: str, table_schema: dict) -> str:
    prompt = SQL_GENERATION_PROMPT.format(user_query=user_query, table_schema_json=json.dumps(table_schema))
    
    completion = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": "You are a SQL expert."},
            {"role": "user", "content": prompt}
        ],
        temperature=0
    )
    
    sql = completion.choices[0].message.content.strip()
    # Cleanup markdown code blocks if present
    sql = sql.replace("```sql", "").replace("```", "").strip()
    return sql
