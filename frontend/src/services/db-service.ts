import { getDb } from "../lib/db";

export interface Document {
    id: string;
    filename: string;
    source_url?: string;
    status: 'queued' | 'processing' | 'paused' | 'completed';
    total_pages: number;
    processed_pages: number;
    created_at: string;
    updated_at?: string;
    deleted_at?: string | null;
    dismissed_from_queue?: boolean;
    name_embedding?: number[];
}

export const dbService = {
    async getAllDocuments(): Promise<Document[]> {
        const db = getDb();
        const res = await db.query("SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY created_at DESC");
        // console.log("getAllDocuments raw result:", res.rows);
        return res.rows as Document[];
    },

    async getDocument(id: string): Promise<Document | null> {
        const db = getDb();
        const res = await db.query("SELECT * FROM documents WHERE id = $1", [id]);
        return (res.rows[0] as Document) ?? null;
    },

    async addDocument(filename: string, sourceUrl?: string): Promise<string> {
        const db = getDb();
        // PGlite returns query results, we need to extract the ID.
        // Since we use gen_random_uuid(), we can just insert and return id.
        const res = await db.query(
            "INSERT INTO documents (filename, source_url, dismissed_from_queue) VALUES ($1, $2, FALSE) RETURNING id",
            [filename, sourceUrl || null]
        );
        return (res.rows[0] as any).id;
    },

    async updateDocumentStatus(id: string, status: string, processedPages: number, totalPages?: number) {
        const db = getDb();
        if (totalPages !== undefined) {
            await db.query(
                "UPDATE documents SET status = $1, processed_pages = $2, total_pages = $3, updated_at = NOW() WHERE id = $4",
                [status, processedPages, totalPages, id]
            );
        } else {
            await db.query(
                "UPDATE documents SET status = $1, processed_pages = $2, updated_at = NOW() WHERE id = $3",
                [status, processedPages, id]
            );
        }
    },

    async updateDocumentTitleAndSummary(id: string, title: string, summary: string, nameEmbedding?: number[]) {
        const db = getDb();
        if (nameEmbedding) {
            await db.query(
                "UPDATE documents SET filename = $1, summary = $2, name_embedding = $3, updated_at = NOW() WHERE id = $4",
                [title, summary, JSON.stringify(nameEmbedding), id]
            );
        } else {
            await db.query(
                "UPDATE documents SET filename = $1, summary = $2, updated_at = NOW() WHERE id = $3",
                [title, summary, id]
            );
        }
    },

    async getTables() {
        const db = getDb();
        return await db.getTables();
    },

    async getFullSchema() {
        const db = getDb();
        const res = await db.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            ORDER BY table_name, ordinal_position
        `);

        // Group by table
        const schema: Record<string, any[]> = {};
        for (const r of res.rows) {
            const row = r as any;
            const t = row.table_name as string;
            if (!schema[t]) schema[t] = [];
            schema[t].push({ name: row.column_name, type: row.data_type });
        }
        return schema;
    },

    async executeQuery(sql: string) {
        const db = getDb();
        return await db.query(sql);
    },

    async saveExtractedData(tables: any[], docId: string, pageNum: number) {
        for (const table of tables) {
            // 1. Insert into pdf_tables
            const tableId = await this.savePdfTable(docId, table, pageNum);

            // 2. Insert each chunk
            if (table.chunks && table.chunks.length > 0) {
                await this.saveChunks(tableId, docId, table.chunks, pageNum);
            }
        }
    },

    async savePdfTable(
        docId: string,
        table: { table_name: string; summary: string; notes: string; schema_fields: any[]; summary_embedding?: number[] },
        pageNum: number
    ): Promise<string> {
        const db = getDb();
        const res = await db.query(
            `INSERT INTO pdf_tables (document_id, table_name, summary, notes, schema_json, summary_embedding, page_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                docId,
                table.table_name,
                table.summary,
                table.notes,
                JSON.stringify(table.schema_fields),
                table.summary_embedding ? JSON.stringify(table.summary_embedding) : null,
                pageNum
            ]
        );
        return (res.rows[0] as any).id;
    },

    async saveChunks(
        tableId: string,
        docId: string,
        chunks: { data: Record<string, any>; text_summary: string; summary_embedding?: number[] }[],
        pageNum: number
    ) {
        const db = getDb();
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            await db.query(
                `INSERT INTO chunks (pdf_table_id, document_id, data, text_summary, summary_embedding, page_number, chunk_index)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    tableId,
                    docId,
                    JSON.stringify(chunk.data),
                    chunk.text_summary,
                    chunk.summary_embedding ? JSON.stringify(chunk.summary_embedding) : null,
                    pageNum,
                    i
                ]
            );
        }
    },

    async getPdfTables(docId?: string): Promise<any[]> {
        const db = getDb();
        if (docId) {
            const res = await db.query(
                "SELECT * FROM pdf_tables WHERE document_id = $1 ORDER BY created_at DESC",
                [docId]
            );
            return res.rows;
        }
        const res = await db.query("SELECT * FROM pdf_tables ORDER BY created_at DESC");
        return res.rows;
    },

    async getTotalTableCount(): Promise<number> {
        const db = getDb();
        const res = await db.query("SELECT COUNT(*) as count FROM pdf_tables");
        return parseInt((res.rows[0] as any).count, 10);
    },

    async getPdfTablesByPage(docId: string, pageNumber: number): Promise<any[]> {
        const db = getDb();
        const res = await db.query(
            "SELECT * FROM pdf_tables WHERE document_id = $1 AND page_number = $2",
            [docId, pageNumber]
        );
        return res.rows;
    },

    async getChunks(tableId: string): Promise<any[]> {
        const db = getDb();
        const res = await db.query(
            "SELECT * FROM chunks WHERE pdf_table_id = $1 ORDER BY chunk_index ASC",
            [tableId]
        );
        return res.rows;
    },

    async getAllChunks(docId: string): Promise<any[]> {
        const db = getDb();
        const res = await db.query(
            "SELECT c.*, pt.table_name FROM chunks c JOIN pdf_tables pt ON c.pdf_table_id = pt.id WHERE c.document_id = $1 ORDER BY pt.table_name, c.chunk_index",
            [docId]
        );
        return res.rows;
    },

    // --- Trash operations ---

    async getTrashedDocuments(): Promise<Document[]> {
        const db = getDb();
        const res = await db.query("SELECT * FROM documents WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC");
        return res.rows as Document[];
    },

    async softDeleteDocument(id: string) {
        const db = getDb();
        await db.query("UPDATE documents SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1", [id]);
    },

    async dismissDocument(id: string) {
        const db = getDb();
        await db.query("UPDATE documents SET dismissed_from_queue = TRUE, updated_at = NOW() WHERE id = $1", [id]);
    },

    async restoreDocument(id: string) {
        const db = getDb();
        await db.query("UPDATE documents SET deleted_at = NULL, updated_at = NOW() WHERE id = $1", [id]);
    },

    async permanentlyDeleteDocument(id: string) {
        const db = getDb();
        await db.query("DELETE FROM documents WHERE id = $1", [id]);
    },

    async purgeExpiredTrash(cutoffDate: Date): Promise<string[]> {
        const db = getDb();
        const res = await db.query(
            "DELETE FROM documents WHERE deleted_at IS NOT NULL AND deleted_at < $1 RETURNING id",
            [cutoffDate.toISOString()]
        );
        return (res.rows as any[]).map(r => r.id);
    },

    async semanticFileSearch(queryEmbedding: number[]): Promise<string[]> {
        const db = getDb();
        const embStr = JSON.stringify(queryEmbedding);

        const res = await db.query(`
            WITH doc_matches AS (
                SELECT id as document_id, 1 - (name_embedding <=> $1) as score
                FROM documents 
                WHERE deleted_at IS NULL AND name_embedding IS NOT NULL
            ),
            table_matches AS (
                SELECT pt.document_id, 1 - (pt.summary_embedding <=> $1) * 0.9 as score
                FROM pdf_tables pt
                JOIN documents d ON d.id = pt.document_id
                WHERE d.deleted_at IS NULL AND pt.summary_embedding IS NOT NULL
            ),
            chunk_matches AS (
                SELECT c.document_id, 1 - (c.summary_embedding <=> $1) * 0.8 as score
                FROM chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE d.deleted_at IS NULL AND c.summary_embedding IS NOT NULL
            ),
            combined AS (
                SELECT document_id, max(score) as max_score FROM (
                    SELECT * FROM doc_matches
                    UNION ALL
                    SELECT * FROM table_matches
                    UNION ALL
                    SELECT * FROM chunk_matches
                ) all_matches
                GROUP BY document_id
            )
            SELECT document_id, max_score
            FROM combined
            WHERE max_score > 0.3
            ORDER BY max_score DESC
            LIMIT 20;
        `, [embStr]);

        return res.rows.map((r: any) => r.document_id as string);
    },

    async semanticChunkSearch(queryEmbedding: number[], limit: number = 3): Promise<any[]> {
        const db = getDb();
        const embStr = JSON.stringify(queryEmbedding);

        // Search specifically chunks, joining with pdf_tables to get the context and with documents to ensure it's not deleted
        const res = await db.query(`
            SELECT 
                c.id, 
                c.document_id, 
                c.page_number, 
                c.data, 
                c.text_summary,
                pt.table_name,
                d.filename,
                1 - (c.summary_embedding <=> $1) as similarity_score
            FROM chunks c
            JOIN pdf_tables pt ON c.pdf_table_id = pt.id
            JOIN documents d ON c.document_id = d.id
            WHERE d.deleted_at IS NULL AND c.summary_embedding IS NOT NULL
            ORDER BY similarity_score DESC
            LIMIT $2;
        `, [embStr, limit]);

        return res.rows;
    },

    async topDownSemanticSearch(queryEmbedding: number[], limit: number = 5): Promise<any[]> {
        const db = getDb();
        const embStr = JSON.stringify(queryEmbedding);

        // Step 1: Find top 3 docs
        // Step 2: Find top 3 tables in those docs
        // Step 3: Find top 3 tables overall
        // Step 4: Union the tables
        // Step 5: Find top chunks within those tables
        const res = await db.query(`
            WITH top_docs AS (
                SELECT id 
                FROM documents 
                WHERE deleted_at IS NULL AND name_embedding IS NOT NULL 
                ORDER BY name_embedding <=> $1 
                LIMIT 3
            ),
            top_tables_per_doc AS (
                SELECT t.id FROM (
                    SELECT pt.id, ROW_NUMBER() OVER(PARTITION BY pt.document_id ORDER BY pt.summary_embedding <=> $1) as rn
                    FROM pdf_tables pt
                    JOIN top_docs td ON pt.document_id = td.id
                    WHERE pt.summary_embedding IS NOT NULL
                ) t WHERE t.rn <= 3
            ),
            top_tables_overall AS (
                SELECT pt.id 
                FROM pdf_tables pt
                JOIN documents d ON pt.document_id = d.id
                WHERE d.deleted_at IS NULL AND pt.summary_embedding IS NOT NULL 
                ORDER BY pt.summary_embedding <=> $1 
                LIMIT 3
            ),
            combined_tables AS (
                SELECT id FROM top_tables_per_doc
                UNION
                SELECT id FROM top_tables_overall
            )
            SELECT 
                c.id, 
                c.document_id, 
                c.page_number, 
                c.data, 
                c.text_summary,
                pt.table_name,
                d.filename,
                1 - (c.summary_embedding <=> $1) as similarity_score
            FROM chunks c
            JOIN combined_tables ct ON c.pdf_table_id = ct.id
            JOIN pdf_tables pt ON c.pdf_table_id = pt.id
            JOIN documents d ON c.document_id = d.id
            WHERE d.deleted_at IS NULL AND c.summary_embedding IS NOT NULL
            ORDER BY similarity_score DESC
            LIMIT $2;
        `, [embStr, limit]);

        return res.rows;
    }
};
