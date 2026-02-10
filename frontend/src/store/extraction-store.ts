import { create } from 'zustand';
import { dbService } from '@/services/db-service';
import { extractionService } from '@/services/extraction-service';
import * as Comlink from 'comlink';

export type JobStatus = 'queued' | 'processing' | 'paused' | 'completed' | 'error';

export interface ExtractionJob {
    documentId: string;
    filename: string;
    status: JobStatus;
    totalPages: number;
    processedPages: number;
    error?: string;
    file?: File;
    debugInfo?: Record<number, { ocrText: string, prompt: string, rawResponse: string }>;
}

interface ExtractionState {
    jobs: Record<string, ExtractionJob>;
    addJob: (file: File) => Promise<void>;
    addJobFromUrl: (url: string) => Promise<void>;
    startJob: (docId: string) => Promise<void>;
    updateJob: (id: string, updates: Partial<ExtractionJob>) => void;
    pauseJob: (id: string) => void;
    resumeJob: (id: string) => void;
    testPage: (docId: string, pageNum: number) => Promise<{ text: string, imageBlob: Blob }>;
    renderPage: (docId: string, pageNum: number) => Promise<{ imageBlob: Blob }>;
    extractPdfText: (docId: string, pageNum: number) => Promise<{ text: string }>;
    testAi: (text: string) => Promise<{ tables: any[], debug_info?: any }>;
    _processJob: (file: File, docId: string, startPage: number) => Promise<void>;
}

export const useExtractionStore = create<ExtractionState>((set, get) => ({
    jobs: {},

    addJobFromUrl: async (url: string, customFilename?: string) => {
        try {
            // Try direct fetch first
            let res = await fetch(url).catch(() => null);

            // If failed or CORS error (often opaque response or throw), try proxy
            if (!res || !res.ok) {
                console.log("Direct fetch failed, trying proxy...");
                const proxyUrl = `http://localhost:8000/proxy_pdf?url=${encodeURIComponent(url)}`;
                res = await fetch(proxyUrl);
            }

            if (!res.ok) throw new Error("Failed to fetch PDF");

            const blob = await res.blob();
            const urlFilename = url.split('/').pop() || "downloaded_doc.pdf";
            const filename = customFilename ? `${customFilename}.pdf` : urlFilename;
            const file = new File([blob], filename, { type: "application/pdf" });

            await get().addJob(file);
        } catch (e: any) {
            console.error("Error adding job from URL", e);
            throw e;
        }
    },

    addJob: async (file: File) => {
        const docId = await dbService.addDocument(file.name);

        set((state) => ({
            jobs: {
                ...state.jobs,
                [docId]: {
                    documentId: docId,
                    filename: file.name,
                    status: 'queued',
                    totalPages: 0,
                    processedPages: 0,
                    file: file
                }
            }
        }));

        // Auto-start processed removed for interactive workflow
        // get()._processJob(file, docId, 1);
    },

    startJob: async (docId: string) => {
        const job = get().jobs[docId];
        if (job && job.file && (job.status === 'queued' || job.status === 'paused' || job.status === 'error')) {
            get()._processJob(job.file, docId, job.processedPages + 1);
        }
    },

    testPage: async (docId: string, pageNum: number) => {
        const job = get().jobs[docId];
        if (!job || !job.file) throw new Error("Document not found");

        // This will be implemented when we update the worker to support single page extraction
        // For now, we need to import the service dynamically to avoid circular deps if any
        const result = await extractionService.testPage(job.file, pageNum);
        return result;
    },

    renderPage: async (docId: string, pageNum: number) => {
        const job = get().jobs[docId];
        if (!job || !job.file) throw new Error("Document not found");

        const result = await extractionService.renderPage(job.file, pageNum);
        return result;
    },

    extractPdfText: async (docId: string, pageNum: number) => {
        const job = get().jobs[docId];
        if (!job || !job.file) throw new Error("Document not found");

        const result = await extractionService.extractPdfText(job.file, pageNum);
        return result;
    },

    testAi: async (text: string) => {
        const { apiService } = await import('@/services/api-service');
        return await apiService.extractTables(text);
    },

    updateJob: (id, updates) => set((state) => ({
        jobs: {
            ...state.jobs,
            [id]: { ...state.jobs[id], ...updates }
        }
    })),

    pauseJob: (id) => {
        get().updateJob(id, { status: 'paused' });
        dbService.updateDocumentStatus(id, 'paused', get().jobs[id].processedPages);
    },

    resumeJob: (id) => {
        const job = get().jobs[id];
        if (job && job.file && job.status === 'paused') {
            get()._processJob(job.file, id, job.processedPages + 1);
        }
    },

    _processJob: async (file: File, docId: string, startPage: number) => {
        const { updateJob } = get();
        updateJob(docId, { status: 'processing' });

        try {
            await extractionService.processDocument(
                file,
                docId,
                startPage,
                Comlink.proxy(async (progress: any) => {
                    // Check if we should continue
                    const currentStatus = get().jobs[docId]?.status;
                    if (currentStatus === 'paused') return false;

                    updateJob(docId, {
                        totalPages: progress.total,
                        processedPages: progress.current
                    });

                    // If text is available, process it (AI Extraction)
                    if (progress.text) {
                        try {
                            const { apiService } = await import('@/services/api-service');
                            const { tables, debug_info } = await apiService.extractTables(progress.text);

                            // Store debug info
                            if (debug_info) {
                                const currentJob = get().jobs[docId];
                                updateJob(docId, {
                                    debugInfo: {
                                        ...(currentJob.debugInfo || {}),
                                        [progress.current]: {
                                            ocrText: debug_info.ocr_text,
                                            prompt: debug_info.prompt_sent,
                                            rawResponse: debug_info.raw_response
                                        }
                                    }
                                });
                            }

                            console.log(`Extracted ${tables.length} tables from page ${progress.current}`);
                            if (tables.length > 0) {
                                await dbService.saveExtractedData(tables, docId, progress.current);
                            }
                        } catch (e) {
                            console.error("AI Extraction failed:", e);
                        }
                    }

                    if (progress.current > 0 && progress.current % 5 === 0) {
                        dbService.updateDocumentStatus(docId, 'processing', progress.current);
                    }
                    return true;
                })
            );

            // If finished and not paused
            const finalStatus = get().jobs[docId]?.status;
            if (finalStatus !== 'paused') {
                updateJob(docId, { status: 'completed' });
                dbService.updateDocumentStatus(docId, 'completed', get().jobs[docId].totalPages);
            }

        } catch (err: any) {
            console.error("Extraction failed for", docId, err);
            updateJob(docId, { status: 'error', error: err.message });
            dbService.updateDocumentStatus(docId, 'error', 0);
        }
    }
}));
