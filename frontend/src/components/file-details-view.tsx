import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Database, FileText, LayoutList, ExternalLink, Code, ArrowLeft, Table2, ChevronRight, MoreVertical, Trash } from "lucide-react"
import { useExtractionStore } from '@/store/extraction-store'
import { dbService } from '@/services/db-service'
import { DocumentViewerModal } from "./document-viewer-modal"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FileDetailsViewProps {
    documentId: string;
    onBack: () => void;
}

export function FileDetailsView({ documentId, onBack }: FileDetailsViewProps) {
    const jobs = useExtractionStore(state => state.jobs);
    const job = jobs[documentId];

    const [tables, setTables] = useState<any[]>([]);
    const [chunks, setChunks] = useState<any[]>([]);
    const [dbDoc, setDbDoc] = useState<any>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [isScrolledTop, setIsScrolledTop] = useState({ tables: true, details: true });

    const trashJob = useExtractionStore(state => state.trashJob);

    useEffect(() => {
        if (documentId) {
            loadDocumentData();
        }
    }, [documentId]);

    const loadDocumentData = async () => {
        setIsLoadingData(true);
        try {
            const fetchedDoc = await dbService.getDocument(documentId);
            const fetchedTables = await dbService.getPdfTables(documentId);
            const fetchedChunks = await dbService.getAllChunks(documentId);
            setDbDoc(fetchedDoc);
            setTables(fetchedTables);
            setChunks(fetchedChunks);
        } catch (error) {
            console.error("Failed to load document data:", error);
        } finally {
            setIsLoadingData(false);
        }
    };

    if (!job) return null;

    const isScrolled = selectedTableId ? !isScrolledTop.details : !isScrolledTop.tables;

    return (
        <div className="flex-1 flex flex-col min-h-0 fade-in fill-mode-forwards animate-in">
            {/* Header / Navigation Bar */}
            <div className={`flex items-start justify-between border-b shrink-0 transition-all duration-300 ${isScrolled ? 'pb-2 mb-2' : 'pb-4 mb-4'}`}>
                <div className="flex flex-col flex-1 min-w-0 justify-center">

                    {/* Top Row: Back Button (Only visible when NOT scrolled) */}
                    <div className={`transition-all duration-300 overflow-hidden ${isScrolled ? 'opacity-0 max-h-0 m-0' : 'opacity-100 max-h-12 mb-1'}`}>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={selectedTableId ? () => setSelectedTableId(null) : onBack}
                            className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            {selectedTableId ? "Back to tables map" : "Back to Overview"}
                        </Button>
                    </div>

                    {/* Middle Row: Title (With Side Back Button when scrolled) */}
                    <div className="flex items-center gap-2">
                        <div className={`transition-all duration-300 overflow-hidden flex items-center ${isScrolled ? 'opacity-100 max-w-[40px] mr-0' : 'opacity-0 max-w-0 mr-0'}`}>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={selectedTableId ? () => setSelectedTableId(null) : onBack}
                                className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground shrink-0"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </div>
                        <FileText className={`text-muted-foreground shrink-0 transition-all duration-300 ${isScrolled ? 'h-5 w-5' : 'h-6 w-6'}`} />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="min-w-0 max-w-full cursor-default">
                                    <h2 className={`font-semibold truncate transition-all duration-300 ${isScrolled ? 'text-lg' : 'text-2xl'}`}>
                                        {job.filename}
                                    </h2>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="max-w-[400px] break-all">
                                <p>{job.filename}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Bottom Row: Metadata (Hidden when scrolled) */}
                    <div className={`flex items-center gap-3 text-sm text-muted-foreground transition-all duration-300 overflow-hidden ${isScrolled ? 'max-h-0 opacity-0 m-0' : 'max-h-10 opacity-100 mt-2'}`}>
                        <span className={`capitalize font-medium shrink-0 ${job.status === 'completed' ? 'text-green-500' : job.status === 'error' ? 'text-red-500' : 'text-blue-500'}`}>
                            Status: {job.status}
                        </span>
                        <span className="shrink-0">•</span>
                        <span className="shrink-0">{job.processedPages} / {job.totalPages || 1} pages</span>
                        {dbDoc && dbDoc.source_url && (
                            <>
                                <span className="shrink-0">•</span>
                                <a href={dbDoc.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline text-blue-500 truncate">
                                    Source <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                            </>
                        )}
                        <span className="shrink-0">•</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={() => {
                                        trashJob(documentId);
                                        onBack();
                                    }}
                                >
                                    <Trash className="mr-2 h-4 w-4" />
                                    Move to Trash
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Right Actions */}
                <div className={`transition-all duration-300 ml-4 shrink-0 flex items-center ${isScrolled ? 'mt-1' : 'mt-8'}`}>
                    {job.file && (
                        <DocumentViewerModal docId={job.documentId} />
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 min-h-0 flex flex-col fade-in">
                {isLoadingData ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Loading document data...
                    </div>
                ) : !selectedTableId ? (
                    /* Level 1: List of Tables */
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="mb-4 flex items-center gap-2 text-lg font-semibold shrink-0">
                            <Table2 className="h-5 w-5 text-primary" />
                            Extracted Tables
                            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                                {tables.length}
                            </span>
                        </div>

                        <div
                            onScroll={(e) => {
                                const scrollTop = e.currentTarget.scrollTop;
                                setIsScrolledTop(prev => ({ ...prev, tables: scrollTop <= 10 }));
                            }}
                            className="flex-1 overflow-y-auto pr-4 pt-4 pb-20 min-h-0 transition-all duration-300"
                            style={{
                                maskImage: isScrolledTop.tables
                                    ? 'linear-gradient(to bottom, black 0%, black calc(100% - 48px), transparent 100%)'
                                    : 'linear-gradient(to bottom, transparent 0%, black 32px, black calc(100% - 48px), transparent 100%)',
                                WebkitMaskImage: isScrolledTop.tables
                                    ? 'linear-gradient(to bottom, black 0%, black calc(100% - 48px), transparent 100%)'
                                    : 'linear-gradient(to bottom, transparent 0%, black 32px, black calc(100% - 48px), transparent 100%)'
                            }}
                        >
                            {tables.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground py-12 border rounded-lg bg-muted/10">
                                    No tables extracted yet.
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {tables.map(table => {
                                        const chunkCount = chunks.filter(c => c.pdf_table_id === table.id).length;
                                        return (
                                            <div
                                                key={table.id}
                                                onClick={() => setSelectedTableId(table.id)}
                                                className="group border rounded-lg p-4 bg-card hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer flex flex-col min-w-0"
                                            >
                                                <div className="flex items-start justify-between mb-2 min-w-0">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="min-w-0 max-w-full cursor-default">
                                                                <h3 className="font-semibold text-base flex items-center gap-2 group-hover:text-primary transition-colors truncate pr-2">
                                                                    <Database className="h-4 w-4 shrink-0" />
                                                                    <span className="truncate">{table.table_name}</span>
                                                                </h3>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom" align="start" className="max-w-xs break-all">
                                                            <p>{table.table_name}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                                                    {table.summary || "No summary available."}
                                                </p>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-3 border-t">
                                                    <span className="flex items-center gap-1">
                                                        <LayoutList className="h-3 w-3" /> {chunkCount} rows
                                                    </span>
                                                    <span>•</span>
                                                    <span className="bg-muted px-1.5 py-0.5 rounded">Page {table.page_number}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Level 2: Specific Table Details */
                    <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 fade-in duration-200">
                        <div className="flex-1 flex flex-col bg-card border rounded-lg shadow-sm min-h-0 overflow-hidden">
                            <div
                                onScroll={(e) => {
                                    const scrollTop = e.currentTarget.scrollTop;
                                    setIsScrolledTop(prev => ({ ...prev, details: scrollTop <= 10 }));
                                }}
                                className="flex-1 overflow-y-auto min-h-0 pt-4 pb-20 transition-all duration-300"
                                style={{
                                    maskImage: isScrolledTop.details
                                        ? 'linear-gradient(to bottom, black 0%, black calc(100% - 48px), transparent 100%)'
                                        : 'linear-gradient(to bottom, transparent 0%, black 32px, black calc(100% - 48px), transparent 100%)',
                                    WebkitMaskImage: isScrolledTop.details
                                        ? 'linear-gradient(to bottom, black 0%, black calc(100% - 48px), transparent 100%)'
                                        : 'linear-gradient(to bottom, transparent 0%, black 32px, black calc(100% - 48px), transparent 100%)'
                                }}
                            >
                                {(() => {
                                    const table = tables.find(t => t.id === selectedTableId);
                                    const tableChunks = chunks.filter(c => c.pdf_table_id === selectedTableId);
                                    if (!table) return null;

                                    return (
                                        <div className="p-6 max-w-5xl mx-auto space-y-8">
                                            {/* Table Header */}
                                            <div className="border-b pb-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-2xl font-bold flex items-center gap-2">
                                                        <Database className="h-6 w-6 text-primary" />
                                                        {table.table_name}
                                                    </h3>
                                                    <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full border">
                                                        Found on Page {table.page_number}
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground text-lg">
                                                    {table.summary}
                                                </p>
                                                {table.notes && (
                                                    <div className="mt-4 p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-sm border border-blue-500/20">
                                                        <strong>AI Notes:</strong> {table.notes}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Schema Section */}
                                            <div>
                                                <h4 className="text-lg font-semibold flex items-center gap-2 mb-3">
                                                    <Code className="h-5 w-5" /> Detailed Schema
                                                </h4>
                                                <div className="bg-muted/30 p-4 rounded-lg overflow-x-auto border">
                                                    <pre className="text-sm font-mono text-foreground/80">
                                                        {JSON.stringify(table.schema_json, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>

                                            {/* Chunks / Rows Section */}
                                            <div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-lg font-semibold flex items-center gap-2">
                                                        <LayoutList className="h-5 w-5" /> Extracted Rows Data
                                                    </h4>
                                                    <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                                                        {tableChunks.length} Total Rows
                                                    </span>
                                                </div>

                                                <div className="grid gap-3">
                                                    {tableChunks.length === 0 ? (
                                                        <div className="text-center text-sm text-muted-foreground py-8 border rounded-lg bg-muted/10">
                                                            No row data found for this schema.
                                                        </div>
                                                    ) : tableChunks.map((chunk, idx) => (
                                                        <div key={chunk.id} className="border rounded-md bg-background p-4 text-sm shadow-sm transition-all hover:shadow-md">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                                                    <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-sm">Row #{idx + 1}</span>
                                                                    <span className="bg-muted px-2 py-0.5 rounded-sm border">Origin: Page {chunk.page_number}</span>
                                                                </span>
                                                            </div>
                                                            <div className="overflow-x-auto bg-muted/20 p-3 rounded border">
                                                                <pre className="text-sm font-mono text-foreground/90 whitespace-pre-wrap">
                                                                    {JSON.stringify(chunk.data, null, 2)}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
