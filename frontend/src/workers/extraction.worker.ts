import * as Comlink from "comlink";
import * as pdfjsLib from "pdfjs-dist";
import { apiService } from "../services/api-service";

// Import worker code as raw string to avoid path/loading issues
import pdfWorkerCode from 'pdfjs-dist/build/pdf.worker.min.mjs?raw';

// Create a Blob URL for the worker
const blob = new Blob([pdfWorkerCode], { type: 'application/javascript' });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);

// Defines a factory for creating canvases in a Web Worker environment
class OffscreenCanvasFactory {
    create(width: number, height: number) {
        if (width <= 0 || height <= 0) {
            throw new Error("Invalid canvas size");
        }
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext("2d");
        return {
            canvas,
            context,
        };
    }

    reset(canvasAndContext: { canvas: OffscreenCanvas | null; context: OffscreenCanvasRenderingContext2D | null }, width: number, height: number) {
        if (!canvasAndContext.canvas) {
            throw new Error("Canvas is not specified");
        }
        if (width <= 0 || height <= 0) {
            throw new Error("Invalid canvas size");
        }
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: { canvas: OffscreenCanvas | null; context: OffscreenCanvasRenderingContext2D | null }) {
        if (!canvasAndContext.canvas) {
            throw new Error("Canvas is not specified");
        }
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

// Helper: Convert Blob to base64 string
async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            const base64Data = base64.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

const api = {
    async processPdf(
        file: File,
        documentId: string,
        startPage: number = 1,
        cb?: (progress: { total: number, current: number, status: string, text?: string }) => Promise<boolean>
    ) {
        console.log(`Starting processing for doc ${documentId} from page ${startPage}`);

        const arrayBuffer = await file.arrayBuffer();

        // Use disableFontFace to force canvas rendering and avoid font loading issues
        const standardFontDataUrl = `${self.location.origin}/standard_fonts/`;

        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            canvasFactory: new OffscreenCanvasFactory(),
            standardFontDataUrl,
            disableFontFace: true
        } as any).promise;

        console.log(`PDF loaded. Pages: ${pdf.numPages}`);

        if (cb) {
            const continueProcessing = await cb({ total: pdf.numPages, current: startPage - 1, status: 'started' });
            if (!continueProcessing) return { success: false, stoppedAt: startPage - 1 };
        }

        for (let i = startPage; i <= pdf.numPages; i++) {
            if (cb) {
                const shouldContinue = await cb({ total: pdf.numPages, current: i - 1, status: 'processing' });
                if (!shouldContinue) {
                    return { success: false, stoppedAt: i - 1 };
                }
            }

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = new OffscreenCanvas(viewport.width, viewport.height);
            const context = canvas.getContext("2d");
            if (!context) continue;

            await page.render({
                canvasContext: context as any,
                viewport,
                canvasFactory: new OffscreenCanvasFactory()
            } as any).promise;

            const blob = await canvas.convertToBlob();

            // Vision OCR via backend API
            const base64Image = await blobToBase64(blob);
            const { text } = await apiService.visionOcr(base64Image);
            console.log(`Page ${i} text extracted`);

            if (cb) {
                const shouldContinue = await cb({
                    total: pdf.numPages,
                    current: i,
                    status: 'processing',
                    text: text
                });
                if (!shouldContinue) {
                    return { success: false, stoppedAt: i };
                }
            }
        }

        if (cb) await cb({ total: pdf.numPages, current: pdf.numPages, status: 'completed' });
        return { success: true, pages: pdf.numPages };
    },

    async testPage(file: File, pageNum: number) {
        const arrayBuffer = await file.arrayBuffer();
        const standardFontDataUrl = `${self.location.origin}/standard_fonts/`;

        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            canvasFactory: new OffscreenCanvasFactory(),
            standardFontDataUrl,
            disableFontFace: true
        } as any).promise;

        if (pageNum < 1 || pageNum > pdf.numPages) {
            throw new Error(`Invalid page number: ${pageNum}`);
        }

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = new OffscreenCanvas(viewport.width, viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create canvas context");

        await page.render({
            canvasContext: context as any,
            viewport,
            canvasFactory: new OffscreenCanvasFactory()
        } as any).promise;

        const blob = await canvas.convertToBlob();

        // Vision OCR via backend API
        const base64Image = await blobToBase64(blob);
        const { text } = await apiService.visionOcr(base64Image);

        return { text, imageBlob: blob };
    },

    async renderPage(file: File, pageNum: number) {
        const arrayBuffer = await file.arrayBuffer();
        const standardFontDataUrl = `${self.location.origin}/standard_fonts/`;

        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            canvasFactory: new OffscreenCanvasFactory(),
            standardFontDataUrl,
            disableFontFace: true
        } as any).promise;

        if (pageNum < 1 || pageNum > pdf.numPages) {
            throw new Error(`Invalid page number: ${pageNum}`);
        }

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = new OffscreenCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Could not create canvas context");

        await page.render({
            canvasContext: context as any,
            viewport,
            canvasFactory: new OffscreenCanvasFactory()
        } as any).promise;

        const blob = await canvas.convertToBlob();
        return { imageBlob: blob };
    },

    async extractPdfText(file: File, pageNum: number) {
        const arrayBuffer = await file.arrayBuffer();
        const standardFontDataUrl = `${self.location.origin}/standard_fonts/`;

        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            canvasFactory: new OffscreenCanvasFactory(),
            standardFontDataUrl,
            disableFontFace: true
        } as any).promise;

        if (pageNum < 1 || pageNum > pdf.numPages) {
            throw new Error(`Invalid page number: ${pageNum}`);
        }

        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine all text items into a single string
        const text = textContent.items
            .map((item: any) => item.str)
            .join(' ');

        return { text };
    }
};

export type ExtractionWorkerApi = typeof api;
Comlink.expose(api);
