
import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Bot, User, Loader2, BookOpen, ChevronDown, ChevronRight, FileText, Plus, Search } from "lucide-react"
import { apiService } from "@/services/api-service"
import { dbService } from "@/services/db-service"
import { DocumentViewerModal } from "./document-viewer-modal"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SourceChunk {
    id: string;
    document_id: string;
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
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-muted/40 hover:bg-muted text-[10px] text-muted-foreground transition-colors"
                title={`Reference: ${source.filename} (Pg ${source.page_number})`}
            >
                <FileText className="w-3 h-3" />
                <span>See Reference</span>
            </button>
        );
    }

    return (
        <div className="flex items-center bg-muted/20 border rounded-full pl-2.5 pr-1 py-1 gap-2 shrink-0 animate-in fade-in slide-in-from-left-1">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[150px]">
                {source.filename} (Pg {source.page_number})
            </span>
            <DocumentViewerModal
                docId={source.document_id}
                initialPage={source.page_number}
                iconOnly={true}
            />
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
    const scrollRef = useRef<HTMLDivElement>(null);

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
            if (isTopDownMode) {
                chunks = await dbService.topDownSemanticSearch(queryEmbedding[0], 5);
            } else {
                chunks = await dbService.semanticChunkSearch(queryEmbedding[0], 5);
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
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4" ref={scrollRef}>
                <div className="space-y-6 max-w-4xl mx-auto pb-6">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {m.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-primary/10 border-primary/20 border flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                    <Bot className="w-4 h-4 text-primary" />
                                </div>
                            )}

                            <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div
                                    className={`p-4 rounded-xl shadow-sm ${m.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                        : 'bg-card border rounded-tl-sm'
                                        }`}
                                >
                                    {m.role === 'assistant' ? (
                                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-muted-foreground prose-a:text-primary">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {m.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                    )}
                                </div>

                                {m.error && (
                                    <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20 mt-1">
                                        <strong>Error:</strong> {m.error}
                                    </div>
                                )}

                                {/* Render explicitly used citations */}
                                {m.sources && m.used_chunk_ids && m.used_chunk_ids.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-1 border-l-2 pl-3 border-muted-foreground/30">
                                        <div className="flex flex-wrap gap-2">
                                            {m.used_chunk_ids.map(chunkId => {
                                                const sourceChunk = m.sources?.find(s => s.id === chunkId);
                                                if (!sourceChunk) return null;
                                                return <CitationCapsule key={chunkId} source={sourceChunk} />;
                                            })}
                                        </div>
                                    </div>
                                )}

                                {m.sources && m.sources.length > 0 && (
                                    <SourceDropdown sources={m.sources} />
                                )}
                            </div>

                            {m.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-primary border-primary border flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                    <User className="w-4 h-4 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border-primary/20 border flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                <Bot className="w-4 h-4 text-primary" />
                            </div>
                            <div className="bg-card border p-4 rounded-xl rounded-tl-sm shadow-sm flex items-center gap-3">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Searching documents & composing answer...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
                <div className="max-w-4xl mx-auto flex gap-2 relative">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0 rounded-full h-11 w-11 shadow-sm relative">
                                <Plus className="h-5 w-5" />
                                {isTopDownMode && (
                                    <span className="absolute top-0 right-0 -mr-1 -mt-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary border-2 border-background"></span>
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[240px]">
                            <div className="px-2 py-1.5 text-sm font-semibold flex items-center gap-2">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                Search Options
                            </div>
                            <DropdownMenuCheckboxItem
                                checked={isTopDownMode}
                                onCheckedChange={setIsTopDownMode}
                                className="cursor-pointer"
                            >
                                <div className="flex flex-col gap-1">
                                    <span className="font-medium">Top-Down Mode</span>
                                    <span className="text-xs text-muted-foreground leading-snug">
                                        Enables hierarchical vector search for complex document queries.
                                    </span>
                                </div>
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex-1 flex gap-2 shadow-sm rounded-full bg-background border p-1 border-primary/20 focus-within:ring-1 focus-within:ring-primary">
                        <Input
                            placeholder={isTopDownMode ? "Ask using Top-Down search..." : "Ask about your data..."}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent px-4 rounded-full"
                        />
                        <Button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="rounded-full shadow-sm px-6 h-9"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Send
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
