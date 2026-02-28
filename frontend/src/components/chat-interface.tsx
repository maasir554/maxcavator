
import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea"
import { Loader2, ChevronDown, FileText, Plus, XCircle, MessageSquare, BookOpen, ChevronRight, Search, X, ArrowUp } from "lucide-react"
import { apiService } from "@/services/api-service"
import { dbService } from "@/services/db-service"
import { DocumentViewerModal } from "./document-viewer-modal"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLocation, useSearch } from "wouter"
import { DocumentSelectionModal } from "./document-selection-modal"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


import { useExtractionStore } from '@/store/extraction-store'

interface SourceChunk {
    id: string;
    document_id: string;
    pdf_table_id?: string;
    filename: string;
    page_number: number;
    table_name: string;
    text_summary: string;
    data: any;
    similarity_score: number;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: SourceChunk[];
    used_chunk_ids?: string[];
    error?: string;
}

function SourceDropdown({ sources }: { sources: SourceChunk[] }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!sources || sources.length === 0) return null;

    return (
        <div className="mt-2 w-full border rounded-md overflow-hidden bg-background shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>View {sources.length} Context Source{sources.length !== 1 && 's'}</span>
                </div>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {isOpen && (
                <div className="p-2 space-y-2 border-t bg-muted/20 max-h-[300px] overflow-y-auto">
                    {sources.map((source, idx) => (
                        <div key={idx} className="flex flex-col gap-1 p-2 rounded border bg-card text-xs">
                            <div className="flex items-start justify-between gap-2">
                                <div className="font-medium text-primary flex items-center gap-1.5 truncate">
                                    <FileText className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{source.filename}</span>
                                </div>
                                <div className="shrink-0">
                                    <DocumentViewerModal
                                        docId={source.document_id}
                                        initialPage={source.page_number}
                                        iconOnly={false}
                                    />
                                </div>
                            </div>

                            <div className="text-muted-foreground mt-1 flex gap-2">
                                <span className="bg-muted px-1.5 rounded">Page {source.page_number}</span>
                                <span className="bg-muted px-1.5 rounded">Table: {source.table_name}</span>
                            </div>

                            <div className="mt-1 font-mono bg-muted/50 p-1.5 rounded overflow-x-auto text-[10px]">
                                {source.text_summary}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function CitationCapsule({ source }: { source: SourceChunk }) {
    return (
        <DocumentViewerModal
            docId={source.document_id}
            initialPage={source.page_number}
            iconOnly={true}
        >
            <div className="flex items-center bg-muted/20 border rounded-full pl-2.5 pr-2 py-1 gap-1.5 shrink-0 animate-in fade-in slide-in-from-left-1 cursor-pointer hover:bg-muted/40 transition-colors">
                <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[150px]">
                    {source.filename}
                </span>
                <span className="text-[10px] text-muted-foreground/70 shrink-0 font-medium whitespace-nowrap">
                    • pg. {source.page_number}
                </span>
            </div>
        </DocumentViewerModal>
    );
}

function CitationGroup({ sources }: { sources: SourceChunk[] }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!sources || sources.length === 0) return null;

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-muted/40 hover:bg-muted text-[10px] text-muted-foreground transition-colors"
                title={`${sources.length} Reference${sources.length > 1 ? 's' : ''}`}
            >
                <FileText className="w-3 h-3" />
                <span>See {sources.length} Reference{sources.length > 1 ? 's' : ''}</span>
            </button>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <button
                onClick={() => setIsExpanded(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Collapse references"
            >
                <XCircle className="w-4 h-4" />
            </button>
            {sources.map(chunk => (
                <CitationCapsule key={chunk.id} source={chunk} />
            ))}
        </div>
    );
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! Ask me about your data, and I'll find the answers in your uploaded PDFs." }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isTopDownMode, setIsTopDownMode] = useState(true);
    const [focusModalOpen, setFocusModalOpen] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const jobs = useExtractionStore(state => state.jobs);
    const focusedIds = useExtractionStore(state => state.focusedDocumentIds);
    const setFocusedIds = useExtractionStore(state => state.setFocusedDocumentIds);

    const [location, setLocation] = useLocation();
    const searchString = useSearch();



    // Sync FROM url TO state
    useEffect(() => {
        const params = new URLSearchParams(searchString);
        const docs = params.get('focus_docs');
        if (docs !== null) {
            const ids = docs.split(',').filter(Boolean);
            if (ids.join(',') !== focusedIds.join(',')) {
                setFocusedIds(ids);
            }
        }
    }, [searchString, setFocusedIds]);

    // Sync FROM state TO url
    useEffect(() => {
        const params = new URLSearchParams(searchString);
        const currentDocs = params.get('focus_docs');
        const desiredDocs = focusedIds.length > 0 ? focusedIds.join(',') : null;

        if (desiredDocs !== currentDocs) {
            if (desiredDocs) {
                params.set('focus_docs', desiredDocs);
            } else {
                params.delete('focus_docs');
            }
            const newSearch = params.toString();
            // Use replace to avoid polluting browser history during checkbox toggles
            setLocation(location.split('?')[0] + (newSearch ? '?' + newSearch : ''), { replace: true });
        }
    }, [focusedIds, location, searchString, setLocation]);


    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input;
        setInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            // 1. Vectorize query
            let queryEmbedding: number[][] = [];
            try {
                queryEmbedding = await apiService.generateEmbeddings([userMsg]);
            } catch (e) {
                throw new Error("Failed to generate embedding for search query.");
            }

            if (!queryEmbedding || queryEmbedding.length === 0) {
                throw new Error("No embedding returned for query.");
            }

            // 2. Search for relevant chunks
            let chunks = [];
            const effectiveTopDownMode = isTopDownMode && focusedIds.length === 0;

            if (effectiveTopDownMode) {
                chunks = await dbService.topDownSemanticSearch(queryEmbedding[0], 5, focusedIds);
            } else {
                chunks = await dbService.semanticChunkSearch(queryEmbedding[0], 5, focusedIds);
            }

            if (!chunks || chunks.length === 0) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "I couldn't find any relevant data in your documents to answer that question.",
                }]);
                setIsLoading(false);
                return;
            }

            // 3. Request RAG completion
            const { response, used_chunk_ids } = await apiService.generateRagChat(userMsg, chunks);

            // 4. Update UI
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response,
                sources: chunks,
                used_chunk_ids: used_chunk_ids
            }]);

        } catch (e: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I encountered an error processing your request.",
                error: e.message
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
            {/* Ambient Background Gradient for Premium feel */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 dark:from-blue-950/20 via-slate-50 dark:via-slate-950 to-indigo-50/50 dark:to-indigo-950/10 pointer-events-none" />

            {/* Header Area */}
            <div className="px-5 py-3 border-b border-blue-100 dark:border-blue-500/20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-10 sticky top-0">
                <div className="flex items-center gap-2.5">
                    <div className="bg-blue-100 dark:bg-blue-500/20 p-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] dark:shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                        <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 tracking-wide">Data Assistant Chat</h2>
                        <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80">Context-Aware Interrogation Mode</p>
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4" ref={scrollRef}>
                <div className="space-y-6 max-w-3xl mx-auto pb-32">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div
                                    className={`relative ${m.role === 'user'
                                        ? 'bg-muted dark:bg-muted/40 text-foreground px-5 py-3 rounded-3xl rounded-tr-md text-[15px] leading-relaxed'
                                        : 'py-2'
                                        }`}
                                >
                                    {m.role === 'assistant' ? (
                                        <div className="text-[15px] prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-muted-foreground prose-a:text-primary">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {m.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                    )}

                                    {m.error && (
                                        <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 mt-1">
                                            <strong>Error:</strong> {m.error}
                                        </div>
                                    )}

                                    {m.sources && m.used_chunk_ids && m.used_chunk_ids.length > 0 && (
                                        <div className="flex flex-col gap-1.5 mt-1 border-l-2 pl-3 border-muted-foreground/30">
                                            <CitationGroup
                                                sources={m.used_chunk_ids.map(id => m.sources?.find(s => s.id === id)).filter((s): s is SourceChunk => !!s)}
                                            />
                                        </div>
                                    )}

                                    {m.sources && m.sources.length > 0 && (
                                        <SourceDropdown sources={m.sources} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="py-2 flex items-center gap-3">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground mt-0.5">Searching documents & composing answer...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className={`p-4 border-t bg-background/80 backdrop-blur-sm sticky bottom-0 ${focusedIds.length > 0 ? 'border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20' : ''}`}>
                <div className="max-w-3xl mx-auto flex flex-col gap-3 relative">
                    {/* Render Focused Document Chips */}
                    {focusedIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center pr-2">
                                <MessageSquare className="w-3.5 h-3.5 mr-1" /> Focus Mode:
                            </span>
                            {focusedIds.map(fid => {
                                const docJob = jobs[fid];
                                if (!docJob) return null;
                                return (
                                    <div key={fid} className="flex items-center gap-0 bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 rounded-full pl-1 pr-1 py-0.5 text-xs font-medium relative group shadow-sm transition-all hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-700">
                                        <DocumentViewerModal docId={fid}>
                                            <div className="flex items-center gap-1.5 pl-1.5 pr-1 cursor-pointer hover:underline decoration-blue-300 dark:decoration-blue-700 underline-offset-2">
                                                <FileText className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                                                <span className="truncate max-w-[150px]">{docJob.filename}</span>
                                            </div>
                                        </DocumentViewerModal>
                                        <div className="h-3.5 w-px bg-blue-200/60 dark:bg-blue-800/60 mx-1" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 hover:text-blue-900 dark:hover:text-blue-100 shrink-0 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFocusedIds(focusedIds.filter(id => id !== fid));
                                            }}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className={`shrink-0 rounded-full h-11 w-11 shadow-sm relative transition-colors ${focusedIds.length > 0 ? 'border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''}`}>
                                    <Plus className="h-5 w-5" />
                                    {isTopDownMode && focusedIds.length === 0 && (
                                        <span className="absolute top-0 right-0 -mr-1 -mt-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary border-2 border-background"></span>
                                        </span>
                                    )}
                                    {focusedIds.length > 0 && (
                                        <span className="absolute top-0 right-0 -mr-1 -mt-1 flex h-3 w-3">
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[240px]">
                                <div className="px-2 py-1.5 text-sm font-semibold flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                    Chat Context
                                </div>
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => setFocusModalOpen(true)}
                                >
                                    <div className="flex flex-col gap-1 w-full">
                                        <span className="font-medium text-blue-600 dark:text-blue-400">Select Focus Documents...</span>
                                        <span className="text-xs text-muted-foreground leading-snug">
                                            Restrict AI to answer ONLY from specific PDFs.
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-sm font-semibold flex items-center gap-2">
                                    <Search className="w-4 h-4 text-muted-foreground" />
                                    Search Engine
                                </div>
                                <DropdownMenuCheckboxItem
                                    checked={isTopDownMode && focusedIds.length === 0}
                                    onCheckedChange={setIsTopDownMode}
                                    disabled={focusedIds.length > 0}
                                    className="cursor-pointer"
                                >
                                    <div className={`flex flex-col gap-1 ${focusedIds.length > 0 ? 'opacity-50' : ''}`}>
                                        <span className="font-medium">Top-Down Mode</span>
                                        <span className="text-xs text-muted-foreground leading-snug">
                                            {focusedIds.length > 0
                                                ? "Disabled in Focus Mode (using direct local search)."
                                                : "Enables hierarchical vector search for complex queries."}
                                        </span>
                                    </div>
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className={`flex items-end gap-2 transition-all`}>
                            <div className="relative flex-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className={`absolute left-2.5 bottom-1.5 h-8 w-8 rounded-full z-10 hidden sm:flex border-0 transition-colors ${focusedIds.length > 0 ? 'bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-900/40 dark:hover:bg-blue-800/60 text-blue-600 dark:text-blue-400' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}
                                    onClick={() => setFocusModalOpen(true)}
                                    title="Select specific documents to focus on"
                                >
                                    {focusedIds.length > 0 ? <MessageSquare className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    {focusedIds.length > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 text-[8px] font-bold text-white shadow-sm ring-1 ring-background">
                                            {focusedIds.length}
                                        </span>
                                    )}
                                </Button>
                                <AutoResizeTextarea
                                    placeholder={focusedIds.length > 0 ? `Ask about ${focusedIds.length} focused document${focusedIds.length !== 1 ? 's' : ''}...` : (isTopDownMode ? "Ask using Top-Down search..." : "Ask about your data...")}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onEnter={() => {
                                        if (!isLoading && input.trim()) handleSend();
                                    }}
                                    disabled={isLoading}
                                    className={`border shadow-sm focus-visible:ring-1 bg-background sm:pl-12 px-4 py-3 min-h-[44px] rounded-3xl ${focusedIds.length > 0 ? 'border-blue-400/50 ring-blue-500/40 focus-visible:border-blue-500 placeholder:text-blue-500/50 dark:placeholder:text-blue-400/50 font-medium' : 'border-primary/20 focus-visible:ring-primary'} w-full transition-all`}
                                />
                            </div>
                            <Button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                size="icon"
                                className={`rounded-full shadow-sm shrink-0 h-[44px] w-[44px] transition-colors ${focusedIds.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                            >
                                <ArrowUp className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                <DocumentSelectionModal
                    open={focusModalOpen}
                    onOpenChange={setFocusModalOpen}
                />
            </div>
        </div>
    );
}
