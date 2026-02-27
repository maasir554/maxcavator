import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Loader2, ChevronDown, FileText, Search, XCircle, Bot, Database } from "lucide-react"
import { apiService } from "@/services/api-service"
import { dbService } from "@/services/db-service"
import { DocumentViewerModal } from "./document-viewer-modal"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SourceChunk {
    id: string;
    document_id: string;
    page_number: number;
    text_summary: string;
    filename?: string;
    table_name?: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: SourceChunk[];
    error?: string;
    used_chunk_ids?: string[];
    plan?: {
        sub_queries?: string[];
    };
}

function SourceDropdown({ sources }: { sources: SourceChunk[] }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mt-3">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="gap-2 text-xs h-7 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-800 dark:hover:text-indigo-300 border-indigo-200 dark:border-indigo-500/20 transition-all shadow-sm shadow-indigo-500/5"
            >
                <Database className="w-3 h-3" />
                View {sources.length} Context Sources
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
                <div className="mt-2 grid gap-2 max-h-[300px] overflow-y-auto pr-1 animate-in slide-in-from-top-2 fade-in duration-200">
                    {sources.map(source => (
                        <div key={source.id} className="text-xs border rounded-lg p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5 line-clamp-1">
                                    <FileText className="w-3 h-3 shrink-0" />
                                    {source.filename || 'Unknown Document'}
                                </div>
                                <DocumentViewerModal
                                    docId={source.document_id}
                                    initialPage={source.page_number}
                                >
                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/10 hover:bg-indigo-200 dark:hover:bg-indigo-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0 flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" />
                                        Open
                                    </span>
                                </DocumentViewerModal>
                            </div>

                            <div className="text-indigo-600/80 dark:text-indigo-400/80 mt-1 flex gap-2">
                                <span className="bg-indigo-100 dark:bg-indigo-500/10 px-1.5 rounded">Page {source.page_number}</span>
                                {source.table_name && <span className="bg-indigo-100 dark:bg-indigo-500/10 px-1.5 rounded">Table: {source.table_name}</span>}
                            </div>

                            <div className="mt-1.5 font-mono bg-white/50 dark:bg-black/40 p-2 rounded text-[10px] text-indigo-800/80 dark:text-indigo-200/90 overflow-x-auto border border-indigo-100 dark:border-white/5">
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
            <div className="flex items-center bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-full pl-2.5 pr-2 py-1 gap-1.5 shrink-0 animate-in fade-in slide-in-from-left-1 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors shadow-sm shadow-indigo-500/5">
                <FileText className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                <span className="text-[11px] font-medium text-indigo-800 dark:text-indigo-300 truncate max-w-[150px]">
                    {source.filename}
                </span>
                <span className="text-[10px] text-indigo-500/80 dark:text-indigo-400/70 shrink-0 font-medium whitespace-nowrap">
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
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors shadow-sm shadow-indigo-500/5"
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
                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-500/10 rounded-full p-0.5"
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

import { ExternalLink } from "lucide-react";

// --- Shared Markdown Table Components for premium rendering ---
const markdownTableComponents = {
    table: ({ node, ...props }: any) => (
        <div className="block w-full overflow-x-auto my-3 rounded-lg border border-indigo-200/60 dark:border-indigo-500/20 shadow-sm scrollbar-thin scrollbar-thumb-indigo-200 dark:scrollbar-thumb-indigo-900">
            <table className="min-w-full text-[13px] border-collapse" {...props} />
        </div>
    ),
    thead: ({ node, ...props }: any) => (
        <thead className="bg-indigo-50/80 dark:bg-indigo-950/40" {...props} />
    ),
    th: ({ node, ...props }: any) => (
        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider font-semibold text-indigo-700 dark:text-indigo-300 border-b border-indigo-200/60 dark:border-indigo-500/20" {...props} />
    ),
    td: ({ node, ...props }: any) => (
        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 border-b border-indigo-100/40 dark:border-indigo-500/10" {...props} />
    ),
    tr: ({ node, ...props }: any) => (
        <tr className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors" {...props} />
    ),
};

function renderMessageWithInlineCitations(content: string, sources?: SourceChunk[]) {
    if (!sources || sources.length === 0) {
        return (
            <div className="text-[15px] prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-indigo-50 dark:prose-pre:bg-white/5 prose-pre:border-indigo-100 dark:prose-pre:border-white/10 prose-pre:text-indigo-900 dark:prose-pre:text-indigo-200 w-full">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownTableComponents}>
                    {content}
                </ReactMarkdown>
            </div>
        );
    }

    // Preprocess: Convert [doc_N] or 【doc_N】 into standard Markdown links [doc_N](#cite-N)
    const processedContent = content.replace(/[\[【]doc_(\d+)[\]】]/g, '[doc_$1](#cite-$1)');

    return (
        <div className="text-[15px] prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-indigo-50 dark:prose-pre:bg-white/5 prose-pre:border-indigo-100 dark:prose-pre:border-white/10 prose-pre:text-indigo-900 dark:prose-pre:text-indigo-200 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 w-full">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    ...markdownTableComponents,
                    a: ({ node, href, children, ...props }) => {
                        if (href && href.startsWith('#cite-')) {
                            const docIndex = parseInt(href.replace('#cite-', ''), 10);
                            const source = sources[docIndex];
                            if (source) {
                                return (
                                    <span className="inline-block align-middle mx-1">
                                        <CitationCapsule source={source} />
                                    </span>
                                );
                            }
                            return <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs bg-indigo-100 dark:bg-indigo-500/10 px-1 rounded">[{children}]</span>;
                        }
                        return (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-2" {...props}>
                                {children}
                            </a>
                        );
                    }
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
}

export default function AgentInterface() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I am Maxcavator Agent. I can break down complex queries and search across your entire dataset to find precise answers. What would you like to know?" }
    ]);
    const [input, setInput] = useState("");
    const [agentState, setAgentState] = useState<'idle' | 'planning' | 'searching' | 'answering'>('idle');
    const [activeSubQueries, setActiveSubQueries] = useState<string[]>([]);

    // TopDown search controls whether to use DB entirely or fallback RAG
    const [isTopDownMode, setIsTopDownMode] = useState(true);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, agentState]);

    const handleSend = async () => {
        if (!input.trim() || agentState !== 'idle') return;

        const userMsg = input;
        setInput("");

        // Convert brief history for LLM
        const chatHistory = messages
            .filter(m => !m.error)
            .map(m => ({ role: m.role, content: m.content }));

        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setAgentState('planning');

        try {
            // STEP 1: PLANNING
            // Ask LLM to determine intent and sub-queries
            const plan = await apiService.getAgentPlan(userMsg, chatHistory);

            if (plan.intent === 'general_chat' && plan.direct_response) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: plan.direct_response!
                }]);
                setAgentState('idle');
                return;
            }

            // STEP 2: SEARCHING
            setAgentState('searching');
            setActiveSubQueries(plan.sub_queries || []);

            let allChunks: SourceChunk[] = [];

            // Execute semantic search for each sub-query independently
            for (const subQuery of plan.sub_queries) {
                let queryEmbedding: number[][] = [];
                try {
                    queryEmbedding = await apiService.generateEmbeddings([subQuery]);
                } catch (e) {
                    console.error(`Failed to embed subquery: ${subQuery}`, e);
                    continue; // skip this sub-query
                }

                if (!queryEmbedding || queryEmbedding.length === 0) continue;

                // For simplicity, search across all documents (no focus mode for agent yet)
                let chunks = [];
                if (isTopDownMode) {
                    chunks = await dbService.topDownSemanticSearch(queryEmbedding[0], 5, []);
                } else {
                    chunks = await dbService.semanticChunkSearch(queryEmbedding[0], 5, []);
                }

                allChunks = [...allChunks, ...chunks];
            }

            // Deduplicate chunks just in case multiple sub-queries hit the same context
            const uniqueChunks = Array.from(new Map(allChunks.map(c => [c.id, c])).values());

            if (!uniqueChunks || uniqueChunks.length === 0) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "I couldn't find any relevant data in your documents to answer that question.",
                }]);
                setAgentState('idle');
                setActiveSubQueries([]);
                return;
            }

            // STEP 3: ANSWERING
            setAgentState('answering');

            const { response, used_chunk_ids } = await apiService.getAgentAnswer(userMsg, uniqueChunks, chatHistory);

            // 4. Update UI
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response,
                sources: uniqueChunks,
                used_chunk_ids: used_chunk_ids,
                plan: { sub_queries: plan.sub_queries }
            }]);

        } catch (e: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I encountered an error while processing your request.",
                error: e.message
            }]);
        } finally {
            setAgentState('idle');
            setActiveSubQueries([]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
            {/* Ambient Background Gradient for Premium feel */}
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 dark:from-indigo-950/20 via-slate-50 dark:via-slate-950 to-purple-50/50 dark:to-purple-950/10 pointer-events-none" />

            {/* Header Area */}
            <div className="px-5 py-3 border-b border-indigo-100 dark:border-indigo-500/20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-10 sticky top-0">
                <div className="flex items-center gap-2.5">
                    <div className="bg-indigo-100 dark:bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)] dark:shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                        <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 tracking-wide">Maxcavator Agent</h2>
                        <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">Standard Agent Mode</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 z-10" ref={scrollRef}>
                <div className="space-y-6 max-w-3xl mx-auto pb-32">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* If it's the agent and we have a plan, show the sub-queries it searched for transparency */}
                                {m.role === 'assistant' && m.plan && m.plan.sub_queries && m.plan.sub_queries.length > 0 && (
                                    <div className="mb-1 flex flex-col gap-1.5 border-l-2 pl-3 border-indigo-200 dark:border-indigo-500/30">
                                        <div className="text-[10px] uppercase tracking-wider font-semibold text-indigo-500/80 dark:text-indigo-400/70 flex items-center gap-1.5">
                                            <Search className="w-3 h-3" /> Agent Searched For:
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {m.plan.sub_queries.map((sq, idx) => (
                                                <span key={idx} className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-mono shadow-sm">
                                                    "{sq}"
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div
                                    className={`relative ${m.role === 'user'
                                        ? 'bg-indigo-600 text-white px-5 py-3 rounded-3xl rounded-tr-md text-[15px] leading-relaxed shadow-sm dark:shadow-md shadow-indigo-900/10 dark:shadow-indigo-900/20'
                                        : 'py-2 text-slate-800 dark:text-slate-200 w-full'
                                        }`}
                                >
                                    {m.role === 'assistant' ? (
                                        renderMessageWithInlineCitations(m.content, m.sources)
                                    ) : (
                                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                    )}
                                </div>

                                {m.error && (
                                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-500/20 mt-1">
                                        <strong>Error:</strong> {m.error}
                                    </div>
                                )}

                                {m.sources && m.used_chunk_ids && m.used_chunk_ids.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-1 border-l-2 pl-3 border-indigo-200 dark:border-indigo-500/30">
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
                    ))}

                    {/* LOADING STATES */}
                    {agentState !== 'idle' && (
                        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="py-2 flex flex-col gap-2 border-l-2 pl-4 border-indigo-200 dark:border-indigo-500/40">

                                {agentState === 'planning' && (
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="w-4 h-4 animate-pulse text-indigo-500 dark:text-indigo-400" />
                                        <span className="text-[13px] font-medium text-indigo-700 dark:text-indigo-300">Agent is planning its search strategy...</span>
                                    </div>
                                )}

                                {(agentState === 'searching' || agentState === 'answering') && activeSubQueries.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <div className="text-[10px] uppercase tracking-wider font-semibold text-indigo-500/80 dark:text-indigo-400/70 flex items-center gap-1.5">
                                            <Search className="w-3 h-3" /> Agent is Searching For:
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {activeSubQueries.map((sq, idx) => (
                                                <span key={idx} className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-mono shadow-sm animate-pulse">
                                                    "{sq}"
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {agentState === 'answering' && (
                                    <div className="flex items-center gap-3 mt-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500 dark:text-indigo-400" />
                                        <span className="text-[13px] font-medium text-indigo-700 dark:text-indigo-300">Analyzing retrieved data & composing answer...</span>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-indigo-100 dark:border-indigo-500/20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md sticky bottom-0 z-20">
                <div className="max-w-3xl mx-auto flex flex-col gap-3 relative">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="relative flex items-center"
                    >
                        <div className="absolute left-3 flex items-center">
                            <Sparkles className="w-4 h-4 text-indigo-300 dark:text-indigo-500/70" />
                        </div>
                        <Input
                            placeholder="Ask the Agent to analyze your data..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={agentState !== 'idle'}
                            className="pr-24 pl-10 py-6 rounded-2xl bg-white dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-500/30 focus-visible:ring-indigo-500/50 shadow-inner text-indigo-900 dark:text-indigo-100 placeholder:text-indigo-400/60 dark:placeholder:text-indigo-300/40"
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-xl" title="Search Settings">
                                        <Database className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[220px] border-indigo-200 dark:border-indigo-500/20 bg-white dark:bg-slate-950 text-indigo-900 dark:text-indigo-100">
                                    <DropdownMenuLabel>Agent Settings</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-indigo-100 dark:bg-indigo-500/20" />
                                    <DropdownMenuItem className="focus:bg-indigo-50 dark:focus:bg-indigo-500/20 focus:text-indigo-900 dark:focus:text-indigo-100 p-0">
                                        <label className="flex items-center w-full px-2 py-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isTopDownMode}
                                                onChange={(e) => setIsTopDownMode(e.target.checked)}
                                                className="mr-2 accent-indigo-500"
                                            />
                                            Top-Down Search
                                        </label>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                                type="submit"
                                size="sm"
                                disabled={!input.trim() || agentState !== 'idle'}
                                className="h-9 rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/10 dark:shadow-indigo-900/30 transition-all font-medium"
                            >
                                {agentState !== 'idle' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask Agent"}
                            </Button>
                        </div>
                    </form>
                    <div className="text-center">
                        <p className="text-[10px] text-indigo-500/60 dark:text-indigo-400/50">
                            The Agent will independently construct sub-queries and analyze multiple sources to solve your problem.
                        </p>
                    </div>
                </div>
            </div>
        </div >
    );
}
