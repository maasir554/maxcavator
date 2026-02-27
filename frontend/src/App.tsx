import { useEffect, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import LayoutShell from "@/components/layout-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DataExplorer from "@/components/data-explorer"
import ChatInterface from "@/components/chat-interface"
import AgentInterface from "@/components/agent-interface"
import OrchestratorInterface from "@/components/orchestrator-interface"
import TrashView from "@/components/trash-view"
import { FileExplorer } from "@/components/file-explorer"
import { FileDetailsView } from "@/components/file-details-view"
import { FileText, Database, Clock, Loader2, Trash2, Bot, Zap } from "lucide-react"

import { useExtractionStore } from '@/store/extraction-store'

function App() {
  const jobs = useExtractionStore(state => state.jobs);
  const trashedJobs = useExtractionStore(state => state.trashedJobs);
  const isLoading = useExtractionStore(state => state.isLoading);
  const loadJobs = useExtractionStore(state => state.loadJobs);
  const totalDocs = Object.keys(jobs).length;
  const trashCount = Object.keys(trashedJobs).length;
  const totalTables = useExtractionStore(state => state.totalTables);
  const recentFiles = Object.values(jobs).sort((a, b) => b.documentId.localeCompare(a.documentId)).slice(0, 6);

  const [location, setLocation] = useLocation();
  const [isDocRoute, docParams] = useRoute('/document/:id/*?');
  const selectedFileId = isDocRoute ? docParams.id : null;

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading documents...</p>
          </div>
        </div>
      </LayoutShell>
    );
  }

  const activeTab = location.startsWith('/chat') ? 'chat'
    : location.startsWith('/agent') ? 'agent'
      : location.startsWith('/orchestrator') ? 'orchestrator'
        : location.startsWith('/data') ? 'data'
          : location.startsWith('/trash') ? 'trash'
            : 'dashboard';

  return (
    <LayoutShell>
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLocation(val === 'dashboard' ? '/' : `/${val}`)}
        className="h-full flex flex-col"
      >
        {!selectedFileId && (
          <div className={`transition-all duration-300 origin-top-left ${isScrolled ? 'mb-2 scale-90 opacity-80' : 'mb-4 scale-100 opacity-100'}`}>
            <TabsList className="transition-all duration-300">
              <TabsTrigger value="dashboard" className="transition-all duration-300">Overview</TabsTrigger>
              <TabsTrigger value="chat" className="transition-all duration-300">Chat & RAG</TabsTrigger>
              <TabsTrigger value="agent" className="transition-all duration-300 gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
                <Bot className="w-3.5 h-3.5" /> Agent
              </TabsTrigger>
              <TabsTrigger value="orchestrator" className="transition-all duration-300 gap-1.5 font-medium text-purple-600 dark:text-purple-400">
                <Zap className="w-3.5 h-3.5" /> Orchestrator
              </TabsTrigger>
              <TabsTrigger value="data" className="transition-all duration-300">Data Explorer</TabsTrigger>
              <TabsTrigger value="trash" className="gap-1.5 transition-all duration-300">
                <Trash2 className={`transition-all duration-300 ${isScrolled ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                Trash
                {trashCount > 0 && (
                  <span className="ml-1 rounded-full bg-destructive/15 text-destructive text-xs px-1.5 py-0.5 font-medium transition-all duration-300">
                    {trashCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        )}

        <TabsContent
          value="dashboard"
          className="flex-1 overflow-y-auto flex flex-col space-y-4 pr-1 pb-4"
          onScroll={(e) => {
            const scrollTop = e.currentTarget.scrollTop;
            setIsScrolled(scrollTop > 10);
          }}
        >
          {selectedFileId ? (
            <FileDetailsView
              documentId={selectedFileId}
            />
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 shrink-0">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Documents</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalDocs}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tables Extracted</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalTables}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Files */}
              <Card className="flex-1 overflow-hidden flex flex-col shrink-0 min-h-[250px] max-h-[300px]">
                <CardHeader className="pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">Recent Files</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                  {recentFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">No documents yet.</p>
                      <p className="text-xs mt-1">Upload a PDF to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentFiles.map(job => (
                        <div
                          key={job.documentId}
                          className="flex items-center gap-3 p-3 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
                          onClick={() => setLocation(`/document/${job.documentId}`)}
                        >
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{job.filename}</p>
                            <p className="text-xs text-muted-foreground capitalize">{job.status}</p>
                          </div>
                          {job.totalPages > 0 && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {job.processedPages}/{job.totalPages} pages
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* All Files Explorer */}
              <div className="flex-1 min-h-[300px] shrink-0 mb-8">
                <FileExplorer onSelectFile={(id) => setLocation(`/document/${id}`)} />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="chat" className="flex-1 h-full overflow-hidden">
          <div className="h-full border rounded-md overflow-hidden">
            <ChatInterface />
          </div>
        </TabsContent>

        <TabsContent value="agent" className="flex-1 h-full overflow-hidden">
          <div className="h-full border border-indigo-500/30 rounded-md overflow-hidden shadow-lg shadow-indigo-500/10">
            <AgentInterface />
          </div>
        </TabsContent>

        <TabsContent value="orchestrator" className="flex-1 h-full overflow-hidden">
          <div className="h-full border border-purple-500/30 rounded-md overflow-hidden shadow-lg shadow-purple-500/10">
            <OrchestratorInterface />
          </div>
        </TabsContent>

        <TabsContent value="data" className="flex-1 h-full overflow-hidden">
          <DataExplorer />
        </TabsContent>

        <TabsContent value="trash" className="flex-1 h-full overflow-hidden">
          <TrashView />
        </TabsContent>
      </Tabs>
    </LayoutShell>
  )
}

export default App
