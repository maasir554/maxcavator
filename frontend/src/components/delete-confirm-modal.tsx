import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle } from 'lucide-react'
import { useExtractionStore } from '@/store/extraction-store'

interface DeleteConfirmModalProps {
    documentId: string
    filename: string
    iconOnly?: boolean
}

export function DeleteConfirmModal({ documentId, filename, iconOnly }: DeleteConfirmModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const trashJob = useExtractionStore(state => state.trashJob)
    const trashAutoDeleteHours = useExtractionStore(state => state.trashAutoDeleteHours)

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await trashJob(documentId)
            setIsOpen(false)
        } catch (e) {
            console.error("Failed to trash document:", e)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            {iconOnly ? (
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    onClick={() => setIsOpen(true)}
                    title="Delete"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            ) : (
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setIsOpen(true)}
                    title="Delete"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Move to Trash?
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{filename}</span> will be moved to Trash.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Items in Trash are automatically deleted after {trashAutoDeleteHours} hour{trashAutoDeleteHours !== 1 ? 's' : ''}.
                            You can restore it from the Trash tab before then.
                        </p>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? "Moving..." : "Move to Trash"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
