import os
from google import genai
from google.genai import types

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generates 768-dimensional embeddings for a list of texts using Gemini API."""
    if not texts:
        return []
        
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY not set. Returning zero vectors.")
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
