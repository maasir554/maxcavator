const API_URL = "http://localhost:8000";

export interface TableSchema {
    name: string;
    type: string;
}

export interface TableData {
    table_name: string;
    description: string;
    schema_list: TableSchema[];
    rows: any[];
}

export const apiService = {
    async extractTables(text: string): Promise<{ tables: TableData[], debug_info?: any }> {
        const res = await fetch(`${API_URL}/extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
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
    }
};
