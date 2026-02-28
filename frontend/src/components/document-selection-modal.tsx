import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, MessageSquare, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { useExtractionStore } from '@/store/extraction-store'
import { apiService } from '@/services/api-service'
import { dbService } from '@/services/db-service'

interface DocumentSelectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DocumentSelectionModal({ open, onOpenChange }: DocumentSelectionModalProps) {
    const jobs = useExtractionStore(state => state.jobs);
    const focusedIds = useExtractionStore(state => state.focusedDocumentIds);
    const setFocusedIds = useExtractionStore(state => state.setFocusedDocumentIds);

    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<string[] | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Filter to only completed/paused valid documents
    const availableDocs = Object.values(jobs).filter(j => j.status === 'completed' || j.status === 'paused');

    // Apply semantic search filter and sorting
    let filteredDocs = [...availableDocs];
    if (searchResults !== null) {
        filteredDocs = filteredDocs
            .filter(job => searchResults.includes(job.documentId))
            .sort((a, b) => searchResults.indexOf(a.documentId) - searchResults.indexOf(b.documentId));
    } else {
        filteredDocs = filteredDocs.sort((a, b) => b.documentId.localeCompare(a.documentId));
    }

    // Reset page when search results change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchResults]);

    // Perform Semantic Search with debounce
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (!searchQuery.trim()) {
                setSearchResults(null);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const embeddings = await apiService.generateEmbeddings([searchQuery]);
                if (embeddings && embeddings.length > 0) {
                    const matchedIds = await dbService.semanticFileSearch(embeddings[0]);
                    setSearchResults(matchedIds);
                } else {
                    setSearchResults([]);
                }
            } catch (err) {
                console.error("Semantic search failed:", err);
                const term = searchQuery.toLowerCase();
                const matched = availableDocs
                    .filter(job => job.filename.toLowerCase().includes(term))
                    .map(job => job.documentId);
                setSearchResults(matched);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [searchQuery, jobs]); // availableDocs dependency avoided to prevent infinity loops if object ref changes

    const totalPagesCount = Math.ceil(filteredDocs.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const visibleDocs = filteredDocs.slice(startIndex, startIndex + itemsPerPage);

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPagesCount) setCurrentPage(currentPage + 1);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                        Focus Chat on Documents
                    </DialogTitle>
                    <DialogDescription>
                        Select the PDFs you want to restrict the AI's search context to.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Semantic search documents..."
                                className="w-full bg-muted/50 rounded-full pl-9 pr-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>{filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}</span>
                        {totalPagesCount > 1 && (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span>{currentPage} / {totalPagesCount}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPagesCount}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 min-h-[250px] max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                        {visibleDocs.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-8 border rounded-md border-dashed">
                                {isSearching ? "No documents match your search." : "No processed documents available."}
                            </div>
                        ) : (
                            visibleDocs.map(doc => {
                                const isChecked = focusedIds.includes(doc.documentId);
                                return (
                                    <div
                                        key={doc.documentId}
                                        className={`flex items-start space-x-3 rounded-md border p-3 hover:bg-muted/50 cursor-pointer transition-colors ${isChecked ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' : ''}`}
                                        onClick={() => {
                                            if (isChecked) {
                                                setFocusedIds(focusedIds.filter(id => id !== doc.documentId));
                                            } else {
                                                setFocusedIds([...focusedIds, doc.documentId]);
                                            }
                                        }}
                                    >
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(c) => {
                                                if (c) {
                                                    setFocusedIds([...focusedIds, doc.documentId]);
                                                } else {
                                                    setFocusedIds(focusedIds.filter(id => id !== doc.documentId));
                                                }
                                            }}
                                            className="mt-0.5"
                                        />
                                        <div className="space-y-1 leading-none flex-1 overflow-hidden">
                                            <p className={`text-sm font-medium leading-none truncate ${isChecked ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                                                {doc.filename}
                                            </p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span><FileText className="w-3 h-3 inline mr-1" /> {doc.totalPages} pages</span>
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                    <Button variant="ghost" onClick={() => setFocusedIds([])} disabled={focusedIds.length === 0} className="text-muted-foreground hover:text-red-500">
                        Clear Selection
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
