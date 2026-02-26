import { useState, useEffect } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react"
import { useExtractionStore } from '@/store/extraction-store'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { apiService } from '@/services/api-service'
import { dbService } from '@/services/db-service'

interface FileExplorerProps {
    onSelectFile: (id: string) => void;
}

export function FileExplorer({ onSelectFile }: FileExplorerProps) {
    const jobs = useExtractionStore(state => state.jobs);

    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<string[] | null>(null);

    // Initial base list
    let jobList = Object.values(jobs);

    // Apply semantic search filter and sorting
    if (searchResults !== null) {
        jobList = jobList
            .filter(job => searchResults.includes(job.documentId))
            .sort((a, b) => searchResults.indexOf(a.documentId) - searchResults.indexOf(b.documentId));
    } else {
        jobList = jobList.sort((a, b) => b.documentId.localeCompare(a.documentId));
    }

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

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
                // Fallback to basic text search if API fails
                const term = searchQuery.toLowerCase();
                const matched = Object.values(jobs)
                    .filter(job => job.filename.toLowerCase().includes(term))
                    .map(job => job.documentId);
                setSearchResults(matched);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [searchQuery, jobs]);

    const totalPagesCount = Math.ceil(jobList.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const visibleJobs = jobList.slice(startIndex, startIndex + itemsPerPage);

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPagesCount) setCurrentPage(currentPage + 1);
    };


    return (
        <div className="flex flex-col h-full bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b gap-4">
                <h2 className="text-sm font-medium hidden sm:flex items-center gap-2 whitespace-nowrap">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    All Files Explorer
                </h2>

                <div className="flex-1 max-w-md relative flex items-center">
                    <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Semantic search files, tables, contents..."
                        className="w-full bg-muted/50 rounded-full pl-9 pr-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                    <span>{jobList.length} total files</span>
                    <div className="flex items-center gap-1 border rounded-md p-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-sm"
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <span className="px-2 font-medium">
                            {currentPage} / {totalPagesCount}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-sm"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPagesCount}
                        >
                            <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow>
                            <TableHead className="w-full pl-6">Filename</TableHead>
                            <TableHead className="w-[80px]">Status</TableHead>
                            <TableHead className="w-[100px] text-right pr-6">Pages</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleJobs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    No files available.
                                </TableCell>
                            </TableRow>
                        ) : (
                            visibleJobs.map((job) => (
                                <TableRow
                                    key={job.documentId}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => onSelectFile(job.documentId)}
                                >
                                    <TableCell className="font-medium pl-6 max-w-0">
                                        <div className="flex items-center gap-2 truncate">
                                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="truncate" title={job.filename}>{job.filename}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className={`w-2.5 h-2.5 rounded-full ${job.status === 'completed' ? 'bg-green-500' : job.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[95vw] wrap-break-word">
                                                <p className="capitalize">Status: {job.status}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground pr-6">
                                        {job.processedPages} / {job.totalPages || 1}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
