import { useState, useEffect } from "react"
import { useLocation, useRoute } from "wouter"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Database, FileText, LayoutList, ExternalLink, Code, ArrowLeft, Table2, ChevronRight, MoreVertical, Trash, MessageSquare, LayoutGrid, List, Layers } from "lucide-react"
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
}

export function FileDetailsView({ documentId }: FileDetailsViewProps) {
    const [, setLocation] = useLocation();
    const [, params] = useRoute('/document/:id/table/:tableId');
    const selectedTableId = params?.tableId || null;

    const jobs = useExtractionStore(state => state.jobs);
    const setFocusedDocumentIds = useExtractionStore(state => state.setFocusedDocumentIds);
    const job = jobs[documentId];

    const [tables, setTables] = useState<any[]>([]);
    const [chunks, setChunks] = useState<any[]>([]);
    const [dbDoc, setDbDoc] = useState<any>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isScrolledTop, setIsScrolledTop] = useState({ tables: true, details: true });
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [schemaViewMode, setSchemaViewMode] = useState<'formatted' | 'raw'>('formatted');
    const [rowsViewMode, setRowsViewMode] = useState<'formatted' | 'raw'>('formatted');
    const [includeMultiPage, setIncludeMultiPage] = useState(false);

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

    const handleBack = () => {
        if (selectedTableId) {
            setLocation(`/document/${documentId}`);
        } else {
            setLocation('/');
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 fade-in fill-mode-forwards animate-in">
            {/* Header / Navigation Bar */}
            <div className={`flex items-start justify-between border-b shrink-0 transition-all duration-300 ${isScrolled ? 'pb-2 mb-2' : 'pb-4 mb-4'}`}>
                <div className="flex flex-col flex-1 min-w-0 justify-center">

                    {/* Top Row: Back Button (Only visible when NOT scrolled, Desktop only) */}
                    <div className={`transition-all duration-300 overflow-hidden hidden md:block ${isScrolled ? 'opacity-0 max-h-0 m-0' : 'opacity-100 max-h-12 mb-1'}`}>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBack}
                            className="w-fit text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            {selectedTableId ? "Back to tables map" : "Back to Overview"}
                        </Button>
                    </div>

                    {/* Middle Row: Title (With Side Back Button when scrolled on Desktop, Always Side Back Button on Mobile) */}
                    <div className="flex items-center gap-2">
                        {/* Desktop: Show this back button ONLY when scrolled */}
                        <div className={`transition-all duration-300 overflow-hidden hidden md:flex items-center ${isScrolled ? 'opacity-100 max-w-[40px] mr-1' : 'opacity-0 max-w-0 mr-0'}`}>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleBack}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Mobile: ALWAYS show this back button instead of the document icon */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleBack}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 md:hidden mr-1"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>

                        {/* Document Icon (Hidden on mobile) */}
                        <FileText className={`text-muted-foreground shrink-0 transition-all duration-300 hidden md:block ${isScrolled ? 'h-5 w-5' : 'h-6 w-6'}`} />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="min-w-0 max-w-full cursor-default">
                                    <h2 className={`font-semibold truncate transition-all duration-300 ${isScrolled ? 'text-lg' : 'text-2xl'}`}>
                                        {job.filename}
                                    </h2>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="max-w-[95vw] wrap-break-word">
                                <p>{job.filename}</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Bottom Row: Metadata (Hidden when scrolled) */}
                    <div className={`flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground transition-all duration-300 overflow-hidden ${isScrolled ? 'max-h-0 opacity-0 m-0' : 'max-h-10 opacity-100 mt-2'}`}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${job.status === 'completed' ? 'bg-green-500' : job.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[95vw] wrap-break-word">
                                <p className="capitalize">Status: {job.status}</p>
                            </TooltipContent>
                        </Tooltip>
                        <span className="shrink-0">•</span>
                        <span className="shrink-0">{job.processedPages} / {job.totalPages || 1} pages</span>
                        {dbDoc && dbDoc.source_url && (
                            <>
                                <span className="shrink-0">•</span>
                                <a href={dbDoc.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline text-blue-500 truncate" title="Source Document">
                                    <span className="hidden sm:inline">Source</span> <ExternalLink className="h-3.5 w-3.5 sm:h-3 sm:w-3 shrink-0" />
                                </a>
                            </>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={() => {
                                        trashJob(documentId);
                                        handleBack();
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
                <div className={`transition-all duration-300 ml-4 shrink-0 flex items-center gap-2 ${isScrolled ? 'mt-1' : 'mt-8'}`}>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 h-8 w-8 px-0 sm:h-9 sm:px-3 sm:w-auto"
                        onClick={() => {
                            setFocusedDocumentIds([documentId]);
                            setLocation(`/chat?focus_docs=${documentId}`);
                        }}
                    >
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden sm:inline">Chat</span>
                    </Button>
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
                        <div className="mb-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <Table2 className="h-5 w-5 text-primary" />
                                Extracted Tables
                                <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                                    {tables.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/20">
                                <Button
                                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                    size="icon"
                                    className={`h-7 w-7 rounded-sm transition-all duration-200 ${viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                                    onClick={() => setViewMode('grid')}
                                    title="Grid View"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                    size="icon"
                                    className={`h-7 w-7 rounded-sm transition-all duration-200 ${viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                                    onClick={() => setViewMode('list')}
                                    title="List View"
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
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
                                <div className={viewMode === 'grid' ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}>
                                    {tables.map(table => {
                                        const chunkCount = chunks.filter(c => c.pdf_table_id === table.id).length;
                                        return (
                                            <div
                                                key={table.id}
                                                onClick={() => setLocation(`/document/${documentId}/table/${table.id}`)}
                                                className={`group border rounded-lg p-4 bg-card hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer flex min-w-0 ${viewMode === 'grid' ? 'flex-col' : 'flex-row items-center gap-4'}`}
                                            >
                                                {viewMode === 'grid' ? (
                                                    <>
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
                                                                <TooltipContent side="bottom" align="start" className="max-w-[95vw] wrap-break-word">
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
                                                    </>
                                                ) : (
                                                    <>
                                                        <Database className="h-8 w-8 text-primary/80 shrink-0 p-1.5 bg-primary/10 rounded-md" />
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-semibold text-base group-hover:text-primary transition-colors flex items-center gap-2 truncate">
                                                                {table.table_name}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground truncate">
                                                                {table.summary || "No summary available."}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground ml-auto pr-2 border-r">
                                                            <span className="flex items-center gap-1 w-[80px]">
                                                                <LayoutList className="h-3.5 w-3.5" />
                                                                <span className="font-medium text-foreground">{chunkCount}</span> rows
                                                            </span>
                                                            <span className="bg-muted px-2 py-1 rounded w-[70px] text-center border">Page {table.page_number}</span>
                                                        </div>
                                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
                                                    </>
                                                )}
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
                                    let tableChunks = chunks.filter(c => c.pdf_table_id === selectedTableId);

                                    if (table && includeMultiPage) {
                                        const relatedTableIds = tables.filter(t => t.table_name === table.table_name).map(t => t.id);
                                        tableChunks = chunks.filter(c => relatedTableIds.includes(c.pdf_table_id));
                                        tableChunks.sort((a, b) => a.page_number - b.page_number);
                                    }

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
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-lg font-semibold flex items-center gap-2">
                                                        <Code className="h-5 w-5" /> Detailed Schema
                                                    </h4>
                                                    <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/20">
                                                        <Button
                                                            variant={schemaViewMode === 'formatted' ? 'secondary' : 'ghost'}
                                                            size="icon"
                                                            className={`h-7 w-7 rounded-sm transition-all duration-200 ${schemaViewMode === 'formatted' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                                                            onClick={() => setSchemaViewMode('formatted')}
                                                            title="Formatted Table View"
                                                        >
                                                            <Table2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant={schemaViewMode === 'raw' ? 'secondary' : 'ghost'}
                                                            size="icon"
                                                            className={`h-7 w-7 rounded-sm transition-all duration-200 ${schemaViewMode === 'raw' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                                                            onClick={() => setSchemaViewMode('raw')}
                                                            title="Raw JSON View"
                                                        >
                                                            <Code className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {schemaViewMode === 'raw' ? (
                                                    <div className="bg-muted/30 p-4 rounded-lg overflow-x-auto border">
                                                        <pre className="text-sm font-mono text-foreground/80">
                                                            {JSON.stringify(table.schema_json, null, 2)}
                                                        </pre>
                                                    </div>
                                                ) : (
                                                    <div className="border rounded-md overflow-hidden bg-card">
                                                        <Table>
                                                            <TableHeader className="bg-muted/50">
                                                                <TableRow>
                                                                    <TableHead className="w-[200px]">Column Name</TableHead>
                                                                    <TableHead className="w-[120px]">Type</TableHead>
                                                                    <TableHead>Description</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {Array.isArray(table.schema_json) ? table.schema_json.map((col: any, idx: number) => (
                                                                    <TableRow key={idx}>
                                                                        <TableCell className="font-mono text-xs max-w-[200px] truncate" title={col.name}>{col.name}</TableCell>
                                                                        <TableCell>
                                                                            <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-sm font-medium border border-primary/20">
                                                                                {col.type || 'TEXT'}
                                                                            </span>
                                                                        </TableCell>
                                                                        <TableCell className="text-muted-foreground text-xs">{col.description || '-'}</TableCell>
                                                                    </TableRow>
                                                                )) : (
                                                                    <TableRow>
                                                                        <TableCell colSpan={3} className="text-center text-muted-foreground">Invalid schema format</TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Chunks / Rows Section */}
                                            <div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-lg font-semibold flex items-center gap-2">
                                                            <LayoutList className="h-5 w-5" /> Extracted Rows Data
                                                        </h4>
                                                        <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                                                            {tableChunks.length} Total Rows
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <Button
                                                            variant={includeMultiPage ? 'default' : 'outline'}
                                                            size="sm"
                                                            className={`h-8 px-3 text-xs gap-1.5 transition-all shadow-sm ${includeMultiPage ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                                            onClick={() => setIncludeMultiPage(!includeMultiPage)}
                                                            title="Include rows from all tables with this name across all pages"
                                                        >
                                                            <Layers className="h-4 w-4" />
                                                            <span className="font-semibold">{includeMultiPage ? "Multi-Page: ON" : "Multi-Page: OFF"}</span>
                                                        </Button>

                                                        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/20">
                                                            <Button
                                                                variant={rowsViewMode === 'formatted' ? 'secondary' : 'ghost'}
                                                                size="icon"
                                                                className={`h-7 w-7 rounded-sm transition-all duration-200 ${rowsViewMode === 'formatted' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                                                                onClick={() => setRowsViewMode('formatted')}
                                                                title="Formatted Table View"
                                                            >
                                                                <Table2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant={rowsViewMode === 'raw' ? 'secondary' : 'ghost'}
                                                                size="icon"
                                                                className={`h-7 w-7 rounded-sm transition-all duration-200 ${rowsViewMode === 'raw' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                                                                onClick={() => setRowsViewMode('raw')}
                                                                title="Raw JSON View"
                                                            >
                                                                <Code className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {tableChunks.length === 0 ? (
                                                    <div className="text-center text-sm text-muted-foreground py-8 border rounded-lg bg-muted/10">
                                                        No row data found for this schema.
                                                    </div>
                                                ) : rowsViewMode === 'raw' ? (
                                                    <div className="grid gap-3">
                                                        {tableChunks.map((chunk, idx) => (
                                                            <div key={chunk.id} className="border rounded-md bg-card p-4 text-sm shadow-sm transition-all hover:shadow-md">
                                                                <div className="flex justify-between items-start mb-3 gap-4">
                                                                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                                                            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-sm shrink-0">Row #{idx + 1}</span>
                                                                            <span className="bg-muted px-2 py-0.5 rounded-sm border shrink-0">Origin: Page {chunk.page_number}</span>
                                                                        </span>
                                                                        {chunk.text_summary && (
                                                                            <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded-md border mt-1 leading-relaxed">
                                                                                {chunk.text_summary}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="overflow-x-auto bg-muted/20 p-3 rounded border">
                                                                    <pre className="text-sm font-mono text-foreground/90 whitespace-pre-wrap">
                                                                        {JSON.stringify(chunk.data, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="border rounded-md overflow-x-auto bg-card shadow-sm">
                                                        <Table className="min-w-max">
                                                            <TableHeader className="bg-muted/50">
                                                                <TableRow>
                                                                    <TableHead className="w-[60px] text-center sticky left-0 bg-muted/50 z-10 border-r">Row #</TableHead>
                                                                    {Array.isArray(table.schema_json) ? table.schema_json.map((col: any, idx: number) => (
                                                                        <TableHead key={idx} className="font-mono text-xs" title={col.description}>{col.name}</TableHead>
                                                                    )) : (
                                                                        tableChunks[0] && typeof tableChunks[0].data === 'object' && Object.keys(tableChunks[0].data).map((key: string, idx: number) => (
                                                                            <TableHead key={idx} className="font-mono text-xs">{key}</TableHead>
                                                                        ))
                                                                    )}
                                                                    <TableHead className="w-[80px] text-right">Page #</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {tableChunks.map((chunk, idx) => (
                                                                    <TableRow key={chunk.id}>
                                                                        <TableCell className="text-center font-medium sticky left-0 bg-card z-10 border-r">{idx + 1}</TableCell>
                                                                        {Array.isArray(table.schema_json) ? table.schema_json.map((col: any, i: number) => {
                                                                            const val = chunk.data?.[col.name];
                                                                            return (
                                                                                <TableCell key={i} className="text-xs whitespace-nowrap">
                                                                                    {val !== undefined && val !== null ? String(val) : <span className="text-muted-foreground italic">-</span>}
                                                                                </TableCell>
                                                                            );
                                                                        }) : (
                                                                            chunk.data && typeof chunk.data === 'object' && Object.values(chunk.data).map((val: any, i: number) => (
                                                                                <TableCell key={i} className="text-xs whitespace-nowrap">
                                                                                    {val !== undefined && val !== null ? String(val) : <span className="text-muted-foreground italic">-</span>}
                                                                                </TableCell>
                                                                            ))
                                                                        )}
                                                                        <TableCell className="text-right text-xs text-muted-foreground">
                                                                            Pg {chunk.page_number}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                )}
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
