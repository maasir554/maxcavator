import { create } from 'zustand';
import { dbService } from '@/services/db-service';
import { extractionService } from '@/services/extraction-service';
import { pdfStore } from '@/services/pdf-store';

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
    dismissed_from_queue?: boolean;
}

export interface TrashedJob {
    documentId: string;
    filename: string;
    totalPages: number;
    processedPages: number;
    deletedAt: string;
    status: JobStatus;
}

const TRASH_DURATION_KEY = 'maxcavator-trash-duration-hours';

interface ExtractionState {
    jobs: Record<string, ExtractionJob>;
    trashedJobs: Record<string, TrashedJob>;
    trashAutoDeleteHours: number;
    totalTables: number;
    isLoading: boolean;
    loadJobs: () => Promise<void>;
    addJob: (file: File, sourceUrl?: string) => Promise<void>;
    addJobFromUrl: (url: string, customFilename?: string) => Promise<void>;
    startJob: (docId: string) => Promise<void>;
    updateJob: (id: string, updates: Partial<ExtractionJob>) => void;
    pauseJob: (id: string) => void;
    resumeJob: (id: string) => void;
    dismissJob: (id: string) => Promise<void>;
    trashJob: (id: string) => Promise<void>;
    restoreJob: (id: string) => Promise<void>;
    permanentlyDeleteJob: (id: string) => Promise<void>;
    emptyTrash: () => Promise<void>;
    setTrashAutoDeleteHours: (hours: number) => void;
    testPage: (docId: string, pageNum: number) => Promise<{ text: string, imageBlob: Blob }>;
    renderPage: (docId: string, pageNum: number) => Promise<{ imageBlob: Blob }>;
    extractPdfText: (docId: string, pageNum: number) => Promise<{ text: string }>;
    testAi: (text: string) => Promise<{ tables: any[], debug_info?: any }>;
    _processJob: (file: File, docId: string, startPage: number) => Promise<void>;
    focusedDocumentIds: string[];
    setFocusedDocumentIds: (ids: string[]) => void;
}

export const useExtractionStore = create<ExtractionState>((set, get) => ({
    jobs: {},
    trashedJobs: {},
    trashAutoDeleteHours: parseInt(localStorage.getItem(TRASH_DURATION_KEY) || '5', 10),
    totalTables: 0,
    isLoading: true,
    focusedDocumentIds: [],
    setFocusedDocumentIds: (ids) => set({ focusedDocumentIds: ids }),

    loadJobs: async () => {
        try {
            // Auto-purge expired trash
            const hours = get().trashAutoDeleteHours;
            const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
            const purgedIds = await dbService.purgeExpiredTrash(cutoff);
            for (const id of purgedIds) {
                await pdfStore.deletePdf(id);
            }
            if (purgedIds.length > 0) {
                console.log(`Auto-purged ${purgedIds.length} expired trashed document(s)`);
            }

            // Load active documents
            const docs = await dbService.getAllDocuments();
            const jobs: Record<string, ExtractionJob> = {};

            for (const doc of docs) {
                const file = await pdfStore.getPdf(doc.id);
                const status = doc.status === 'processing' ? 'paused' : doc.status as JobStatus;

                jobs[doc.id] = {
                    documentId: doc.id,
                    filename: doc.filename,
                    status,
                    totalPages: doc.total_pages,
                    processedPages: doc.processed_pages,
                    file: file ?? undefined,
                    dismissed_from_queue: doc.dismissed_from_queue || false,
                };
            }

            // Load trashed documents
            const trashedDocs = await dbService.getTrashedDocuments();
            const trashedJobs: Record<string, TrashedJob> = {};
            for (const doc of trashedDocs) {
                trashedJobs[doc.id] = {
                    documentId: doc.id,
                    filename: doc.filename,
                    totalPages: doc.total_pages,
                    processedPages: doc.processed_pages,
                    deletedAt: doc.deleted_at!,
                    status: doc.status as JobStatus,
                };
            }

            // Fetch total table count
            const totalTables = await dbService.getTotalTableCount();

            set({ jobs, trashedJobs, totalTables, isLoading: false });
        } catch (e) {
            console.error('Failed to load jobs from database:', e);
            set({ isLoading: false });
        }
    },

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

            await get().addJob(file, url);
        } catch (e: any) {
            console.error("Error adding job from URL", e);
            throw e;
        }
    },

    addJob: async (file: File, sourceUrl?: string) => {
        const docId = await dbService.addDocument(file.name, sourceUrl);

        // Persist the PDF blob to IndexedDB
        await pdfStore.savePdf(docId, file);

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

    dismissJob: async (id) => {
        await dbService.dismissDocument(id);
        set((state) => {
            const job = state.jobs[id];
            if (!job) return state;
            return {
                jobs: {
                    ...state.jobs,
                    [id]: { ...job, dismissed_from_queue: true }
                }
            };
        });
    },

    trashJob: async (id) => {
        await dbService.softDeleteDocument(id);
        const job = get().jobs[id];
        if (!job) return;

        const trashedJob: TrashedJob = {
            documentId: id,
            filename: job.filename,
            totalPages: job.totalPages,
            processedPages: job.processedPages,
            deletedAt: new Date().toISOString(),
            status: job.status,
        };

        set((state) => {
            const { [id]: _, ...remainingJobs } = state.jobs;
            return {
                jobs: remainingJobs,
                trashedJobs: { ...state.trashedJobs, [id]: trashedJob },
            };
        });
    },

    restoreJob: async (id) => {
        await dbService.restoreDocument(id);
        const trashed = get().trashedJobs[id];
        if (!trashed) return;

        const file = await pdfStore.getPdf(id);
        const restoredJob: ExtractionJob = {
            documentId: id,
            filename: trashed.filename,
            status: trashed.status === 'processing' ? 'paused' : trashed.status,
            totalPages: trashed.totalPages,
            processedPages: trashed.processedPages,
            file: file ?? undefined,
        };

        set((state) => {
            const { [id]: _, ...remainingTrashed } = state.trashedJobs;
            return {
                trashedJobs: remainingTrashed,
                jobs: { ...state.jobs, [id]: restoredJob },
            };
        });
    },

    permanentlyDeleteJob: async (id) => {
        await dbService.permanentlyDeleteDocument(id);
        await pdfStore.deletePdf(id);

        set((state) => {
            const { [id]: _, ...remainingTrashed } = state.trashedJobs;
            return { trashedJobs: remainingTrashed };
        });
    },

    emptyTrash: async () => {
        const trashed = get().trashedJobs;
        for (const id of Object.keys(trashed)) {
            await dbService.permanentlyDeleteDocument(id);
            await pdfStore.deletePdf(id);
        }
        set({ trashedJobs: {} });
    },

    setTrashAutoDeleteHours: (hours) => {
        localStorage.setItem(TRASH_DURATION_KEY, String(hours));
        set({ trashAutoDeleteHours: hours });
    },

    _processJob: async (file: File, docId: string, startPage: number) => {
        const { updateJob } = get();
        updateJob(docId, { status: 'processing' });

        try {
            const { renderPdfPageMainThread, getPdfPageCount } = await import('@/services/pdf-renderer');
            const { apiService } = await import('@/services/api-service');

            const totalPages = await getPdfPageCount(file);
            updateJob(docId, { totalPages });

            // Save totalPages to DB immediately so it persists on reload
            dbService.updateDocumentStatus(docId, 'processing', startPage - 1, totalPages);

            const firstPagesText: string[] = [];

            for (let i = startPage; i <= totalPages; i++) {
                // Check if paused
                const currentStatus = get().jobs[docId]?.status;
                if (currentStatus === 'paused') return;

                updateJob(docId, { processedPages: i - 1 });

                // 1. Render page on main thread (proper font support)
                const { imageBlob } = await renderPdfPageMainThread(file, i);

                // 2. Convert to base64 for Vision OCR
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageBlob);
                });

                // 3. Vision OCR
                const { text } = await apiService.visionOcr(base64);
                console.log(`Page ${i} text extracted (${text.length} chars)`);

                // Collect text for summary from first 2 pages
                if (i <= 2 && text.trim().length > 0) {
                    firstPagesText.push(text);
                }

                if (firstPagesText.length > 0 && (i === 2 || i === totalPages)) {
                    try {
                        console.log("Generating PDF summary from first pages...");
                        const { title, summary } = await apiService.extractPdfSummary(firstPagesText);

                        const documentName = title || file.name;
                        let nameEmbedding: number[] | undefined;

                        try {
                            const embeddings = await apiService.generateEmbeddings([documentName]);
                            if (embeddings && embeddings.length > 0) {
                                nameEmbedding = embeddings[0];
                            }
                        } catch (e) {
                            console.error("Failed to generate embedding for document name:", e);
                        }

                        // Update document in DB with title (filename) and summary
                        await dbService.updateDocumentTitleAndSummary(docId, documentName, summary, nameEmbedding);

                        // Instantly update the UI name
                        updateJob(docId, { filename: documentName });

                        // Only generate once
                        firstPagesText.length = 0;
                    } catch (e) {
                        console.error("Failed to generate PDF summary:", e);
                    }
                }

                // 4. AI Extraction
                if (text) {
                    try {
                        let previousTablesParams = undefined;
                        if (i > 1) {
                            try {
                                const rawPreviousTables = await dbService.getPdfTablesByPage(docId, i - 1);
                                if (rawPreviousTables && rawPreviousTables.length > 0) {
                                    previousTablesParams = rawPreviousTables.map(t => ({
                                        table_name: t.table_name,
                                        schema_fields: t.schema_json
                                    }));
                                }
                            } catch (e) {
                                console.error("Failed to fetch previous page tables:", e);
                            }
                        }

                        const { tables, debug_info } = await apiService.extractTables(text, previousTablesParams);

                        if (debug_info) {
                            const currentJob = get().jobs[docId];
                            updateJob(docId, {
                                debugInfo: {
                                    ...(currentJob.debugInfo || {}),
                                    [i]: {
                                        ocrText: debug_info.ocr_text,
                                        prompt: debug_info.prompt_sent,
                                        rawResponse: debug_info.raw_response
                                    }
                                }
                            });
                        }
                        console.log(`Extracted ${tables.length} tables from page ${i}`);
                        if (tables.length > 0) {
                            // First, we need to process the tables to see which are new and which are continuations
                            // Fetch ALL currently saved tables for this document to check for continuations
                            const existingDocTables = await dbService.getPdfTables(docId);
                            const newTablesToSave = [];

                            for (const table of tables) {
                                // Check if this table already exists (is a continuation)
                                const existingTable = existingDocTables.find(t => t.table_name === table.table_name);

                                if (existingTable) {
                                    console.log(`Found continuation for table: ${table.table_name}`);

                                    // 1. Check if we need to update the schema or notes of the existing table based on bottom-page context
                                    let needsUpdate = false;
                                    let newNotes = existingTable.notes;
                                    let newSchema = existingTable.schema_json;
                                    // Because it was JSON.stringified in db, it comes out as parsed array depending on PGlite driver. 
                                    // Assume it's parsed, if it's string we'd parse it. But dbService saves it as JSON string, PGlite JSONb returns object.

                                    if (table.updated_notes && table.updated_notes !== existingTable.notes) {
                                        newNotes = table.updated_notes;
                                        needsUpdate = true;
                                    } else if (table.notes && table.notes !== existingTable.notes && table.notes.trim() !== "") {
                                        // Fallback: AI sometimes ignores `updated_notes` and just populates `notes`
                                        // with the new information found on the current page.
                                        const oldStr = (existingTable.notes || "").trim();
                                        const newStr = table.notes.trim();

                                        if (newStr.length > oldStr.length + 10) {
                                            newNotes = newStr; // Assume it's a completely better rewritten note
                                            needsUpdate = true;
                                        } else if (newStr.length > 3 && !oldStr.includes(newStr)) {
                                            // If it contains new small info (like an abbreviation key), concatenate them
                                            newNotes = oldStr ? `${oldStr} | ${newStr}` : newStr;
                                            needsUpdate = true;
                                        }
                                    }

                                    if (table.updated_schema_fields) {
                                        newSchema = table.updated_schema_fields;
                                        needsUpdate = true;
                                    }

                                    let newSummaryEmbedding: number[] | undefined;

                                    if (needsUpdate) {
                                        console.log(`Updating schema/notes for continued table: ${table.table_name}`);

                                        // Regenerate table embedding if notes changed to ensure Top-Down RAG works
                                        if (newNotes !== existingTable.notes) {
                                            try {
                                                const searchString = `${existingTable.summary || table.summary || ""}\nNotes: ${newNotes}`;
                                                const embeddings = await apiService.generateEmbeddings([searchString]);
                                                if (embeddings && embeddings.length > 0) {
                                                    newSummaryEmbedding = embeddings[0];
                                                }
                                            } catch (e) {
                                                console.error("Failed to regenerate table summary embedding", e);
                                            }
                                        }

                                        await dbService.updatePdfTableSchemaAndNotes(
                                            existingTable.id,
                                            newSchema,
                                            newNotes,
                                            newSummaryEmbedding
                                        );
                                    }

                                    // 2. Generate embeddings for the chunks of this continued table
                                    try {
                                        const chunkTextsToEmbed = (table.chunks || []).map((c: any) => c.text_summary || "");
                                        if (chunkTextsToEmbed.length > 0) {
                                            const embeddings = await apiService.generateEmbeddings(chunkTextsToEmbed);
                                            for (let j = 0; j < table.chunks.length; j++) {
                                                table.chunks[j].summary_embedding = embeddings[j];
                                            }
                                        }
                                    } catch (e) {
                                        console.error("Failed to generate chunk embeddings for continued table.", e);
                                    }

                                    // 3. Insert the new chunks linking back to the EXISTING table ID
                                    if (table.chunks && table.chunks.length > 0) {
                                        await dbService.saveChunks(existingTable.id, docId, table.chunks, i);
                                    }

                                } else {
                                    // It's a brand new table
                                    console.log(`Found NEW table: ${table.table_name}`);

                                    // Use updated schema/notes if provided even on first page (unlikely, but safest)
                                    if (table.updated_schema_fields) table.schema_fields = table.updated_schema_fields;
                                    if (table.updated_notes) table.notes = table.updated_notes;

                                    newTablesToSave.push(table);
                                }
                            }

                            // Now generate embeddings and save only the TRULY new tables
                            if (newTablesToSave.length > 0) {
                                try {
                                    const textsToEmbed: string[] = [];

                                    // Collect all texts
                                    for (const table of newTablesToSave) {
                                        const summaryText = table.summary || "";
                                        const notesText = table.notes ? `\nNotes: ${table.notes}` : "";
                                        textsToEmbed.push(summaryText + notesText);

                                        for (const chunk of table.chunks || []) {
                                            textsToEmbed.push(chunk.text_summary || "");
                                        }
                                    }

                                    if (textsToEmbed.length > 0) {
                                        console.log(`Generating embeddings for ${textsToEmbed.length} items (New Tables)...`);
                                        const embeddings = await apiService.generateEmbeddings(textsToEmbed);

                                        // Map embeddings back to objects
                                        let embIndex = 0;
                                        for (const table of newTablesToSave) {
                                            table.summary_embedding = embeddings[embIndex++];
                                            for (const chunk of table.chunks || []) {
                                                chunk.summary_embedding = embeddings[embIndex++];
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.error("Failed to generate embeddings. Proceeding without them.", e);
                                }

                                await dbService.saveExtractedData(newTablesToSave, docId, i);

                                // Increment totalTables state ONLY for new tables
                                set((state) => ({ totalTables: state.totalTables + newTablesToSave.length }));
                            }
                        }
                    } catch (e) {
                        console.error("AI Extraction failed:", e);
                    }
                }

                updateJob(docId, { processedPages: i });

                // Update DB on EVERY page exactly, to support resuming instantly if tab closed
                dbService.updateDocumentStatus(docId, 'processing', i);
            }

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

