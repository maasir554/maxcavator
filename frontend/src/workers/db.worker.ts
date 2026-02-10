import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import * as Comlink from "comlink";
import { SCHEMA_SQL } from "../db/schema";

let db: PGlite | null = null;
let initPromise: Promise<boolean> | null = null;

const api = {
    async init() {
        if (db) return true;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            console.log("Initializing database worker...");
            try {
                db = await PGlite.create({
                    dataDir: "idb://maxcavator-db",
                    extensions: { vector },
                });
                await db.waitReady;
                await db.exec(SCHEMA_SQL);
                console.log("Database initialized and schema ensured.");
                return true;
            } catch (err) {
                console.error("Failed to initialize database:", err);
                db = null;
                initPromise = null;
                throw err;
            }
        })();

        return initPromise;
    },

    async query(sql: string, params: any[] = []) {
        if (!db) await this.init();
        try {
            return await db!.query(sql, params);
        } catch (err) {
            console.error("Query failed:", sql, err);
            throw err;
        }
    },

    async exec(sql: string) {
        if (!db) await this.init();
        try {
            return await db!.exec(sql);
        } catch (err) {
            console.error("Exec failed:", sql, err);
            throw err;
        }
    },

    async getTables() {
        if (!db) await this.init();
        const res = await db!.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `);
        return res.rows;
    }
};

export type DbWorkerApi = typeof api;
Comlink.expose(api);
