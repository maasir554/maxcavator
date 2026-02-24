import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, ChevronLeft, ChevronRight, FileText, Bot, Eye, ScanEye, Play, Code, BookOpen } from "lucide-react"
import { useExtractionStore } from "@/store/extraction-store"
import { renderPdfPageMainThread } from "@/services/pdf-renderer"
import { apiService } from "@/services/api-service"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface PdfInspectionModalProps {
    docId: string;
    iconOnly?: boolean;
}

export function PdfInspectionModal({ docId, iconOnly }: PdfInspectionModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("1");
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrViewMode, setOcrViewMode] = useState<'raw' | 'markdown'>('raw');

    const [pageImage, setPageImage] = useState<string | null>(null);
    const [ocrText, setOcrText] = useState<string>("");
    const [pdfText, setPdfText] = useState<string>("");
    const [pdfTextLoading, setPdfTextLoading] = useState(false);
    const [aiResult, setAiResult] = useState<string>("");
    const [aiLoading, setAiLoading] = useState(false);

    const extractPdfText = useExtractionStore(state => state.extractPdfText);
    const testAi = useExtractionStore(state => state.testAi);
    const jobs = useExtractionStore(state => state.jobs);

    // Auto-load page image when opening or changing pages
    useEffect(() => {
        if (!isOpen) return;

        // Reset state
        setPageImage(null);
        setOcrText("");
        setPdfText("");
        setAiResult("");

        // Auto-load page image using main-thread renderer (supports embedded fonts)
        const loadPageImage = async () => {
            try {
                const job = jobs[docId];
                if (!job?.file) return;
                const { imageBlob } = await renderPdfPageMainThread(job.file, currentPage);
                const url = URL.createObjectURL(imageBlob);
                setPageImage(url);
            } catch (e) {
                console.error("Auto-load page image failed", e);
            }
        };

        loadPageImage();
    }, [isOpen, currentPage, docId, jobs]);

    // Sync page input with current page
    useEffect(() => {
        setPageInput(currentPage.toString());
    }, [currentPage]);

    const handleRunOcr = async () => {
        setOcrLoading(true);
        try {
            const job = jobs[docId];
            if (!job?.file) throw new Error("PDF file not found");

            // Render on main thread (proper font support)
            const { imageBlob } = await renderPdfPageMainThread(job.file, currentPage);

            // Update page image if not loaded yet
            if (!pageImage) {
                const url = URL.createObjectURL(imageBlob);
                setPageImage(url);
            }

            // Convert to base64 and send to Vision OCR API
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
            });

            const { text } = await apiService.visionOcr(base64);
            setOcrText(text);
        } catch (e) {
            console.error("Test page failed", e);
            setOcrText("Error: " + (e as Error).message);
        } finally {
            setOcrLoading(false);
        }
    };

    const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPageInput(e.target.value);
    };

    const handlePageInputSubmit = () => {
        const pageNum = parseInt(pageInput);
        if (!isNaN(pageNum) && pageNum >= 1) {
            setCurrentPage(pageNum);
        } else {
            setPageInput(currentPage.toString());
        }
    };

    const handleRunAi = async () => {
        if (!ocrText) return;
        setAiLoading(true);
        try {
            const { tables, debug_info } = await testAi(ocrText);
            setAiResult(JSON.stringify({ tables, debug_info }, null, 2));
        } catch (e) {
            console.error("Test AI failed", e);
            setAiResult("Error: " + (e as Error).message);
        } finally {
            setAiLoading(false);
        }
    }

    const handleExtractPdfText = async () => {
        setPdfTextLoading(true);
        try {
            const { text } = await extractPdfText(docId, currentPage);
            setPdfText(text);
        } catch (e) {
            console.error("PDF text extraction failed", e);
            setPdfText("Error: " + (e as Error).message);
        } finally {
            setPdfTextLoading(false);
        }
    }

    // Estimate pages? We don't know total pages until we process or load pdf.
    // For manual inspection, we can just let them keep going next until error?
    // Or we can load the PDF info first. 
    // The worker `processPdf` returns page count.
    // `testPage` also returns nothing about total pages currently.
    // Let's just assume we can go next.

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {iconOnly ? (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <ScanEye className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="gap-2">
                        <ScanEye className="h-4 w-4" /> Inspect
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="!max-w-[95vw] w-full h-[90vh] flex flex-col p-6">
                <DialogHeader className="mb-2">
                    <DialogTitle className="flex justify-between items-center">
                        <span>Inspect Document</span>
                        <div className="flex items-center gap-2 text-sm mr-8">
                            <Button
                                variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage <= 1 || ocrLoading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <input
                                type="number"
                                value={pageInput}
                                onChange={handlePageInputChange}
                                onKeyDown={(e) => e.key === 'Enter' && handlePageInputSubmit()}
                                onBlur={handlePageInputSubmit}
                                className="w-16 h-8 text-center border rounded px-2 text-sm"
                                min="1"
                            />
                            <Button
                                variant="outline" size="icon" className="h-8 w-8"
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={ocrLoading}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogTitle>
                    <DialogDescription>
                        Analyze PDF pages individually before starting full extraction.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
                    {/* Left Pane: Page Image */}
                    <div className="flex flex-col border rounded-lg bg-muted/20 overflow-hidden">
                        <div className="p-2 border-b bg-muted/40 flex justify-between items-center">
                            <span className="text-sm font-medium flex items-center gap-2">
                                <Eye className="h-4 w-4" /> Page View
                            </span>
                        </div>
                        <div className="flex-1 relative overflow-auto bg-zinc-100 dark:bg-zinc-900 p-4">
                            {!pageImage && ocrLoading ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : pageImage ? (
                                <div className="flex justify-center">
                                    <img src={pageImage} alt={`Page ${currentPage}`} className="shadow-lg" />
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-muted-foreground text-sm p-8 text-center">
                                        Click "Load Page" to render this page.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Pane: Results */}
                    <div className="flex flex-col border rounded-lg overflow-hidden" style={{ height: 'calc(90vh - 120px)' }}>
                        <Tabs defaultValue="pdf-text" className="flex-1 flex flex-col min-h-0">
                            <TabsList className="w-full justify-start rounded-none border-b bg-muted/40 p-0 h-10">
                                <TabsTrigger value="pdf-text" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background h-10 px-4">
                                    <FileText className="h-4 w-4 mr-2" /> PDF Text
                                </TabsTrigger>
                                <TabsTrigger value="ocr" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background h-10 px-4">
                                    <FileText className="h-4 w-4 mr-2" /> Vision OCR
                                </TabsTrigger>
                                <TabsTrigger value="ai" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background h-10 px-4">
                                    <Bot className="h-4 w-4 mr-2" /> AI Extraction
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="pdf-text" className="flex-1 m-0 p-0 min-h-0 flex flex-col">
                                <div className="p-2 border-b bg-muted/40 flex justify-end">
                                    <Button size="sm" onClick={handleExtractPdfText} disabled={pdfTextLoading}>
                                        {pdfTextLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <FileText className="h-3 w-3 mr-2" />}
                                        Extract PDF Text
                                    </Button>
                                </div>
                                <ScrollArea className="flex-1" style={{ height: 'calc(90vh - 280px)' }}>
                                    <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed p-4">
                                        {pdfText || (pdfTextLoading ? "Extracting text from PDF..." : "Click 'Extract PDF Text' to get embedded text from the PDF.")}
                                    </pre>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="ocr" className="flex-1 m-0 p-0 min-h-0 flex flex-col">
                                <div className="p-2 border-b bg-muted/10 flex justify-between items-center">
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant={ocrViewMode === 'raw' ? 'default' : 'outline'}
                                            onClick={() => setOcrViewMode('raw')}
                                        >
                                            <Code className="h-3 w-3 mr-2" />
                                            Raw Text
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={ocrViewMode === 'markdown' ? 'default' : 'outline'}
                                            onClick={() => setOcrViewMode('markdown')}
                                        >
                                            <BookOpen className="h-3 w-3 mr-2" />
                                            Markdown
                                        </Button>
                                    </div>
                                    <Button size="sm" onClick={handleRunOcr} disabled={ocrLoading}>
                                        {ocrLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Play className="h-3 w-3 mr-2" />}
                                        Run Vision OCR
                                    </Button>
                                </div>
                                <ScrollArea className="flex-1" style={{ height: 'calc(90vh - 280px)' }}>
                                    {ocrViewMode === 'raw' ? (
                                        <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed p-4">
                                            {ocrText || (ocrLoading ? "Extracting text..." : "Click 'Run Vision OCR' to extract text.")}
                                        </pre>
                                    ) : (
                                        <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                                            {ocrText ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{ocrText}</ReactMarkdown>
                                            ) : (
                                                <p className="text-muted-foreground text-sm">
                                                    {ocrLoading ? "Extracting text..." : "Click 'Run Vision OCR' to extract text."}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="ai" className="flex-1 m-0 p-0 min-h-0 relative flex flex-col">
                                <div className="p-2 border-b bg-muted/10 flex justify-end">
                                    <Button size="sm" onClick={handleRunAi} disabled={!ocrText || aiLoading}>
                                        {aiLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Bot className="h-3 w-3 mr-2" />}
                                        Test AI Response
                                    </Button>
                                </div>
                                <ScrollArea className="flex-1" style={{ height: 'calc(90vh - 280px)' }}>
                                    <pre className="text-xs font-mono whitespace-pre-wrap text-green-600 dark:text-green-400 p-4">
                                        {aiResult || "Run AI to see the response JSON."}
                                    </pre>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
