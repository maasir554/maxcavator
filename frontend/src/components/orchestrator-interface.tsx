import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea"
import { Loader2, ChevronDown, ChevronRight, FileText, Search, XCircle, Zap, Database, Brain, Cog, Filter, PenTool, Clock, ArrowUp, MessageSquare, Plus, X } from "lucide-react"
import { apiService } from "@/services/api-service"
import { dbService } from "@/services/db-service"
import { DocumentViewerModal } from "./document-viewer-modal"
import { DocumentSelectionModal } from "./document-selection-modal"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExternalLink } from "lucide-react"
import { useLocation, useSearch } from "wouter"
import { useExtractionStore } from '@/store/extraction-store'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ==================== TYPES ====================

interface SourceChunk {
    id: string;
    document_id: string;
    pdf_table_id?: string;
    page_number: number;
    text_summary: string;
    filename?: string;
    table_name?: string;
    source_id?: string; // e.g. "doc_0" or "prior_doc_0"
}

interface OrchestratorStep {
    phase: string;
    type: 'ai' | 'frontend';
    tool_name?: string;
    input_summary: string;
    output_summary: string;
    full_input?: any;
    full_output?: any;
    duration_ms: number;
    status: 'success' | 'error';
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: SourceChunk[];
    error?: string;
    used_chunk_ids?: string[];
    v2_steps?: OrchestratorStep[];
}

// ==================== HELPERS ====================

function formatJsonString(obj: any): React.JSX.Element[] | string {
    if (!obj) return "null";
    let jsonStr = "";
    try {
        jsonStr = typeof obj === 'string' ? JSON.stringify(JSON.parse(obj), null, 2) : JSON.stringify(obj, null, 2);
    } catch (e) {
        return String(obj);
    }

    return jsonStr.split('\n').map((line, i) => {
        const match = line.match(/^(\s*)("([^"]+)"\s*:)\s*(.*)$/);

        if (match) {
            const [, indent, , keyName, valuePart] = match;

            let valueSpan = <span className="text-slate-300">{valuePart}</span>;
            if (valuePart.startsWith('"')) {
                valueSpan = <span className="text-amber-300 dark:text-amber-300/90">{valuePart}</span>;
            } else if (valuePart.match(/^[0-9.-]+,?( \/\/.*)?$/)) {
                valueSpan = <span className="text-blue-400 dark:text-blue-400/90">{valuePart}</span>;
            } else if (valuePart.startsWith('true') || valuePart.startsWith('false') || valuePart.startsWith('null')) {
                valueSpan = <span className="text-purple-400 dark:text-purple-400/90">{valuePart}</span>;
            }

            return (
                <div key={i} className="pl-1 hover:bg-slate-800/50 rounded whitespace-pre">
                    <span>{indent}</span>
                    <span className="text-purple-300/90 dark:text-purple-300/80 font-semibold">"{keyName}"</span>
                    <span className="text-slate-500">: </span>
                    {valueSpan}
                </div>
            );
        }

        return <div key={i} className="pl-1 whitespace-pre text-slate-500">{line}</div>;
    });
}

// ==================== CITATION UI ====================

function CitationCapsule({ source }: { source: SourceChunk }) {
    return (
        <DocumentViewerModal docId={source.document_id} initialPage={source.page_number} iconOnly={true}>
            <div className="flex items-center bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-full pl-2.5 pr-2 py-1 gap-1.5 shrink-0 animate-in fade-in slide-in-from-left-1 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-500/20 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors shadow-sm shadow-purple-500/5">
                <FileText className="w-3 h-3 text-purple-500 dark:text-purple-400 shrink-0" />
                <span className="text-[11px] font-medium text-purple-800 dark:text-purple-300 truncate max-w-[150px]">
                    {source.filename}
                </span>
                <span className="text-[10px] text-purple-500/80 dark:text-purple-400/70 shrink-0 font-medium whitespace-nowrap">
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
            <button onClick={() => setIsExpanded(true)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors shadow-sm"
                title={`${sources.length} Reference${sources.length > 1 ? 's' : ''}`}
            >
                <FileText className="w-3 h-3" />
                <span>See {sources.length} Reference{sources.length > 1 ? 's' : ''}</span>
            </button>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setIsExpanded(false)} className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-colors hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-full p-0.5" title="Collapse">
                <XCircle className="w-4 h-4" />
            </button>
            {sources.map(chunk => <CitationCapsule key={chunk.id} source={chunk} />)}
        </div>
    );
}

function SourceDropdown({ sources }: { sources: SourceChunk[] }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}
                className="gap-2 text-xs h-7 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 hover:text-purple-800 dark:hover:text-purple-300 border-purple-200 dark:border-purple-500/20 transition-all shadow-sm"
            >
                <Database className="w-3 h-3" />
                View {sources.length} Context Sources
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
            {isOpen && (
                <div className="mt-2 grid gap-2 max-h-[300px] overflow-y-auto pr-1 animate-in slide-in-from-top-2 fade-in duration-200">
                    {sources.map(source => (
                        <div key={source.id} className="text-xs border rounded-lg p-2.5 bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-500/20 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5 line-clamp-1">
                                    <FileText className="w-3 h-3 shrink-0" />
                                    {source.filename || 'Unknown Document'}
                                </div>
                                <DocumentViewerModal docId={source.document_id} initialPage={source.page_number}>
                                    <span className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-800 bg-purple-100 dark:bg-purple-500/10 hover:bg-purple-200 dark:hover:bg-purple-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0 flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" /> Open
                                    </span>
                                </DocumentViewerModal>
                            </div>
                            <div className="text-purple-600/80 dark:text-purple-400/80 mt-1 flex gap-2">
                                <span className="bg-purple-100 dark:bg-purple-500/10 px-1.5 rounded">Page {source.page_number}</span>
                                {source.table_name && <span className="bg-purple-100 dark:bg-purple-500/10 px-1.5 rounded">Table: {source.table_name}</span>}
                            </div>
                            <div className="mt-1.5 font-mono bg-white/50 dark:bg-black/40 p-2 rounded text-[10px] text-purple-800/80 dark:text-purple-200/90 overflow-x-auto border border-purple-100 dark:border-white/5">
                                {source.text_summary}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==================== MARKDOWN RENDERING ====================

const markdownTableComponents = {
    table: ({ node, ...props }: any) => (
        <div className="block w-full overflow-x-auto my-3 rounded-lg border border-purple-200/60 dark:border-purple-500/20 shadow-sm scrollbar-thin scrollbar-thumb-purple-200 dark:scrollbar-thumb-purple-900">
            <table className="min-w-full text-[13px] border-collapse" {...props} />
        </div>
    ),
    thead: ({ node, ...props }: any) => (<thead className="bg-purple-50/80 dark:bg-purple-950/40" {...props} />),
    th: ({ node, ...props }: any) => (<th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider font-semibold text-purple-700 dark:text-purple-300 border-b border-purple-200/60 dark:border-purple-500/20" {...props} />),
    td: ({ node, ...props }: any) => (<td className="px-3 py-2 text-slate-700 dark:text-slate-300 border-b border-purple-100/40 dark:border-purple-500/10" {...props} />),
    tr: ({ node, ...props }: any) => (<tr className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors" {...props} />),
};

function renderMessageWithInlineCitations(content: string, sources?: SourceChunk[]) {
    if (!sources || sources.length === 0) {
        return (
            <div className="text-[15px] prose dark:prose-invert max-w-none prose-p:leading-relaxed w-full">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownTableComponents}>{content}</ReactMarkdown>
            </div>
        );
    }
    // Match both [doc_N] and [prior_doc_N] with [ or 【
    const processedContent = content.replace(/[\[【]((?:prior_)?doc_\d+)[\]】]/g, '[$1](#cite-$1)');

    return (
        <div className="text-[15px] prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-a:text-purple-600 dark:prose-a:text-purple-400 w-full">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                ...markdownTableComponents,
                a: ({ node, href, children, ...props }) => {
                    if (href && href.startsWith('#cite-')) {
                        const citeKey = href.replace('#cite-', '');
                        // Look up by source_id key instead of array index
                        const source = sources.find(s => s.source_id === citeKey);
                        if (source) return <span className="inline-block align-middle mx-1"><CitationCapsule source={source} /></span>;
                        return <span className="text-purple-600 dark:text-purple-400 font-mono text-xs bg-purple-100 dark:bg-purple-500/10 px-1 rounded">[{children}]</span>;
                    }
                    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 underline underline-offset-2" {...props}>{children}</a>;
                }
            }}>{processedContent}</ReactMarkdown>
        </div>
    );
}

// ==================== STEP LOG ====================

const PHASE_ICONS: Record<string, any> = {
    'Intent Router': Brain, 'Embedding': Cog, 'Semantic Search': Search,
    'List Topics': Database, 'List Documents': FileText, 'Math': Cog,
    'Context Analyst': Filter, 'Synthesizer': PenTool, 'Error': XCircle,
};

function OrchestratorV2StepLog({ steps }: { steps: OrchestratorStep[] }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const totalMs = steps.reduce((sum, s) => sum + s.duration_ms, 0);
    const aiSteps = steps.filter(s => s.type === 'ai').length;
    const toolSteps = steps.filter(s => s.type === 'frontend').length;

    return (
        <div className="mb-2 flex flex-col gap-1 border-l-2 pl-3 border-purple-300 dark:border-purple-500/30">
            <button onClick={() => setIsExpanded(!isExpanded)}
                className="text-[10px] uppercase tracking-wider font-semibold text-purple-600/80 dark:text-purple-400/70 flex items-center gap-1.5 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
                <Zap className="w-3 h-3" />
                Pipeline — {steps.length} steps · {aiSteps} AI · {toolSteps} tools · {(totalMs / 1000).toFixed(1)}s
                <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="flex flex-col gap-1 mt-0.5 animate-in slide-in-from-top-1 fade-in duration-200">
                    {steps.map((step, idx) => {
                        const Icon = PHASE_ICONS[step.phase] || Cog;
                        const isOpen = expandedIdx === idx;
                        return (
                            <div key={idx} className={`rounded-lg border transition-colors ${step.status === 'error'
                                ? 'border-red-300 dark:border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
                                : step.type === 'ai'
                                    ? 'border-purple-200 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20'
                                    : 'border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20'
                                }`}>
                                <button onClick={() => setExpandedIdx(isOpen ? null : idx)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left">
                                    <Icon className={`w-3 h-3 shrink-0 ${step.type === 'ai' ? 'text-purple-500 dark:text-purple-400' : 'text-amber-500 dark:text-amber-400'}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded ${step.type === 'ai' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
                                        {step.type === 'ai' ? '🧠 AI' : '⚡ Tool'}
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 shrink-0">{step.phase}</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex-1">{step.output_summary}</span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-0.5">
                                        <Clock className="w-2.5 h-2.5" />
                                        {step.duration_ms < 1000 ? `${step.duration_ms}ms` : `${(step.duration_ms / 1000).toFixed(1)}s`}
                                    </span>
                                    <ChevronDown className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isOpen && (
                                    <div className="px-3 pb-2.5 pt-0.5 border-t border-slate-200/50 dark:border-slate-700/50 animate-in slide-in-from-top-1 fade-in duration-200">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Input</div>
                                                <div className="text-[10px] bg-slate-900 text-slate-300 p-2 rounded border border-slate-700/50 overflow-x-auto max-h-48 overflow-y-auto font-mono custom-scrollbar">
                                                    {typeof step.full_input === 'string' ? step.full_input : formatJsonString(step.full_input)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Output</div>
                                                <div className="text-[10px] bg-slate-900 text-slate-300 p-2 rounded border border-slate-700/50 overflow-x-auto max-h-48 overflow-y-auto font-mono custom-scrollbar">
                                                    {typeof step.full_output === 'string' ? step.full_output : formatJsonString(step.full_output)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ==================== MATH TOOL ====================

function executeMathTool(toolName: string, args: Record<string, any>): string {
    try {
        const a = BigInt(args.a);
        const b = BigInt(args.b);
        let result: bigint;
        switch (toolName) {
            case 'math_add': result = a + b; break;
            case 'math_subtract': result = a - b; break;
            case 'math_multiply': result = a * b; break;
            default: return 'Unknown math operation';
        }
        return result.toString();
    } catch {
        const a = parseFloat(args.a);
        const b = parseFloat(args.b);
        let result: number;
        switch (toolName) {
            case 'math_add': result = a + b; break;
            case 'math_subtract': result = a - b; break;
            case 'math_multiply': result = a * b; break;
            default: return 'Unknown math operation';
        }
        return result.toString();
    }
}

// ==================== MAIN COMPONENT ====================

export default function OrchestratorInterface() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I am the **Maxcavator Orchestrator**. I use a multi-phase pipeline to find precise answers across your documents with full transparency. Ask me anything!" }
    ]);
    const [input, setInput] = useState("");
    const [pipelineState, setPipelineState] = useState<'idle' | 'running'>('idle');
    const [statusText, setStatusText] = useState('');
    const [liveSteps, setLiveSteps] = useState<OrchestratorStep[]>([]);

    const [focusModalOpen, setFocusModalOpen] = useState(false);
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
            setLocation(location.split('?')[0] + (newSearch ? '?' + newSearch : ''), { replace: true });
        }
    }, [focusedIds, location, searchString, setLocation]);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, pipelineState, liveSteps]);

    const handleSend = async () => {
        if (!input.trim() || pipelineState !== 'idle') return;

        const userMsg = input;
        setInput('');

        const chatHistory = messages
            .filter(m => !m.error)
            .map(m => ({ role: m.role, content: m.content }));

        const priorSources: SourceChunk[] = [];
        for (const m of messages) {
            if (m.sources) {
                m.sources.forEach((s) => {
                    priorSources.push({
                        ...s,
                        source_id: `prior_doc_${priorSources.length}`
                    });
                });
            }
        }

        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setPipelineState('running');
        setStatusText('Starting autonomous agent loop...');
        setLiveSteps([]);

        const steps: OrchestratorStep[] = [];
        let collectedChunks: SourceChunk[] = [];
        let accumulator = "";
        let searchCount = 0;
        const startTime = Date.now();

        // --- Mapping for LLM to avoid UUID hallucinations ---
        const uuidMap = new Map<string, number>();
        const indexMap = new Map<number, string>();
        let nextMapId = 1;

        const getShortId = (uuid?: string) => {
            if (!uuid) return "None";
            if (!uuidMap.has(uuid)) {
                uuidMap.set(uuid, nextMapId);
                indexMap.set(nextMapId, uuid);
                nextMapId++;
            }
            return uuidMap.get(uuid);
        };
        const getUuid = (shortId: any) => indexMap.get(Number(shortId));
        // ---------------------------------------------------

        const addStep = (step: OrchestratorStep) => {
            steps.push(step);
            setLiveSteps([...steps]);
        };

        const pushChunks = (chunks: any[]) => {
            const seenIds = new Set(collectedChunks.map(c => c.id));
            for (const c of chunks) {
                if (!seenIds.has(c.id)) {
                    seenIds.add(c.id);
                    collectedChunks.push({ id: c.id, document_id: c.document_id, page_number: c.page_number, text_summary: c.text_summary, filename: c.filename, table_name: c.table_name });
                }
            }
        };

        try {
            while (true) {
                const timeElapsedMs = Date.now() - startTime;

                // 1. Prepare collected chunks summary for the AI
                let collectedChunksSummary = "";
                if (collectedChunks.length > 0) {
                    collectedChunksSummary = `Currently holding ${collectedChunks.length} chunks. Preview of top 5:\n`;
                    collectedChunks.slice(0, 5).forEach(c => {
                        collectedChunksSummary += `- Chunk ID: ${getShortId(c.id)}\n  Table ID: ${getShortId(c.pdf_table_id)}\n  Document: ${c.filename || 'Unknown'}, Table: ${c.table_name || 'None'}\n  Content preview: ${c.text_summary.substring(0, 150)}...\n`;
                    });
                }

                setStatusText('Controller Agent is thinking...');
                const controllerStart = Date.now();

                // 2. Call controller
                const decision = await apiService.orchestratorController(
                    userMsg,
                    chatHistory,
                    accumulator,
                    searchCount,
                    timeElapsedMs,
                    collectedChunksSummary
                );

                const { action, action_input } = decision;

                addStep({
                    phase: 'Controller', type: 'ai',
                    input_summary: `State: ${searchCount} searches, ${collectedChunks.length} chunks`,
                    output_summary: `Decided action: ${action}`,
                    full_input: { accumulator, searchCount, timeElapsedMs, collected_chunks: collectedChunks.length },
                    full_output: decision,
                    duration_ms: Date.now() - controllerStart, status: 'success'
                });

                // 3. Execute action
                if (action === 'search_tier_1' || action === 'search_tier_2' || action === 'search_tier_3') {
                    const query = action_input.query || userMsg;
                    setStatusText(`Executing ${action} for "${query}"...`);

                    const embedStart = Date.now();
                    let queryEmbedding: number[][] = [];
                    try {
                        queryEmbedding = await apiService.generateEmbeddings([query]);
                        addStep({ phase: 'Embedding', type: 'frontend', tool_name: 'generateEmbeddings', input_summary: `"${query}"`, output_summary: '768-dim vector generated', full_input: { query }, full_output: { embedding_length: queryEmbedding[0]?.length }, duration_ms: Date.now() - embedStart, status: 'success' });
                    } catch (e: any) {
                        addStep({ phase: 'Embedding', type: 'frontend', tool_name: 'generateEmbeddings', input_summary: `"${query}"`, output_summary: `Failed: ${e.message}`, full_input: { query }, full_output: { error: e.message }, duration_ms: Date.now() - embedStart, status: 'error' });
                        accumulator += `\n[Action: ${action}] Failed to generate embedding for "${query}". Error: ${e.message}`;
                        continue; // skip to next loop iteration
                    }

                    if (!queryEmbedding || queryEmbedding.length === 0) {
                        accumulator += `\n[Action: ${action}] Embedding failed (empty result) for "${query}".`;
                        continue;
                    }
                    const emb = queryEmbedding[0];
                    searchCount++;

                    let newChunks: any[] = [];
                    const searchStart = Date.now();

                    if (action === 'search_tier_1') {
                        newChunks = await dbService.topDownSemanticSearch(emb, 7, focusedIds);
                    } else if (action === 'search_tier_2') {
                        newChunks = await dbService.semanticTableChunkSearch(emb, 7, focusedIds);
                    } else {
                        newChunks = await dbService.semanticChunkSearch(emb, 7, focusedIds);
                    }

                    const newUniqueCount = newChunks.filter(c => !collectedChunks.find(existing => existing.id === c.id)).length;
                    pushChunks(newChunks);

                    addStep({ phase: 'Semantic Search', type: 'frontend', tool_name: action, input_summary: `"${query}"`, output_summary: `Found ${newChunks.length} chunks (${newUniqueCount} new)`, full_input: { query, tier: action }, full_output: newChunks.map((c: any) => ({ filename: c.filename, table: c.table_name, page: c.page_number, sim: c.similarity_score })), duration_ms: Date.now() - searchStart, status: 'success' });

                    accumulator += `\n[Action: ${action}] Executed search for "${query}". Found ${newChunks.length} chunks (${newUniqueCount} were new). Total chunks now: ${collectedChunks.length}.`;
                }
                else if (action === 'get_nearby_rows') {
                    const mappedChunkId = action_input.chunk_id;
                    const chunkId = getUuid(mappedChunkId);
                    const direction = action_input.direction || 'both';
                    const count = action_input.count || 5;

                    if (!chunkId) {
                        accumulator += `\n[Action: get_nearby_rows] Failed. Invalid chunk_id mapped ID ${mappedChunkId}.`;
                        continue;
                    }

                    setStatusText(`Fetching nearby rows for chunk...`);
                    const fetchStart = Date.now();
                    const nearbyChunks = await dbService.getNearbyChunks(chunkId, direction, count);

                    if (nearbyChunks && nearbyChunks.length > 0) {
                        const newUniqueCount = nearbyChunks.filter(c => !collectedChunks.find(existing => existing.id === c.id)).length;
                        pushChunks(nearbyChunks);

                        addStep({ phase: 'Semantic Search', type: 'frontend', tool_name: 'getNearbyChunks', input_summary: `${direction} ${count} context rows`, output_summary: `Found ${nearbyChunks.length} adjacent rows (${newUniqueCount} new)`, full_input: { chunk_id: chunkId, direction, count }, full_output: nearbyChunks.map(c => ({ data: c.data })), duration_ms: Date.now() - fetchStart, status: 'success' });
                        accumulator += `\n[Action: get_nearby_rows] Fetched ${nearbyChunks.length} adjacent rows.`;
                    } else {
                        addStep({ phase: 'Semantic Search', type: 'frontend', tool_name: 'getNearbyChunks', input_summary: `${direction} ${count} rows`, output_summary: `No adjacent rows found`, full_input: { chunk_id: mappedChunkId, direction, count }, full_output: [], duration_ms: Date.now() - fetchStart, status: 'success' });
                        accumulator += `\n[Action: get_nearby_rows] No adjacent rows found for chunk_id ${mappedChunkId}.`;
                    }
                }
                else if (action === 'get_table_info') {
                    const mappedTableId = action_input.table_id;
                    const tableId = getUuid(mappedTableId);

                    if (!tableId) {
                        accumulator += `\n[Action: get_table_info] Failed. Invalid table_id mapped ID ${mappedTableId}.`;
                        continue;
                    }

                    setStatusText(`Fetching schema for table...`);
                    const fetchStart = Date.now();
                    const tableInfo = await dbService.getTableInfo(tableId);

                    if (tableInfo) {
                        // Create a mock chunk out of the table metadata
                        const schemaChunk = {
                            id: `schema_${tableId}`,
                            pdf_table_id: tableId,
                            text_summary: `TABLE SCHEMA & NOTES for '${tableInfo.table_name}':\nSummary: ${tableInfo.summary}\nNotes: ${tableInfo.notes || 'None'}\nColumns: ${JSON.stringify(tableInfo.schema_json)}`,
                            table_name: tableInfo.table_name,
                            page_number: tableInfo.page_number
                        };
                        pushChunks([schemaChunk]);

                        addStep({ phase: 'Semantic Search', type: 'frontend', tool_name: 'getTableInfo', input_summary: `Context for ${mappedTableId}`, output_summary: `Loaded schema and notes for ${tableInfo.table_name}`, full_input: { table_id: mappedTableId }, full_output: tableInfo, duration_ms: Date.now() - fetchStart, status: 'success' });
                        accumulator += `\n[Action: get_table_info] Loaded full schema and context notes for table '${tableInfo.table_name}'.`;
                    } else {
                        addStep({ phase: 'Semantic Search', type: 'frontend', tool_name: 'getTableInfo', input_summary: `Table ID: ${mappedTableId}`, output_summary: `Table not found`, full_input: { table_id: mappedTableId }, full_output: null, duration_ms: Date.now() - fetchStart, status: 'error' });
                        accumulator += `\n[Action: get_table_info] Failed. Table ID ${mappedTableId} not found in DB.`;
                    }
                }
                else if (action === 'analyze_chunks') {
                    if (collectedChunks.length === 0) {
                        accumulator += `\n[Action: analyze_chunks] Skipped because no chunks are collected yet.`;
                        continue;
                    }
                    setStatusText('Phase 3: Filtering relevant context...');
                    const chunksForAnalysis: SourceChunk[] = collectedChunks.map((c, i) => ({
                        ...c,
                        source_id: `doc_${i}`
                    }));

                    const analyzeStart = Date.now();
                    const analysis = await apiService.orchestratorAnalyze(userMsg, chunksForAnalysis, "data_lookup", [userMsg]);

                    const keptIds = new Set(analysis.assessments
                        .filter(a => a.keep)
                        .map(a => a.source_id)
                        .filter((sid): sid is string => !!sid)
                    );
                    const curatedChunks = chunksForAnalysis.filter(c => keptIds.has(c.source_id!));

                    addStep({ phase: 'Context Analyst', type: 'ai', input_summary: `${chunksForAnalysis.length} raw chunks`, output_summary: `Kept ${curatedChunks.length}/${chunksForAnalysis.length} — discarded ${chunksForAnalysis.length - curatedChunks.length} irrelevant`, full_input: { chunks_count: chunksForAnalysis.length }, full_output: analysis.assessments, duration_ms: Date.now() - analyzeStart, status: 'success' });

                    collectedChunks = curatedChunks;
                    accumulator += `\n[Action: analyze_chunks] Analyzed ${chunksForAnalysis.length} chunks, kept ${curatedChunks.length} relevant ones.`;
                }
                else if (action === 'math') {
                    setStatusText('Computing math operation...');
                    const op = action_input;
                    const mathStart = Date.now();
                    const toolName = op.op === 'add' ? 'math_add' : op.op === 'subtract' ? 'math_subtract' : 'math_multiply';
                    const result = executeMathTool(toolName, { a: op.a, b: op.b });
                    const summary = `${op.a} ${op.op === 'add' ? '+' : op.op === 'subtract' ? '-' : '×'} ${op.b} = ${result}`;

                    addStep({ phase: 'Math', type: 'frontend', tool_name: toolName, input_summary: `${op.a} ${op.op} ${op.b}`, output_summary: result, full_input: op, full_output: result, duration_ms: Date.now() - mathStart, status: 'success' });

                    accumulator += `\n[Action: math] Computed ${summary}.`;
                }
                else if (action === 'meta_query') {
                    setStatusText('Fetching metadata...');
                    const metaStart = Date.now();
                    const tables = await dbService.getPdfTables();
                    const docs = await dbService.getAllDocuments();

                    addStep({ phase: 'List Topics', type: 'frontend', tool_name: 'getPdfTables + getAllDocuments', input_summary: 'Fetching all tables and documents', output_summary: `${tables.length} tables, ${docs.length} documents`, full_input: {}, full_output: { tables_count: tables.length, docs_count: docs.length }, duration_ms: Date.now() - metaStart, status: 'success' });

                    const metaChunks: SourceChunk[] = tables.slice(0, 10).map((t: any, i: number) => ({
                        id: `meta_${i}`,
                        document_id: 'metadata',
                        source_id: `doc_${i}`,
                        filename: 'Database Metadata',
                        table_name: t.table_name,
                        text_summary: t.summary || t.table_name,
                        page_number: 1
                    }));
                    pushChunks(metaChunks);
                    accumulator += `\n[Action: meta_query] Found ${docs.length} documents and ${tables.length} tables. Added top tables to collected chunks.`;
                }
                else if (action === 'synthesize') {
                    setStatusText('Phase 4: Composing final answer with citations...');
                    const synthStart = Date.now();

                    // Assign temporary source_ids if they don't have them
                    const finalChunks = collectedChunks.map((c, i) => ({
                        ...c,
                        source_id: c.source_id || `doc_${i}`
                    }));

                    const synthResult = await apiService.orchestratorSynthesize(userMsg, finalChunks, chatHistory, priorSources.length > 0 ? priorSources : undefined);

                    addStep({ phase: 'Synthesizer', type: 'ai', input_summary: `${finalChunks.length} curated chunks`, output_summary: `Answer generated with ${synthResult.used_source_ids.length} citations`, full_input: { chunks_count: finalChunks.length, has_prior_sources: priorSources.length > 0, accumulator }, full_output: { response_preview: synthResult.response.substring(0, 200), used_source_ids: synthResult.used_source_ids }, duration_ms: Date.now() - synthStart, status: 'success' });

                    // Collect all potential sources (current + prior) for rendering
                    const allAvailableSources: SourceChunk[] = [
                        ...finalChunks, // Already has source_id as doc_N
                        ...priorSources // Already has source_id as prior_doc_N
                    ];

                    // Map used_source_ids back to internal UUIDs for the CitationGroup component
                    const sourceIdToUUID: Record<string, string> = {};
                    allAvailableSources.forEach(s => { if (s.source_id && s.id) sourceIdToUUID[s.source_id] = s.id; });

                    const usedChunkUUIDs = synthResult.used_source_ids
                        .map(sid => sourceIdToUUID[sid])
                        .filter((id): id is string => !!id);

                    setMessages(prev => [...prev, {
                        role: 'assistant', content: synthResult.response,
                        sources: allAvailableSources,
                        used_chunk_ids: usedChunkUUIDs.length > 0 ? usedChunkUUIDs : finalChunks.map(c => c.id),
                        v2_steps: steps
                    }]);
                    break; // EXIT LOOP
                }
                else if (action === 'general_chat') {
                    const response = action_input.response || "I'm not sure what to say.";
                    setMessages(prev => [...prev, { role: 'assistant', content: response, v2_steps: steps }]);
                    break; // EXIT LOOP
                }
                else {
                    accumulator += `\n[Action: Unknown] The controller provided an unknown action: ${action}.`;
                }
            } // end while

        } catch (e: any) {
            steps.push({ phase: 'Error', type: 'ai', input_summary: '', output_summary: e.message, duration_ms: 0, status: 'error' });
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error while processing your request.', error: e.message, v2_steps: steps }]);
        } finally {
            setPipelineState('idle');
            setStatusText('');
            setLiveSteps([]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-50/50 dark:from-purple-950/20 via-slate-50 dark:via-slate-950 to-amber-50/30 dark:to-amber-950/10 pointer-events-none" />

            {/* Header */}
            <div className="px-5 py-3 border-b border-purple-100 dark:border-purple-500/20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-10 sticky top-0">
                <div className="flex items-center gap-2.5">
                    <div className="bg-purple-100 dark:bg-purple-500/20 p-1.5 rounded-lg border border-purple-200 dark:border-purple-500/30 shadow-[0_0_15px_rgba(147,51,234,0.1)] dark:shadow-[0_0_15px_rgba(147,51,234,0.2)]">
                        <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-purple-900 dark:text-purple-100 tracking-wide">Maxcavator Orchestrator</h2>
                        <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80">Multi-Phase Pipeline · 3-Tier Retrieval</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 z-10" ref={scrollRef}>
                <div className="space-y-6 max-w-3xl mx-auto pb-32">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>

                                {/* V2 Step Log */}
                                {m.role === 'assistant' && m.v2_steps && m.v2_steps.length > 0 && (
                                    <OrchestratorV2StepLog steps={m.v2_steps} />
                                )}

                                <div className={`relative ${m.role === 'user'
                                    ? 'bg-purple-600 text-white px-5 py-3 rounded-3xl rounded-tr-md text-[15px] leading-relaxed shadow-sm dark:shadow-md shadow-purple-900/10 dark:shadow-purple-900/20'
                                    : 'py-2 text-slate-800 dark:text-slate-200 w-full'
                                    }`}>
                                    {m.role === 'assistant' ? renderMessageWithInlineCitations(m.content, m.sources) : <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>}
                                </div>

                                {m.error && (
                                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-500/20 mt-1">
                                        <strong>Error:</strong> {m.error}
                                    </div>
                                )}

                                {m.sources && m.used_chunk_ids && m.used_chunk_ids.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-1 border-l-2 pl-3 border-purple-200 dark:border-purple-500/30">
                                        <CitationGroup sources={m.used_chunk_ids.map(id => m.sources?.find(s => s.id === id)).filter((s): s is SourceChunk => !!s)} />
                                    </div>
                                )}

                                {m.sources && m.sources.length > 0 && <SourceDropdown sources={m.sources} />}
                            </div>
                        </div>
                    ))}

                    {/* Minimalist Loading State */}
                    {pipelineState === 'running' && (
                        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="py-3 px-4 flex flex-col gap-2 rounded-2xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200/50 dark:border-purple-500/20 max-w-[85%]">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                                    </div>
                                    <span className="text-[13px] font-semibold text-purple-700 dark:text-purple-300">
                                        {statusText}
                                    </span>
                                </div>
                                {liveSteps.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1 ml-6">
                                        {liveSteps.map((step, idx) => {
                                            const Icon = PHASE_ICONS[step.phase] || Cog;
                                            return (
                                                <div key={idx} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-white/60 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-400">
                                                    <Icon className="w-3 h-3 text-purple-500/70" />
                                                    <span className="font-medium truncate max-w-[80px]">{step.phase}</span>
                                                    {idx < liveSteps.length - 1 && <ChevronRight className="w-2 h-2 ml-0.5 opacity-50" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input */}
            <div className={`p-4 border-t bg-background/80 backdrop-blur-sm sticky bottom-0 z-20 ${focusedIds.length > 0 ? 'border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/20' : 'border-purple-100 dark:border-purple-500/20'}`}>
                <div className="max-w-3xl mx-auto flex flex-col gap-3 relative">
                    {/* Render Focused Document Chips */}
                    {focusedIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700/80 dark:text-purple-400/80 flex items-center pr-2">
                                <MessageSquare className="w-3.5 h-3.5 mr-1" /> Focus Mode:
                            </span>
                            {focusedIds.map(fid => {
                                const docJob = jobs[fid];
                                if (!docJob) return null;
                                return (
                                    <div key={fid} className="flex items-center gap-0 bg-purple-100/50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 rounded-full pl-1 pr-1 py-0.5 text-xs font-medium relative group shadow-sm transition-all hover:bg-purple-100 dark:hover:bg-purple-900/50 hover:border-purple-300 dark:hover:border-purple-700">
                                        <DocumentViewerModal docId={fid}>
                                            <div className="flex items-center gap-1.5 pl-1.5 pr-1 cursor-pointer hover:underline decoration-purple-300 dark:decoration-purple-700 underline-offset-2">
                                                <FileText className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                                                <span className="truncate max-w-[150px]">{docJob.filename}</span>
                                            </div>
                                        </DocumentViewerModal>
                                        <div className="h-3.5 w-px bg-purple-200/60 dark:bg-purple-800/60 mx-1" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 hover:text-purple-900 dark:hover:text-purple-100 shrink-0 transition-colors"
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
                                <Button variant="outline" size="icon" className={`shrink-0 rounded-full h-11 w-11 shadow-sm relative transition-colors ${focusedIds.length > 0 ? 'border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20' : ''}`}>
                                    <Plus className="h-5 w-5" />
                                    {focusedIds.length > 0 && (
                                        <span className="absolute top-0 right-0 -mr-1 -mt-1 flex h-3 w-3">
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[240px]">
                                <div className="px-2 py-1.5 text-sm font-semibold flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-purple-500" />
                                    Chat Context
                                </div>
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => setFocusModalOpen(true)}
                                >
                                    <div className="flex flex-col gap-1 w-full">
                                        <span className="font-medium text-purple-600 dark:text-purple-400">Select Focus Documents...</span>
                                        <span className="text-xs text-muted-foreground leading-snug">
                                            Restrict orchestrator to specific PDFs.
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex-1 flex gap-2 items-end transition-all relative">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className={`absolute left-2.5 bottom-1.5 h-8 w-8 rounded-full z-20 hidden sm:flex border-0 transition-colors ${focusedIds.length > 0 ? 'bg-purple-50/80 hover:bg-purple-100/80 dark:bg-purple-900/40 dark:hover:bg-purple-800/60 text-purple-600 dark:text-purple-400' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                                onClick={() => setFocusModalOpen(true)}
                                title="Select specific documents to focus on"
                            >
                                {focusedIds.length > 0 ? <MessageSquare className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {focusedIds.length > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-purple-600 text-[8px] font-bold text-white shadow-sm ring-1 ring-background">
                                        {focusedIds.length}
                                    </span>
                                )}
                            </Button>
                            <AutoResizeTextarea
                                placeholder={focusedIds.length > 0 ? `Ask about ${focusedIds.length} focused document${focusedIds.length !== 1 ? 's' : ''}...` : "Ask the Orchestrator anything..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onEnter={() => {
                                    if (pipelineState === 'idle' && input.trim()) handleSend();
                                }}
                                disabled={pipelineState !== 'idle'}
                                className={`border shadow-sm focus-visible:ring-1 bg-background sm:pl-12 px-4 py-3 min-h-[44px] rounded-3xl ${focusedIds.length > 0 ? 'border-purple-400/50 ring-purple-500/40 focus-visible:border-purple-500 placeholder:text-purple-500/50 dark:placeholder:text-purple-400/50 font-medium' : 'border-purple-200/50 focus-visible:ring-purple-500 dark:border-purple-800/50 dark:focus-visible:ring-purple-400'} w-full transition-all`}
                            />
                            <Button
                                onClick={handleSend}
                                disabled={pipelineState !== 'idle' || !input.trim()}
                                size="icon"
                                className={`rounded-full shadow-sm shrink-0 h-[44px] w-[44px] transition-colors ${focusedIds.length > 0 ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 text-white dark:text-purple-950'}`}
                            >
                                {pipelineState !== 'idle' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
                            </Button>
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="text-[10px] text-purple-500/60 dark:text-purple-400/50">
                            Multi-phase pipeline: Intent Router → 3-Tier Retrieval → Context Analyst → Synthesizer
                        </p>
                    </div>

                    <DocumentSelectionModal
                        open={focusModalOpen}
                        onOpenChange={setFocusModalOpen}
                    />
                </div>
            </div>
        </div>
    );
}
