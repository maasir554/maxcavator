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
    },



    // --- Orchestrator V2 modular pipeline ---

    async orchestratorController(
        userQuery: string,
        chatHistory?: any[],
        accumulator?: string,
        searchCount?: number,
        timeElapsedMs?: number,
        collectedChunksSummary?: string
    ): Promise<{ action: string; action_input: any }> {
        const res = await fetch(`${API_URL}/orchestrator/controller`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_query: userQuery,
                chat_history: chatHistory,
                accumulator: accumulator || "",
                search_count: searchCount || 0,
                time_elapsed_ms: timeElapsedMs || 0,
                collected_chunks_summary: collectedChunksSummary || ""
            }),
        });
        if (!res.ok) throw new Error("Orchestrator controller failed");
        return await res.json();
    },

    async orchestratorClassify(userQuery: string, chatHistory?: any[]): Promise<{
        intent: string;
        sub_queries: string[];
        direct_response?: string;
        math_ops: { op: string; a: string; b: string }[];
    }> {
        const res = await fetch(`${API_URL}/orchestrator/v2/classify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_query: userQuery, chat_history: chatHistory }),
        });
        if (!res.ok) throw new Error("Orchestrator classify failed");
        return await res.json();
    },

    async orchestratorAnalyze(userQuery: string, chunks: any[], intent?: string, subQueries?: string[]): Promise<{
        assessments: { source_id: string; keep: boolean; reason: string }[];
    }> {
        const res = await fetch(`${API_URL}/orchestrator/v2/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_query: userQuery, chunks, intent, sub_queries: subQueries }),
        });
        if (!res.ok) throw new Error("Orchestrator analyze failed");
        return await res.json();
    },

    async orchestratorSynthesize(
        userQuery: string,
        curatedChunks: any[],
        chatHistory?: any[],
        priorSources?: any[]
    ): Promise<{ response: string; used_source_ids: string[] }> {
        const res = await fetch(`${API_URL}/orchestrator/v2/synthesize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_query: userQuery,
                curated_chunks: curatedChunks,
                chat_history: chatHistory,
                prior_sources: priorSources,
            }),
        });
        if (!res.ok) throw new Error("Orchestrator synthesize failed");
        return await res.json();
    }
};
