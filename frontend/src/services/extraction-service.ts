import * as Comlink from "comlink";
import type { ExtractionWorkerApi } from "../workers/extraction.worker";

let workerInstance: Comlink.Remote<ExtractionWorkerApi> | null = null;

export function getExtractionWorker() {
    if (!workerInstance) {
        const worker = new Worker(new URL("../workers/extraction.worker.ts", import.meta.url), {
            type: "module",
        });
        workerInstance = Comlink.wrap<ExtractionWorkerApi>(worker);
    }
    return workerInstance;
}

export const extractionService = {
    async processDocument(
        file: File,
        documentId: string,
        startPage: number = 1,
        cb?: (progress: any) => Promise<boolean>
    ) {
        const worker = getExtractionWorker();
        return await worker.processPdf(file, documentId, startPage, cb);
    },

    async testPage(file: File, pageNum: number) {
        const worker = getExtractionWorker();
        return await worker.testPage(file, pageNum);
    },

    async renderPage(file: File, pageNum: number) {
        const worker = getExtractionWorker();
        return await worker.renderPage(file, pageNum);
    },

    async extractPdfText(file: File, pageNum: number) {
        const worker = getExtractionWorker();
        return await worker.extractPdfText(file, pageNum);
    }
};
