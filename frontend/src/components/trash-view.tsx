import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trash2, RotateCcw, Clock, AlertTriangle, Settings2, XCircle } from 'lucide-react'
import { useExtractionStore } from '@/store/extraction-store'
import type { TrashedJob } from '@/store/extraction-store'

const DURATION_OPTIONS = [
    { label: '1 hour', value: 1 },
    { label: '2 hours', value: 2 },
    { label: '5 hours', value: 5 },
    { label: '12 hours', value: 12 },
    { label: '24 hours', value: 24 },
    { label: '48 hours', value: 48 },
]

function timeRemaining(deletedAt: string, autoDeleteHours: number): string {
    const deletedTime = new Date(deletedAt).getTime()
    const expiresAt = deletedTime + autoDeleteHours * 60 * 60 * 1000
    const remainingMs = expiresAt - Date.now()

    if (remainingMs <= 0) return 'Expired'

    const hours = Math.floor(remainingMs / (1000 * 60 * 60))
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) return `${hours}h ${minutes}m remaining`
    return `${minutes}m remaining`
}

function timeSince(dateStr: string): string {
    const ms = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(ms / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export default function TrashView() {
    const trashedJobs = useExtractionStore(state => state.trashedJobs)
    const restoreJob = useExtractionStore(state => state.restoreJob)
    const permanentlyDeleteJob = useExtractionStore(state => state.permanentlyDeleteJob)
    const emptyTrash = useExtractionStore(state => state.emptyTrash)
    const trashAutoDeleteHours = useExtractionStore(state => state.trashAutoDeleteHours)
    const setTrashAutoDeleteHours = useExtractionStore(state => state.setTrashAutoDeleteHours)

    const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [isEmptying, setIsEmptying] = useState(false)

    const items = Object.values(trashedJobs)

    const handleEmptyTrash = async () => {
        setIsEmptying(true)
        try {
            await emptyTrash()
            setEmptyConfirmOpen(false)
        } finally {
            setIsEmptying(false)
        }
    }

    const handlePermanentDelete = async (id: string) => {
        await permanentlyDeleteJob(id)
        setDeleteConfirmId(null)
    }

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Settings bar */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Settings2 className="h-4 w-4" />
                    <span>Auto-delete after</span>
                    <select
                        value={trashAutoDeleteHours}
                        onChange={(e) => setTrashAutoDeleteHours(Number(e.target.value))}
                        className="rounded-md border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        {DURATION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                {items.length > 0 && (
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setEmptyConfirmOpen(true)}
                        className="gap-2"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Empty Trash
                    </Button>
                )}
            </div>

            {/* Trash list */}
            {items.length === 0 ? (
                <Card className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground py-12">
                        <Trash2 className="h-10 w-10 opacity-30" />
                        <p className="text-sm">Trash is empty.</p>
                    </div>
                </Card>
            ) : (
                <Card className="flex-1 overflow-hidden flex flex-col">
                    <CardHeader className="pb-3 shrink-0">
                        <CardTitle className="text-sm font-medium">
                            {items.length} item{items.length !== 1 ? 's' : ''} in Trash
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full">
                            <div className="space-y-1 px-6 pb-4">
                                {items.map((job: TrashedJob) => (
                                    <div
                                        key={job.documentId}
                                        className="flex items-center gap-3 p-3 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors group"
                                    >
                                        <Trash2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{job.filename}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                <span>Deleted {timeSince(job.deletedAt)}</span>
                                                <span>·</span>
                                                <span className="text-destructive/70">
                                                    {timeRemaining(job.deletedAt, trashAutoDeleteHours)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 gap-1.5 text-xs"
                                                onClick={() => restoreJob(job.documentId)}
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                                Restore
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                onClick={() => setDeleteConfirmId(job.documentId)}
                                                title="Delete permanently"
                                            >
                                                <XCircle className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            {/* Empty Trash confirmation */}
            <Dialog open={emptyConfirmOpen} onOpenChange={setEmptyConfirmOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Empty Trash?
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground py-2">
                        This will permanently delete all {items.length} item{items.length !== 1 ? 's' : ''} in Trash.
                        This action cannot be undone.
                    </p>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setEmptyConfirmOpen(false)} disabled={isEmptying}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleEmptyTrash} disabled={isEmptying}>
                            {isEmptying ? "Deleting..." : "Empty Trash"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Permanent delete single item confirmation */}
            <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete Permanently?
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground py-2">
                        This will permanently delete{' '}
                        <span className="font-medium text-foreground">
                            {deleteConfirmId && trashedJobs[deleteConfirmId]?.filename}
                        </span>.
                        This action cannot be undone.
                    </p>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteConfirmId && handlePermanentDelete(deleteConfirmId)}
                        >
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
