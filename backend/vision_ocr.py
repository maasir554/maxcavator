import os
import base64
from groq import Groq
from typing import Dict

# Initialize Groq client
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

VISION_OCR_PROMPT = """Extract all text content from this image. Pay special attention to:
1. Preserve the exact text as it appears
2. Identify and preserve tabular data structure - clearly mark tables with headers and rows
3. Maintain the reading order and layout structure
4. For tables, use a clear format that distinguishes headers from data rows

Provide the extracted text in a clean, readable format that preserves the document structure."""

def extract_text_from_image(base64_image: str) -> Dict[str, str]:
    """
    Extract text from a base64-encoded image using Groq's vision model.
    
    Args:
        base64_image: Base64-encoded image string (without data:image prefix)
    
    Returns:
        Dict with 'text' key containing extracted text and 'debug_info' for troubleshooting
    """
    try:
        # Construct the image URL for Groq API
        image_url = f"data:image/png;base64,{base64_image}"
        
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": VISION_OCR_PROMPT
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url
                            }
                        }
                    ]
                }
            ],
            temperature=0,
            max_tokens=4096
        )
        
        extracted_text = completion.choices[0].message.content
        
        debug_info = {
            "model": "meta-llama/llama-4-scout-17b-16e-instruct",
            "prompt": VISION_OCR_PROMPT,
            "tokens_used": completion.usage.total_tokens if hasattr(completion, 'usage') else None
        }
        
        return {
            "text": extracted_text,
            "debug_info": debug_info
        }
        
    except Exception as e:
        print(f"Vision OCR error: {e}")
        return {
            "text": "",
            "debug_info": {
                "error": str(e)
            }
        }
