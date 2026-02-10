import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, Link as LinkIcon, Loader2 } from 'lucide-react'
import { useExtractionStore } from '@/store/extraction-store'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface PdfUploadProps {
    onUpload?: (file: File) => void
}

export function PdfUpload({ onUpload }: PdfUploadProps) {
    const addJob = useExtractionStore((state) => state.addJob)
    const addJobFromUrl = useExtractionStore((state) => state.addJobFromUrl)
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        for (const file of acceptedFiles) {
            console.log("Uploaded file:", file.name);
            try {
                await addJob(file);
                if (onUpload) onUpload(file);
            } catch (e) {
                console.error("Failed to add document job", e);
            }
        }
    }, [addJob, onUpload])

    const handleUrlUpload = async () => {
        if (!url.trim()) return;
        setLoading(true);
        try {
            await addJobFromUrl(url);
            setUrl("");
            // Create a dummy file object just to trigger the callback if needed
            if (onUpload) onUpload(new File([], "url_doc.pdf"));
        } catch (e) {
            console.error("Failed to add document from URL", e);
        } finally {
            setLoading(false);
        }
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        }
    })

    return (
        <div className="space-y-4">
            <div {...getRootProps()} className={`
            flex flex-col items-center justify-center 
            h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50 bg-muted/50'}
        `}>
                <input {...getInputProps()} />
                <UploadCloud className={`h-8 w-8 mb-2 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-center">
                    {isDragActive ? (
                        <p className="text-sm font-medium text-primary">Drop the PDF here ...</p>
                    ) : (
                        <p className="text-sm font-medium text-muted-foreground">
                            Drag & drop PDF here, or click
                        </p>
                    )}
                </div>
            </div>

            <div className="flex gap-2">
                <Input
                    placeholder="https://example.com/doc.pdf"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlUpload()}
                />
                <Button size="sm" variant="outline" onClick={handleUrlUpload} disabled={loading || !url}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    )
}
