import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.environ.get("GROQ_API_KEY_1"))

RAG_CHAT_PROMPT = """
You are a highly intelligent and helpful data assistant for MAXCAVATOR. 
The user will ask a question about their PDF data.
You have been provided with CONTEXT CHUNKS which represent the most semantically relevant data extracted from the user's documents.

RULES:
1. Answer the user's question explicitly and ONLY using the provided CONTEXT CHUNKS.
2. Formulate your response in clear, concise natural language. Use markdown formatting where it makes sense (bold text, lists, etc) to be readable.
3. If the answer cannot be found in the provided CONTEXT CHUNKS, explicitly state: "I could not find the answer to this question in the extracted documents." Do not guess or hallucinate.
4. You MUST explicitly map which provided chunks you used to formulate your answer.

Output Format (JSON only):
{
  "answer": "Your natural language response here...",
  "used_chunk_ids": ["id-of-chunk-1", "id-of-chunk-2"]
}
"""

def test():
    chunks = [
        {"id": "c1", "data": {"text": "Hello world"}},
        {"id": "c2", "data": {"text": "Maxcavator is awesome"}}
    ]
    messages = [
        {"role": "system", "content": RAG_CHAT_PROMPT + "\n\nCRITICAL: Return valid JSON only."},
        {"role": "user", "content": f"CONTEXT CHUNKS:\n{json.dumps(chunks, indent=2)}\n\nUSER QUESTION: What is Maxcavator?"}
    ]

    try:
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        print("SUCCESS:")
        print(completion.choices[0].message.content)
    except Exception as e:
        print("ERROR:")
        print(e)

if __name__ == "__main__":
    test()
