import * as Comlink from "comlink";
import type { DbWorkerApi } from "../workers/db.worker";

let dbWorkerInstance: Comlink.Remote<DbWorkerApi> | null = null;

export function getDb() {
    if (!dbWorkerInstance) {
        const worker = new Worker(new URL("../workers/db.worker.ts", import.meta.url), {
            type: "module",
        });
        dbWorkerInstance = Comlink.wrap<DbWorkerApi>(worker);
        // Trigger init immediately
        dbWorkerInstance.init().catch(err => console.error("DB Init failed immediately:", err));
    }
    return dbWorkerInstance;
}
