import { ExtractionDebugModal } from "@/components/extraction-debug-modal"
import { PdfInspectionModal } from "@/components/pdf-inspection-modal"
import { useExtractionStore } from '@/store/extraction-store';
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Loader2, CheckCircle, AlertCircle, PauseCircle, Play } from 'lucide-react'
import { Button } from "@/components/ui/button"

// Truncate filename to max length with ellipsis
const truncateFilename = (filename: string, maxLength: number = 30) => {
    if (filename.length <= maxLength) return filename;
    const ext = filename.slice(filename.lastIndexOf('.'));
    const nameLength = maxLength - ext.length - 3; // -3 for '...'
    return filename.slice(0, nameLength) + '...' + ext;
};

export function ProcessingQueue() {
    const jobs = useExtractionStore((state) => state.jobs);
    const pauseJob = useExtractionStore((state) => state.pauseJob);
    const resumeJob = useExtractionStore((state) => state.resumeJob);
    const startJob = useExtractionStore((state) => state.startJob);

    const activeJobs = Object.values(jobs).sort((a, b) => {
        // Sort by status (processing first), then time (implied by insertion order if docId is UUID/Time)
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
        <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
                <h3 className="font-semibold text-sm">Processing Queue</h3>
                {activeJobs.map((job) => (
                    <div key={job.documentId} className="border rounded-lg p-3 space-y-3 bg-card">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2 overflow-hidden">
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm font-medium truncate" title={job.filename}>
                                    {truncateFilename(job.filename)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {job.debugInfo && (
                                    <ExtractionDebugModal
                                        debugInfo={job.debugInfo}
                                        maxPage={job.processedPages}
                                    />
                                )}
                                {getIcon(job.status)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{getStatusText(job)}</span>
                                <span>{Math.round((job.processedPages / (job.totalPages || 1)) * 100)}%</span>
                            </div>
                            <Progress value={(job.processedPages / (job.totalPages || 1)) * 100} className="h-2" />
                        </div>

                        <div className="flex justify-end gap-2 mt-2">
                            <PdfInspectionModal docId={job.documentId} file={job.file!} />

                            {(job.status === 'queued' || job.status === 'paused' || job.status === 'error') && (
                                <Button size="sm" onClick={() => startJob(job.documentId)} className="gap-2">
                                    <Play className="h-3 w-3" /> {job.status === 'paused' ? "Resume" : "Start Extraction"}
                                </Button>
                            )}
                            {job.status === 'processing' && (
                                <Button size="sm" variant="outline" onClick={() => pauseJob(job.documentId)}>Pause</Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}

function getIcon(status: string) {
    switch (status) {
        case 'processing': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
        case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
        case 'paused': return <PauseCircle className="h-4 w-4 text-yellow-500" />;
        default: return <div className="h-4 w-4" />;
    }
}

function getStatusText(job: any) {
    if (job.status === 'completed') return 'Done';
    if (job.status === 'error') return 'Failed';
    if (job.status === 'queued') return 'Queued...';
    if (job.status === 'paused') return 'Paused';
    return `Scanning page ${job.processedPages} / ${job.totalPages}...`;
}
