import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UploadCloud, Link as LinkIcon, Loader2, FilePlus } from 'lucide-react'
import { useExtractionStore } from '@/store/extraction-store'

export function NewPdfModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [url, setUrl] = useState("")
    const [customName, setCustomName] = useState("")
    const [urlLoading, setUrlLoading] = useState(false)

    const addJob = useExtractionStore((state) => state.addJob)
    const addJobFromUrl = useExtractionStore((state) => state.addJobFromUrl)

    const onDrop = async (acceptedFiles: File[]) => {
        for (const file of acceptedFiles) {
            console.log("Uploaded file:", file.name);
            try {
                await addJob(file);
                setIsOpen(false); // Close modal after successful upload
            } catch (e) {
                console.error("Failed to add document job", e);
            }
        }
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        }
    })

    const handleUrlUpload = async () => {
        if (!url.trim()) return;
        setUrlLoading(true);
        try {
            await addJobFromUrl(url, customName.trim() || undefined);
            setUrl("");
            setCustomName("");
            setIsOpen(false); // Close modal after successful fetch
        } catch (e) {
            console.error("Failed to add document from URL", e);
        } finally {
            setUrlLoading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="w-full gap-2">
                    <FilePlus className="h-4 w-4" />
                    New PDF
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add PDF Document</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload">Upload</TabsTrigger>
                        <TabsTrigger value="url">URL</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="space-y-4 mt-4">
                        <div {...getRootProps()} className={`
                            flex flex-col items-center justify-center 
                            h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                            ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50 bg-muted/50'}
                        `}>
                            <input {...getInputProps()} />
                            <UploadCloud className={`h-12 w-12 mb-3 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                            <div className="text-center px-4">
                                {isDragActive ? (
                                    <p className="text-sm font-medium text-primary">Drop the PDF here ...</p>
                                ) : (
                                    <>
                                        <p className="text-sm font-medium text-foreground mb-1">
                                            Drag & drop PDF here
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            or click to browse
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="url" className="space-y-4 mt-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">PDF URL</label>
                                <Input
                                    placeholder="https://example.com/document.pdf"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleUrlUpload()}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Paste a direct link to a PDF file
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Custom Name (Optional)</label>
                                <Input
                                    placeholder="My Document"
                                    value={customName}
                                    onChange={e => setCustomName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleUrlUpload()}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Give a custom name to avoid long URL-based filenames
                                </p>
                            </div>
                            <Button onClick={handleUrlUpload} disabled={urlLoading || !url} className="w-full">
                                {urlLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Fetching PDF...
                                    </>
                                ) : (
                                    <>
                                        <LinkIcon className="h-4 w-4 mr-2" />
                                        Fetch PDF
                                    </>
                                )}
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
