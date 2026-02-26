import { ExtractionDebugModal } from "@/components/extraction-debug-modal"
import { PdfInspectionModal } from "@/components/pdf-inspection-modal"
import { DeleteConfirmModal } from "@/components/delete-confirm-modal"
import { useExtractionStore } from '@/store/extraction-store';
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FileText, Play, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from "@/components/ui/button"
import * as React from 'react'

// Truncate filename to max length with ellipsis
const truncateFilename = (filename: string, maxLength: number = 22) => {
    if (filename.length <= maxLength) return filename;
    const ext = filename.slice(filename.lastIndexOf('.'));
    const nameLength = maxLength - ext.length - 3; // -3 for '...'
    return filename.slice(0, nameLength) + '...' + ext;
};

export function ProcessingQueue({ highlightedJobId }: { highlightedJobId?: string | null }) {
    const jobs = useExtractionStore((state) => state.jobs);
    const pauseJob = useExtractionStore((state) => state.pauseJob);
    const startJob = useExtractionStore((state) => state.startJob);
    const dismissJob = useExtractionStore((state) => state.dismissJob);

    // Track which cards are manually collapsed
    const [collapsedIds, setCollapsedIds] = React.useState<Record<string, boolean>>({});

    const toggleCollapse = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const activeJobs = Object.values(jobs)
        .filter(j => !j.dismissed_from_queue)
        .sort((a, b) => {
            if (a.status === 'processing') return -1;
            if (b.status === 'processing') return 1;
            return 0;
        });

    if (activeJobs.length === 0) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm">
                No active uploads.
            </div>
        )
    }

    return (
        <ScrollArea className="h-full w-full">
            <div className="space-y-3 p-3 w-full max-w-full overflow-x-hidden">
                {activeJobs.map((job) => {
                    const isCollapsed = collapsedIds[job.documentId];
                    const progress = Math.round((job.processedPages / (job.totalPages || 1)) * 100);

                    return (
                        <div
                            key={job.documentId}
                            onClick={(e) => isCollapsed ? toggleCollapse(job.documentId, e) : undefined}
                            className={`group border rounded-lg p-3 flex flex-col gap-3 bg-card transition-all duration-300 w-full overflow-hidden shrink-0 ${isCollapsed ? 'cursor-pointer hover:border-primary/50' : ''} ${highlightedJobId === job.documentId ? 'ring-2 ring-primary/50 shadow-md' : ''}`}
                        >
                            {/* Top Row: Icon, Name, (Hover Controls), Status Icon */}
                            <div className="flex items-center justify-between gap-2 w-full min-w-0">
                                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <div className="flex flex-col flex-1 min-w-0 overflow-hidden w-full">
                                        <span className="text-sm font-medium truncate block w-full" title={job.filename}>
                                            {truncateFilename(job.filename)}
                                        </span>
                                        {isCollapsed && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Progress value={progress} className="h-1 flex-1 bg-secondary w-full" />
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 leading-none">
                                                    {job.processedPages}/{job.totalPages || 1}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right side controls */}
                                <div className="flex items-center gap-1 shrink-0 relative bg-card">
                                    {/* Action buttons (only visible on group hover) */}
                                    <div className="absolute right-full top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto bg-card pl-3 pr-1 py-1 mr-1">
                                        {job.debugInfo && (
                                            <ExtractionDebugModal
                                                debugInfo={job.debugInfo}
                                            />
                                        )}
                                        {job.file && (
                                            <PdfInspectionModal docId={job.documentId} iconOnly />
                                        )}
                                        <DeleteConfirmModal documentId={job.documentId} filename={job.filename} iconOnly />
                                        {job.status === 'completed' && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); dismissJob(job.documentId); }} title="Dismiss from queue">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Constant Status Icon */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="ml-2 z-10 flex items-center justify-center h-full">
                                                <div className={`w-2.5 h-2.5 rounded-full ${job.status === 'completed' ? 'bg-green-500' : job.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-[95vw] wrap-break-word">
                                            <p>{getStatusText(job)}</p>
                                        </TooltipContent>
                                    </Tooltip>

                                    {/* Collapse Toggle */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground shrink-0 z-10 bg-card"
                                        onClick={(e) => toggleCollapse(job.documentId, e)}
                                    >
                                        {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            {/* Collapsible Content */}
                            {!isCollapsed && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>{getStatusText(job)}</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <Progress value={progress} className="h-2" />
                                    </div>

                                    {/* Bottom Controls (Extract/Pause) */}
                                    <div className="flex justify-end gap-1.5 mt-2">
                                        {(job.status === 'queued' || job.status === 'paused' || job.status === 'error') && job.file && (
                                            <Button size="sm" onClick={() => startJob(job.documentId)} className="gap-1.5 text-xs h-7">
                                                <Play className="h-3 w-3" /> {job.status === 'paused' ? "Resume" : "Extract"}
                                            </Button>
                                        )}
                                        {job.status === 'processing' && (
                                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => pauseJob(job.documentId)}>Pause</Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}

function getStatusText(job: any) {
    if (job.status === 'completed') return 'Done';
    if (job.status === 'error') return 'Failed';
    if (job.status === 'queued') return 'Queued...';
    if (job.status === 'paused') return 'Paused';
    return `Scanning page ${job.processedPages} / ${job.totalPages}...`;
}
