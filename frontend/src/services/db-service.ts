import { getDb } from "../lib/db";

export interface Document {
    id: string;
    filename: string;
    source_url?: string;
    status: 'queued' | 'processing' | 'paused' | 'completed';
    total_pages: number;
    processed_pages: number;
    created_at: string;
}

export const dbService = {
    async getAllDocuments(): Promise<Document[]> {
        const db = getDb();
        const res = await db.query("SELECT * FROM documents ORDER BY created_at DESC");
        return res.rows as Document[];
    },

    async addDocument(filename: string, sourceUrl?: string): Promise<string> {
        const db = getDb();
        // PGlite returns query results, we need to extract the ID.
        // Since we use gen_random_uuid(), we can just insert and return id.
        const res = await db.query(
            "INSERT INTO documents (filename, source_url) VALUES ($1, $2) RETURNING id",
            [filename, sourceUrl || null]
        );
        return (res.rows[0] as any).id;
    },

    async updateDocumentStatus(id: string, status: string, processedPages: number) {
        const db = getDb();
        await db.query(
            "UPDATE documents SET status = $1, processed_pages = $2 WHERE id = $3",
            [status, processedPages, id]
        );
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
        const db = getDb();
        for (const table of tables) {
            const tableName = table.table_name;
            const schema = table.schema_list;
            const rows = table.rows;

            // 1. Create table if not exists
            const columnDefs = schema.map((col: any) => {
                const type = col.type === 'NUMERIC' ? 'NUMERIC' : 'TEXT';
                return `"${col.name}" ${type}`;
            }).join(", ");

            // Add metadata columns
            const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (
                id UUID DEFAULT gen_random_uuid(),
                _source_doc_id UUID,
                _page_num INTEGER,
                ${columnDefs}
            );`;

            await db.exec(createSql);

            // 2. Insert data
            if (rows.length > 0) {
                for (const row of rows) {
                    const cols = ["_source_doc_id", "_page_num", ...Object.keys(row)];
                    const vals = [docId, pageNum, ...Object.values(row)];

                    const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
                    const colNames = cols.map(c => `"${c}"`).join(", ");

                    const insertSql = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
                    await db.query(insertSql, vals);
                }
            }

            // 3. Register schema (Optional / TODO)
            // await db.query("INSERT INTO schema_registry ...", ...);
        }
    }
};
