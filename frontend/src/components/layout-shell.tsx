import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import {
    Menu, FileText, Database, MessageSquare,
    Activity, ChevronsLeft, ChevronsRight
} from "lucide-react"
import { NewPdfModal } from "@/components/new-pdf-modal"
import { ProcessingQueue } from "@/components/processing-queue"
import { ThemeToggle } from "@/components/theme-toggle"
import { useExtractionStore } from '@/store/extraction-store'

interface SidebarProps {
    className?: string
    collapsed?: boolean
    onToggleCollapse?: () => void
}

export function Sidebar({ className, collapsed = false, onToggleCollapse }: SidebarProps) {
    const jobs = useExtractionStore(state => state.jobs);
    const jobList = Object.values(jobs).sort((a, b) => b.documentId.localeCompare(a.documentId));

    return (
        <div className={`pb-12 border-r bg-background h-screen flex flex-col transition-all duration-200 ease-in-out ${collapsed ? 'w-14' : 'w-60'} ${className ?? ''}`}>
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Brand */}
                <div className={`px-3 py-4 flex items-center ${collapsed ? 'justify-center' : 'gap-2 px-4'}`}>
                    <span className="text-lg font-bold tracking-tight shrink-0">M</span>
                    {!collapsed && <span className="text-lg font-semibold tracking-tight truncate">axcavator</span>}
                </div>

                <Separator />

                {/* Nav */}
                <div className={`py-3 space-y-1 ${collapsed ? 'px-1.5' : 'px-3'}`}>
                    <Button variant="ghost" className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'}`} title="Chat Assistant">
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="ml-2 truncate">Chat Assistant</span>}
                    </Button>
                    <Button variant="ghost" className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'}`} title="Data Explorer">
                        <Database className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="ml-2 truncate">Data Explorer</span>}
                    </Button>
                </div>

                <Separator />

                {/* New PDF + Recent Files */}
                <div className={`py-3 flex-1 flex flex-col overflow-hidden ${collapsed ? 'px-1.5' : 'px-3'}`}>
                    {!collapsed && (
                        <div className="mb-3 px-1">
                            <NewPdfModal />
                        </div>
                    )}

                    {!collapsed && (
                        <>
                            <h2 className="mb-2 px-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                                Recent Files
                            </h2>
                            <ScrollArea className="flex-1 px-1">
                                <div className="space-y-0.5">
                                    {jobList.length === 0 && (
                                        <p className="text-xs text-muted-foreground px-2 py-1">No files yet.</p>
                                    )}
                                    {jobList.map(job => (
                                        <Button key={job.documentId} variant="ghost" size="sm" className="w-full justify-start font-normal truncate h-8">
                                            <FileText className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="truncate text-xs">{job.filename}</span>
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </>
                    )}

                    {collapsed && (
                        <div className="flex flex-col items-center gap-1">
                            <NewPdfModal collapsed />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer: Settings + Collapse */}
            <div className={`border-t py-2 space-y-1 ${collapsed ? 'px-1.5' : 'px-3'}`}>
                <ThemeToggle collapsed={collapsed} />
                {onToggleCollapse && (
                    <Button variant="ghost" className={`w-full text-muted-foreground ${collapsed ? 'justify-center px-0' : 'justify-start'}`} onClick={onToggleCollapse} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                        {!collapsed && <span className="ml-2">Collapse</span>}
                    </Button>
                )}
            </div>
        </div>
    )
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [activityOpen, setActivityOpen] = useState(true)
    const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)

    // Track job count to detect newly added jobs
    const jobs = useExtractionStore(state => state.jobs);
    const prevJobCountRef = useRef(Object.keys(jobs).length);

    useEffect(() => {
        const currentCount = Object.keys(jobs).length;
        if (currentCount > prevJobCountRef.current) {
            // A new job was added — expand the activity queue and highlight
            setActivityOpen(true);
            const allIds = Object.keys(jobs);
            const newestId = allIds[allIds.length - 1];
            setHighlightedJobId(newestId);
            // Clear highlight after animation
            const timer = setTimeout(() => setHighlightedJobId(null), 2000);
            return () => clearTimeout(timer);
        }
        prevJobCountRef.current = currentCount;
    }, [jobs]);

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans antialiased">
            {/* Desktop Left Sidebar */}
            <aside className="hidden md:flex shrink-0">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed(c => !c)}
                />
            </aside>

            {/* Mobile Left Sidebar */}
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild className="md:hidden absolute left-4 top-4 z-40">
                    <Button variant="outline" size="icon">
                        <Menu className="h-4 w-4" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-60">
                    <Sidebar />
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* Right sidebar toggle when collapsed */}
                {!activityOpen && (
                    <button
                        onClick={() => setActivityOpen(true)}
                        className="absolute right-3 top-3 z-30 bg-muted/80 hover:bg-muted border rounded-md p-1.5 transition-colors hidden lg:flex items-center"
                        title="Open Activity Queue"
                    >
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </button>
                )}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-16 md:pt-8">
                    {children}
                </div>
            </main>

            {/* Right Sidebar (Processing Queue) — animated like left sidebar */}
            <aside className={`hidden lg:flex border-l bg-muted/5 flex-col shrink-0 transition-all duration-200 ease-in-out overflow-hidden ${activityOpen ? 'w-80' : 'w-0 border-l-0'}`}>
                <div className="w-80 h-full flex flex-col">
                    <div className="p-3 border-b bg-background/50 backdrop-blur flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                            <Activity className="h-4 w-4" />
                            Activity
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActivityOpen(false)} title="Close Activity Queue">
                            <ChevronsRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <ProcessingQueue highlightedJobId={highlightedJobId} />
                </div>
            </aside>
        </div>
    )
}
