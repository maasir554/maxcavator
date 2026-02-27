import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ChevronDown, FileText, Search, XCircle, Zap, Database, Brain, Cog, Filter, PenTool, Clock } from "lucide-react"
import { apiService } from "@/services/api-service"
import { dbService } from "@/services/db-service"
import { DocumentViewerModal } from "./document-viewer-modal"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExternalLink } from "lucide-react"

// ==================== TYPES ====================

interface SourceChunk {
    id: string;
    document_id: string;
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
                                                <pre className="text-[10px] text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-700 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                                                    {typeof step.full_input === 'string' ? step.full_input : JSON.stringify(step.full_input, null, 2)}
                                                </pre>
                                            </div>
                                            <div>
                                                <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Output</div>
                                                <pre className="text-[10px] text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-700 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                                                    {typeof step.full_output === 'string' ? step.full_output : JSON.stringify(step.full_output, null, 2)}
                                                </pre>
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
        setStatusText('Phase 1: Understanding your intent...');
        setLiveSteps([]);

        const steps: OrchestratorStep[] = [];
        const collectedChunks: SourceChunk[] = [];

        const addStep = (step: OrchestratorStep) => {
            steps.push(step);
            setLiveSteps([...steps]);
        };

        try {
            // ====== PHASE 1: Intent Classification (AI) ======
            const classifyStart = Date.now();
            const classification = await apiService.orchestratorClassify(userMsg, chatHistory);
            addStep({
                phase: 'Intent Router', type: 'ai',
                input_summary: userMsg,
                output_summary: `Intent: ${classification.intent}${classification.sub_queries.length > 0 ? ` — ${classification.sub_queries.length} search queries` : ''}`,
                full_input: { user_query: userMsg }, full_output: classification,
                duration_ms: Date.now() - classifyStart, status: 'success'
            });

            // Handle general_chat
            if (classification.intent === 'general_chat' && classification.direct_response) {
                setMessages(prev => [...prev, { role: 'assistant', content: classification.direct_response!, v2_steps: steps }]);
                return;
            }

            // Handle math
            if (classification.intent === 'math' && classification.math_ops.length > 0) {
                setStatusText('Phase 2: Computing math operations...');
                const mathResults: string[] = [];
                for (const op of classification.math_ops) {
                    const mathStart = Date.now();
                    const toolName = op.op === 'add' ? 'math_add' : op.op === 'subtract' ? 'math_subtract' : 'math_multiply';
                    const result = executeMathTool(toolName, { a: op.a, b: op.b });
                    mathResults.push(`${op.a} ${op.op === 'add' ? '+' : op.op === 'subtract' ? '-' : '×'} ${op.b} = ${result}`);
                    addStep({ phase: 'Math', type: 'frontend', tool_name: toolName, input_summary: `${op.a} ${op.op} ${op.b}`, output_summary: result, full_input: op, full_output: result, duration_ms: Date.now() - mathStart, status: 'success' });
                }
                setMessages(prev => [...prev, { role: 'assistant', content: mathResults.join('\n\n'), v2_steps: steps }]);
                return;
            }

            // Handle meta_query
            if (classification.intent === 'meta_query') {
                setStatusText('Phase 2: Fetching metadata...');
                const metaStart = Date.now();
                const tables = await dbService.getPdfTables();
                const docs = await dbService.getAllDocuments();
                addStep({ phase: 'List Topics', type: 'frontend', tool_name: 'getPdfTables + getAllDocuments', input_summary: 'Fetching all tables and documents', output_summary: `${tables.length} tables, ${docs.length} documents`, full_input: {}, full_output: { tables_count: tables.length, docs_count: docs.length }, duration_ms: Date.now() - metaStart, status: 'success' });

                setStatusText('Phase 4: Formatting response...');
                const synthStart = Date.now();
                const metaChunks: SourceChunk[] = tables.slice(0, 10).map((t: any, i: number) => ({
                    id: `meta_${i}`,
                    document_id: 'metadata',
                    source_id: `doc_${i}`,
                    filename: 'Database Metadata',
                    table_name: t.table_name,
                    text_summary: t.summary || t.table_name,
                    page_number: 1
                }));
                const synthResult = await apiService.orchestratorSynthesize(userMsg, metaChunks, chatHistory);
                addStep({ phase: 'Synthesizer', type: 'ai', input_summary: `${metaChunks.length} metadata items`, output_summary: `Generated answer (${synthResult.response.length} chars)`, full_input: { chunks_count: metaChunks.length }, full_output: { response_preview: synthResult.response.substring(0, 200) }, duration_ms: Date.now() - synthStart, status: 'success' });

                setMessages(prev => [...prev, { role: 'assistant', content: synthResult.response, v2_steps: steps }]);
                return;
            }

            // ====== PHASE 2: 3-Tier Retrieval (Frontend) ======
            setStatusText('Phase 2: Searching your documents (3-tier)...');
            const searchQueries = classification.sub_queries.length > 0 ? classification.sub_queries : [userMsg];

            for (const query of searchQueries) {
                const embedStart = Date.now();
                let queryEmbedding: number[][] = [];
                try {
                    queryEmbedding = await apiService.generateEmbeddings([query]);
                    addStep({ phase: 'Embedding', type: 'frontend', tool_name: 'generateEmbeddings', input_summary: `"${query}"`, output_summary: '768-dim vector generated', full_input: { query }, full_output: { embedding_length: queryEmbedding[0]?.length }, duration_ms: Date.now() - embedStart, status: 'success' });
                } catch (e: any) {
                    addStep({ phase: 'Embedding', type: 'frontend', tool_name: 'generateEmbeddings', input_summary: `"${query}"`, output_summary: `Failed: ${e.message}`, full_input: { query }, full_output: { error: e.message }, duration_ms: Date.now() - embedStart, status: 'error' });
                    continue;
                }

                if (!queryEmbedding || queryEmbedding.length === 0) continue;
                const emb = queryEmbedding[0];

                const seenIds = new Set(collectedChunks.map(c => c.id));
                const pushChunks = (chunks: any[]) => {
                    for (const c of chunks) {
                        if (!seenIds.has(c.id)) {
                            seenIds.add(c.id);
                            collectedChunks.push({ id: c.id, document_id: c.document_id, page_number: c.page_number, text_summary: c.text_summary, filename: c.filename, table_name: c.table_name });
                        }
                    }
                };

                // Tier 1: PDF → Table → Chunk
                const t1Start = Date.now();
                const tier1 = await dbService.topDownSemanticSearch(emb, 7, []);
                pushChunks(tier1);
                addStep({ phase: 'Semantic Search', type: 'frontend', tool_name: 'PDF→Table→Chunk', input_summary: `"${query}"`, output_summary: `${tier1.length} chunks (Tier 1)`, full_input: { query, tier: 'PDF→Table→Chunk' }, full_output: tier1.map((c: any) => ({ filename: c.filename, table: c.table_name, page: c.page_number, sim: c.similarity_score })), duration_ms: Date.now() - t1Start, status: 'success' });

                // Tier 2: Table → Chunk
                const t2Start = Date.now();
                const tier2 = await dbService.semanticTableChunkSearch(emb, 7, []);
                pushChunks(tier2);
                addStep({ phase: 'Semantic Search', type: 'frontend', tool_name: 'Table→Chunk', input_summary: `"${query}"`, output_summary: `${tier2.length} chunks (Tier 2)`, full_input: { query, tier: 'Table→Chunk' }, full_output: tier2.map((c: any) => ({ filename: c.filename, table: c.table_name, page: c.page_number, sim: c.similarity_score })), duration_ms: Date.now() - t2Start, status: 'success' });

                // Tier 3: Flat chunks
                const t3Start = Date.now();
                const tier3 = await dbService.semanticChunkSearch(emb, 7, []);
                pushChunks(tier3);
                addStep({ phase: 'Semantic Search', type: 'frontend', tool_name: 'Chunks only', input_summary: `"${query}"`, output_summary: `${tier3.length} chunks (Tier 3)`, full_input: { query, tier: 'Chunks only' }, full_output: tier3.map((c: any) => ({ filename: c.filename, table: c.table_name, page: c.page_number, sim: c.similarity_score })), duration_ms: Date.now() - t3Start, status: 'success' });
            }

            if (collectedChunks.length === 0) {
                setMessages(prev => [...prev, { role: 'assistant', content: "I couldn't find any relevant data in your documents to answer that question.", v2_steps: steps }]);
                return;
            }

            // ====== PHASE 3: Context Analyst (AI) ======
            setStatusText('Phase 3: Filtering relevant context...');
            const chunksForAnalysis: SourceChunk[] = collectedChunks.map((c, i) => ({
                ...c,
                source_id: `doc_${i}`
            }));

            const analyzeStart = Date.now();
            const analysis = await apiService.orchestratorAnalyze(userMsg, chunksForAnalysis, classification.intent, classification.sub_queries);
            const keptIds = new Set(analysis.assessments
                .filter(a => a.keep)
                .map(a => a.source_id)
                .filter((sid): sid is string => !!sid)
            );
            const curatedChunks = chunksForAnalysis.filter(c => keptIds.has(c.source_id!));

            addStep({ phase: 'Context Analyst', type: 'ai', input_summary: `${chunksForAnalysis.length} raw chunks`, output_summary: `Kept ${curatedChunks.length}/${chunksForAnalysis.length} — discarded ${chunksForAnalysis.length - curatedChunks.length} irrelevant`, full_input: { chunks_count: chunksForAnalysis.length }, full_output: analysis.assessments, duration_ms: Date.now() - analyzeStart, status: 'success' });

            const finalChunks = curatedChunks.length > 0 ? curatedChunks : chunksForAnalysis;

            // ====== PHASE 4: Synthesizer (AI) ======
            setStatusText('Phase 4: Composing answer with citations...');
            const synthStart = Date.now();
            const synthResult = await apiService.orchestratorSynthesize(userMsg, finalChunks, chatHistory, priorSources.length > 0 ? priorSources : undefined);

            addStep({ phase: 'Synthesizer', type: 'ai', input_summary: `${finalChunks.length} curated chunks`, output_summary: `Answer generated with ${synthResult.used_source_ids.length} citations`, full_input: { chunks_count: finalChunks.length, has_prior_sources: priorSources.length > 0 }, full_output: { response_preview: synthResult.response.substring(0, 200), used_source_ids: synthResult.used_source_ids }, duration_ms: Date.now() - synthStart, status: 'success' });

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

                    {/* Loading State */}
                    {pipelineState === 'running' && (
                        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="py-2 flex flex-col gap-2 border-l-2 pl-4 border-purple-200 dark:border-purple-500/40">
                                <div className="flex items-center gap-3">
                                    <Zap className="w-4 h-4 animate-pulse text-purple-500 dark:text-purple-400" />
                                    <span className="text-[13px] font-medium text-purple-700 dark:text-purple-300">{statusText}</span>
                                </div>
                                {liveSteps.length > 0 && (
                                    <div className="flex flex-col gap-1.5 ml-1">
                                        {liveSteps.map((step, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-[11px]">
                                                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                                                <span className={`px-2 py-0.5 rounded-full font-mono ${step.type === 'ai' ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/20 text-purple-800 dark:text-purple-300' : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300'}`}>
                                                    {step.phase}
                                                </span>
                                                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{step.output_summary}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-purple-100 dark:border-purple-500/20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md sticky bottom-0 z-20">
                <div className="max-w-3xl mx-auto flex flex-col gap-3 relative">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-center">
                        <div className="absolute left-3 flex items-center">
                            <Zap className="w-4 h-4 text-purple-300 dark:text-purple-500/70" />
                        </div>
                        <Input
                            placeholder="Ask the Orchestrator anything..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={pipelineState !== 'idle'}
                            className="pr-24 pl-10 py-6 rounded-2xl bg-white dark:bg-purple-950/20 border-purple-200 dark:border-purple-500/30 focus-visible:ring-purple-500/50 shadow-inner text-purple-900 dark:text-purple-100 placeholder:text-purple-400/60 dark:placeholder:text-purple-300/40"
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                            <Button type="submit" size="sm" disabled={!input.trim() || pipelineState !== 'idle'}
                                className="h-9 rounded-xl px-4 bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/10 dark:shadow-purple-900/30 transition-all font-medium"
                            >
                                {pipelineState !== 'idle' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask Orchestrator"}
                            </Button>
                        </div>
                    </form>
                    <div className="text-center">
                        <p className="text-[10px] text-purple-500/60 dark:text-purple-400/50">
                            Multi-phase pipeline: Intent Router → 3-Tier Retrieval → Context Analyst → Synthesizer
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
