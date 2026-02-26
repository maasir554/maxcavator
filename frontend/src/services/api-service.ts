const API_URL = "http://localhost:8000";

export interface FieldSchema {
    name: string;
    type: string;
    description: string;
}

export interface ChunkData {
    data: Record<string, any>;
    text_summary: string;
    summary_embedding?: number[];
}

export interface TableExtraction {
    table_name: string;
    summary: string;
    notes: string;
    schema_fields: FieldSchema[];
    chunks: ChunkData[];
    summary_embedding?: number[];
    updated_schema_fields?: FieldSchema[];
    updated_notes?: string;
}

export const apiService = {
    async extractTables(text: string, previousTables?: any[]): Promise<{ tables: TableExtraction[], debug_info?: any }> {
        const body: any = { text };
        if (previousTables && previousTables.length > 0) {
            body.previous_tables = previousTables;
        }

        const res = await fetch(`${API_URL}/extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Extraction failed");
        const data = await res.json();
        return { tables: data.tables, debug_info: data.debug_info };
    },

    async generateSql(userQuery: string, schema: any): Promise<string> {
        const res = await fetch(`${API_URL}/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_query: userQuery, table_schema: schema }),
        });
        if (!res.ok) throw new Error("Failed to generate SQL");
        const data = await res.json();
        return data.sql;
    },

    async visionOcr(base64Image: string): Promise<{ text: string, debug_info?: any }> {
        const res = await fetch(`${API_URL}/vision_ocr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Image }),
        });
        if (!res.ok) throw new Error("Vision OCR failed");
        return await res.json();
    },

    async extractPdfSummary(pageTexts: string[]): Promise<{ title: string, summary: string }> {
        const res = await fetch(`${API_URL}/pdf_summary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ page_texts: pageTexts }),
        });
        if (!res.ok) throw new Error("PDF Summary extraction failed");
        return await res.json();
    },

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const res = await fetch(`${API_URL}/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts }),
        });
        if (!res.ok) throw new Error("Embedding generation failed");
        const data = await res.json();
        return data.embeddings;
    },

    async generateRagChat(userQuery: string, contextChunks: any[]): Promise<{ response: string, used_chunk_ids: string[] }> {
        const res = await fetch(`${API_URL}/rag_chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_query: userQuery, context_chunks: contextChunks }),
        });
        if (!res.ok) throw new Error("Failed to generate RAG response");
        const data = await res.json();
        return { response: data.response, used_chunk_ids: data.used_chunk_ids || [] };
    },

    async getAgentPlan(userQuery: string, chatHistory?: any[]): Promise<{ intent: string, sub_queries: string[], direct_response?: string }> {
        const res = await fetch(`${API_URL}/agent/plan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_query: userQuery, chat_history: chatHistory }),
        });
        if (!res.ok) throw new Error("Agent Plan generation failed");
        return await res.json();
    },

    async getAgentAnswer(userQuery: string, retrievedChunks: any[], chatHistory?: any[]): Promise<{ response: string, used_chunk_ids: string[] }> {
        const res = await fetch(`${API_URL}/agent/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_query: userQuery, retrieved_chunks: retrievedChunks, chat_history: chatHistory }),
        });
        if (!res.ok) throw new Error("Agent Answer generation failed");
        const data = await res.json();
        return { response: data.response, used_chunk_ids: data.used_chunk_ids || [] };
    }
};
