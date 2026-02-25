import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY_1") or os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("Listing models containing 'embed', '004', or '001':")
for m in client.models.list():
    if "embed" in m.name.lower() or "004" in m.name.lower() or "001" in m.name.lower():
        print(f"Name: {m.name}, Display: {repr(m.display_name)}")
