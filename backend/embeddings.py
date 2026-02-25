import os
from google import genai
from google.genai import types

# Initialize round-robin load distribution for Gemini keys
gemini_keys = []
for i in range(1, 10):
    cur_key = os.environ.get(f"GEMINI_API_KEY_{i}")
    if cur_key:
        gemini_keys.append(cur_key)

# Fallback in case a generic key is used instead
if not gemini_keys:
    single_key = os.environ.get("GEMINI_API_KEY")
    if single_key:
        gemini_keys.append(single_key)

gemini_key_index = 0

def get_next_gemini_key():
    """Get next Gemini client using round-robin distribution"""
    global gemini_key_index
    if not gemini_keys:
        return None
    key = gemini_keys[gemini_key_index % len(gemini_keys)]
    gemini_key_index += 1
    return key


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generates 768-dimensional embeddings for a list of texts using Gemini API."""
    if not texts:
        return []
        
    api_key = get_next_gemini_key()
    if not api_key:
        print("Warning: No GEMINI_API_KEYs set. Returning zero vectors.")
        return [[0.0] * 3072 for _ in texts]

    try:
        client = genai.Client(api_key=api_key)
        
        # We can pass a list of strings directly to generate embeddings in batch
        # Using gemini-embedding-001 which produces 768d vectors
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts,
        )
        
        # result.embeddings is a list of objects that have a .values attribute
        return [emb.values for emb in result.embeddings]
        
    except Exception as e:
        print(f"Error generating embeddings: {e}")
        # Fallback to zero vectors on failure to preserve extraction flow
        return [[0.0] * 3072 for _ in texts]
