import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Eye, FileText, Bot, Code, ChevronLeft, ChevronRight } from "lucide-react"

interface ExtractionDebugModalProps {
    debugInfo: Record<number, {
        ocrText: string;
        prompt: string;
        rawResponse: string;
    }>;
    maxPage: number;
}

export function ExtractionDebugModal({ debugInfo, maxPage }: ExtractionDebugModalProps) {
    // If no debug info at all, don't render button
    if (!debugInfo || Object.keys(debugInfo).length === 0) return null;

    const availablePages = Object.keys(debugInfo).map(Number).sort((a, b) => a - b);

    // Internal state for selected page
    const [selectedPage, setSelectedPage] = useState<number>(availablePages[availablePages.length - 1]);
    const [isOpen, setIsOpen] = useState(false);

    // Initial load: set to latest
    useEffect(() => {
        if (isOpen && availablePages.length > 0) {
            // If the currently selected page is not in the list (shouldn't happen) or we want to update? 
            // Actually, sticking to the user's selection is better.
            if (!availablePages.includes(selectedPage)) {
                setSelectedPage(availablePages[availablePages.length - 1]);
            }
        }
    }, [isOpen, availablePages.length]);

    const currentData = debugInfo[selectedPage];

    const handlePrev = () => {
        const idx = availablePages.indexOf(selectedPage);
        if (idx > 0) setSelectedPage(availablePages[idx - 1]);
    }

    const handleNext = () => {
        const idx = availablePages.indexOf(selectedPage);
        if (idx < availablePages.length - 1) setSelectedPage(availablePages[idx + 1]);
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen} className="w-full">
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Inspect Extraction Details">
                    <Eye className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col w-full">
                <DialogHeader>
                    <div className="flex justify-between items-center pr-8">
                        <DialogTitle>Extraction Debug Info</DialogTitle>
                        <div className="flex items-center gap-2 text-sm">
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={handlePrev} disabled={availablePages.indexOf(selectedPage) <= 0}>
                                <ChevronLeft className="h-3 w-3" />
                            </Button>
                            <span>Page {selectedPage}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={handleNext} disabled={availablePages.indexOf(selectedPage) >= availablePages.length - 1}>
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    <DialogDescription>
                        Inspect the raw data flow for page {selectedPage}.
                    </DialogDescription>
                </DialogHeader>

                {currentData ? (
                    <Tabs defaultValue="ocr" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="ocr" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" /> OCR Text
                            </TabsTrigger>
                            <TabsTrigger value="prompt" className="flex items-center gap-2">
                                <Bot className="h-4 w-4" /> AI Prompt
                            </TabsTrigger>
                            <TabsTrigger value="response" className="flex items-center gap-2">
                                <Code className="h-4 w-4" /> Raw Response
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 min-h-0 mt-2 border rounded-md bg-muted/30">
                            <TabsContent value="ocr" className="h-full m-0 relative">
                                <ScrollArea className="h-[50vh] w-full rounded-md border p-4">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">{currentData.ocrText}</pre>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="prompt" className="h-full m-0 relative">
                                <ScrollArea className="h-[50vh] w-full rounded-md border p-4">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">{currentData.prompt}</pre>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="response" className="h-full m-0 relative">
                                <ScrollArea className="h-[50vh] w-full rounded-md border p-4">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">{currentData.rawResponse}</pre>
                                </ScrollArea>
                            </TabsContent>
                        </div>
                    </Tabs>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a page to view details.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
