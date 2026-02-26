import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"

import { FileText, Database, LayoutList, Eye, Table2 } from "lucide-react"
import { useExtractionStore } from "@/store/extraction-store"
import { dbService } from "@/services/db-service"
import { renderPdfPageMainThread } from "@/services/pdf-renderer"

interface DocumentViewerModalProps {
    docId: string;
    iconOnly?: boolean;
    initialPage?: number;
    children?: React.ReactNode;
}

// Sub-component to handle IntersectionObserver and lazy rendering per page
function PdfPageRenderer({ file, pageNum, isActive, onVisible }: { file: File, pageNum: number, isActive: boolean, onVisible: (p: number) => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isIntersecting, setIsIntersecting] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setIsIntersecting(true);
                    // If more than 50% is visible, mark as the active page
                    if (entry.intersectionRatio > 0.5) {
                        onVisible(pageNum);
                    }
                }
            });
        }, {
            threshold: [0.1, 0.5] // trigger when 10% visible (to start load) and 50% visible (to set active)
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [pageNum, onVisible]);

    useEffect(() => {
        if (isIntersecting && !imageSrc) {
            let isMounted = true;
            renderPdfPageMainThread(file, pageNum, 1.5)
                .then(({ imageBlob }) => {
                    if (isMounted) {
                        setImageSrc(URL.createObjectURL(imageBlob));
                    }
                })
                .catch(console.error);

            return () => { isMounted = false; };
        }
    }, [isIntersecting, file, pageNum, imageSrc]);

    return (
        <div
            ref={containerRef}
            className={`relative mb-8 shadow-md border rounded-md min-h-[800px] w-full bg-white flex items-center justify-center transition-all duration-300 ${isActive ? 'ring-4 ring-primary ring-opacity-50' : ''}`}
            id={`pdf-page-${pageNum}`}
        >
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                Page {pageNum}
            </div>
            {imageSrc ? (
                <img src={imageSrc} alt={`Page ${pageNum}`} className="max-w-full h-auto rounded-sm" />
            ) : (
                <div className="text-muted-foreground animate-pulse">Rendering...</div>
            )}
        </div>
    )
}

export function DocumentViewerModal({ docId, iconOnly, initialPage, children }: DocumentViewerModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activePage, setActivePage] = useState<number>(initialPage || 1);

    const [tables, setTables] = useState<any[]>([]);
    const [chunks, setChunks] = useState<any[]>([]);
    const [isPageChanging, setIsPageChanging] = useState(false);

    const jobs = useExtractionStore(state => state.jobs);
    const job = jobs[docId];

    // Auto-scroll when modal opens and initialPage is passed
    useEffect(() => {
        if (isOpen && initialPage && job) {
            setActivePage(initialPage);
            // Give the DOM a moment to render the placeholders and the Dialog animation to settle
            setTimeout(() => {
                const element = document.getElementById(`pdf-page-${initialPage}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'auto', block: 'start' });
                }
            }, 400);
        }
    }, [isOpen, initialPage, job]);

    useEffect(() => {
        if (isOpen && docId) {
            loadDocumentData();
        }
    }, [isOpen, docId]);

    const loadDocumentData = async () => {
        try {
            const fetchedTables = await dbService.getPdfTables(docId);
            const fetchedChunks = await dbService.getAllChunks(docId);
            setTables(fetchedTables);
            setChunks(fetchedChunks);
        } catch (error) {
            console.error("Failed to load document data:", error);
        }
    };

    useEffect(() => {
        setIsPageChanging(true);
        const timer = setTimeout(() => setIsPageChanging(false), 800);
        return () => clearTimeout(timer);
    }, [activePage]);

    if (!job) return null;

    // Filter data for the currently viewed page
    const activeTables = tables.filter(t => t.page_number === activePage);
    const activeChunks = chunks.filter(c => c.page_number === activePage);

    // Create an array [1, 2, ..., totalPages]
    const pages = Array.from({ length: job.totalPages || 1 }, (_, i) => i + 1);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children ? children : (iconOnly ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary hover:bg-primary/10" title="Inspect Document Details">
                        <Eye className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="gap-2 h-8 w-8 px-0 sm:h-9 sm:px-3 sm:w-auto">
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Explore</span>
                    </Button>
                ))}
            </DialogTrigger>
            <DialogContent
                className="max-w-[95vw] sm:max-w-[95vw] w-full h-[95vh] flex flex-col p-0 overflow-hidden bg-background"
                onPointerDownOutside={(e) => {
                    const originalEvent = e.detail.originalEvent;
                    const target = originalEvent.target as HTMLElement;
                    if (
                        target.closest('[data-panel-group]') ||
                        target.closest('[data-separator]') ||
                        target.closest('[data-slot="resizable-handle"]')
                    ) {
                        e.preventDefault();
                    }
                }}
            >
                <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            {job.filename}
                        </DialogTitle>
                        <DialogDescription>
                            Continuous Page Viewer
                        </DialogDescription>
                    </div>
                    <div className="text-sm border px-3 py-1 rounded-md bg-muted/30">
                        Total Pages: <span className="font-semibold">{job.totalPages}</span>
                    </div>
                </DialogHeader>

                <ResizablePanelGroup orientation="horizontal" className="flex-1 items-stretch">
                    {/* Left Pane: Continuous PDF Read */}
                    <ResizablePanel defaultSize={70} minSize={30}>
                        <div className="h-full overflow-y-auto bg-muted/20 p-6 relative" id="pdf-scroll-container">
                            {job.file ? (
                                <div className="max-w-4xl mx-auto flex flex-col items-stretch">
                                    {pages.map(pageNum => (
                                        <PdfPageRenderer
                                            key={pageNum}
                                            file={job.file!}
                                            pageNum={pageNum}
                                            isActive={activePage === pageNum}
                                            onVisible={(p) => setActivePage(p)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    Source PDF file is not available in memory.
                                </div>
                            )}
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Right Pane: Context Sidebar */}
                    <ResizablePanel defaultSize={30} minSize={20}>
                        <div className={`h-full flex flex-col bg-card border-l transition-all duration-700 ${isPageChanging ? 'shadow-[inset_0_0_30px_rgba(59,130,246,0.25)] bg-blue-500/10' : ''}`}>
                            <div className="p-4 border-b bg-primary/5 shrink-0">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">
                                        {activePage}
                                    </span>
                                    Page Context
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Showing semantic data extracted from this page.
                                </p>
                            </div>

                            <div className="flex-1 relative min-h-0">
                                <div className="absolute inset-0 overflow-y-auto p-4">
                                    {activeTables.length === 0 && activeChunks.length === 0 ? (
                                        <div className="text-center text-muted-foreground text-sm py-12 border border-dashed rounded-lg bg-muted/10">
                                            No tables or structured data extracted on this page.
                                        </div>
                                    ) : (
                                        <div className="space-y-6 pb-8">
                                            {/* Summarize the tables found */}
                                            {activeTables.length > 0 && (
                                                <div className="space-y-4">
                                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                        <Database className="h-4 w-4" /> Detected Tables ({activeTables.length})
                                                    </h4>
                                                    {activeTables.map(table => (
                                                        <div key={table.id} className="border rounded-lg p-3 shadow-sm bg-background">
                                                            <h5 className="font-medium text-primary flex items-center gap-1 mb-1">
                                                                <Table2 className="h-3 w-3" /> {table.table_name}
                                                            </h5>
                                                            <p className="text-xs text-muted-foreground line-clamp-2">{table.summary}</p>
                                                            {table.notes && (
                                                                <div className="mt-2 text-xs bg-blue-500/10 text-blue-600 p-2 rounded">
                                                                    {table.notes}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Data Chunks / Rows */}
                                            {activeChunks.length > 0 && (
                                                <div className="space-y-4">
                                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                                        <LayoutList className="h-4 w-4" /> Raw Data Rows ({activeChunks.length})
                                                    </h4>
                                                    {activeChunks.map(chunk => {
                                                        const parentTable = tables.find(t => t.id === chunk.pdf_table_id);
                                                        return (
                                                            <div key={chunk.id} className="border rounded-lg p-3 bg-muted/10 text-xs">
                                                                <div className="flex justify-between items-center mb-2 border-b pb-1">
                                                                    <span className="font-semibold text-muted-foreground truncate pr-2">
                                                                        {parentTable ? parentTable.table_name : 'Unknown Table'}
                                                                    </span>
                                                                </div>
                                                                {chunk.text_summary && (
                                                                    <div className="mb-2 text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-md leading-relaxed border border-muted">
                                                                        <span className="font-semibold text-primary/70 mr-1">Summary:</span>
                                                                        {chunk.text_summary}
                                                                    </div>
                                                                )}
                                                                <pre className="whitespace-pre-wrap font-mono text-foreground/80 overflow-x-auto bg-background p-2 rounded border">
                                                                    {JSON.stringify(chunk.data, null, 2)}
                                                                </pre>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </DialogContent>
        </Dialog >
    )
}
