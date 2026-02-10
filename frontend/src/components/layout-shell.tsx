import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Menu, FileText, Database, MessageSquare, Settings, Activity } from "lucide-react"
import { NewPdfModal } from "@/components/new-pdf-modal"
import { ProcessingQueue } from "@/components/processing-queue"
import { useExtractionStore } from '@/store/extraction-store'

interface SidebarProps {
    className?: string
}

export function Sidebar({ className }: SidebarProps) {
    const jobs = useExtractionStore(state => state.jobs);
    const jobList = Object.values(jobs).sort((a, b) => b.documentId.localeCompare(a.documentId)); // rudimentary sort

    return (
        <div className={`pb-12 w-64 border-r bg-background h-screen flex flex-col ${className}`}>
            <div className="space-y-4 py-4 flex-1">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        Maxcavator
                    </h2>
                    <div className="space-y-1">
                        <Button variant="secondary" className="w-full justify-start">
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Chat Assistant
                        </Button>
                        <Button variant="ghost" className="w-full justify-start">
                            <Database className="mr-2 h-4 w-4" />
                            Data Explorer
                        </Button>
                    </div>
                </div>
                <Separator className="my-4" />
                <div className="px-3 py-2">
                    <div className="px-1 mb-4">
                        <NewPdfModal />
                    </div>

                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        Recent Files
                    </h2>
                    <ScrollArea className="h-[200px] px-1">
                        <div className="space-y-1 p-2">
                            {jobList.length === 0 && (
                                <p className="text-xs text-muted-foreground px-4">No files yet.</p>
                            )}
                            {jobList.map(job => (
                                <Button key={job.documentId} variant="ghost" size="sm" className="w-full justify-start font-normal truncate">
                                    <FileText className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">{job.filename}</span>
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
            <div className="px-3 py-2">
                <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                </Button>
            </div>
        </div>
    )
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans antialiased">
            {/* Desktop Left Sidebar */}
            <aside className="hidden md:flex">
                <Sidebar />
            </aside>

            {/* Mobile Left Sidebar */}
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild className="md:hidden absolute left-4 top-4 z-40">
                    <Button variant="outline" size="icon">
                        <Menu className="h-4 w-4" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                    <Sidebar />
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-16 md:pt-8">
                    {children}
                </div>
            </main>

            {/* Right Sidebar (Processing Queue) */}
            <aside className="hidden lg:flex w-80 border-l bg-muted/10 flex-col">
                <div className="p-4 border-b bg-background/50 backdrop-blur">
                    <div className="flex items-center gap-2 font-semibold">
                        <Activity className="h-4 w-4" />
                        Activity Queue
                    </div>
                </div>
                <ProcessingQueue />
            </aside>

            {/* Mobile Queue Trigger? Maybe later. For now, visible on Desktop LG+ */}
        </div>
    )
}
