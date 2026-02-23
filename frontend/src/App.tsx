import { useEffect } from 'react'
import LayoutShell from "@/components/layout-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DataExplorer from "@/components/data-explorer"
import ChatInterface from "@/components/chat-interface"
import TrashView from "@/components/trash-view"
import { FileText, Database, Clock, Loader2, Trash2 } from "lucide-react"

import { useExtractionStore } from '@/store/extraction-store'

function App() {
  const jobs = useExtractionStore(state => state.jobs);
  const trashedJobs = useExtractionStore(state => state.trashedJobs);
  const isLoading = useExtractionStore(state => state.isLoading);
  const loadJobs = useExtractionStore(state => state.loadJobs);
  const totalDocs = Object.keys(jobs).length;
  const trashCount = Object.keys(trashedJobs).length;
  const totalTables = 0;
  const recentFiles = Object.values(jobs).slice(-6).reverse();

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

  return (
    <LayoutShell>
      <Tabs defaultValue="dashboard" className="h-full flex flex-col">
        <div className="mb-4">
          <TabsList>
            <TabsTrigger value="dashboard">Overview</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="data">Data Explorer</TabsTrigger>
            <TabsTrigger value="trash" className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Trash
              {trashCount > 0 && (
                <span className="ml-1 rounded-full bg-destructive/15 text-destructive text-xs px-1.5 py-0.5 font-medium">
                  {trashCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="flex-1 overflow-hidden flex flex-col space-y-4">
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
          <Card className="flex-1 overflow-hidden flex flex-col">
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
                      className="flex items-center gap-3 p-3 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors"
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
        </TabsContent>

        <TabsContent value="chat" className="flex-1 h-full overflow-hidden">
          <div className="h-full border rounded-md overflow-hidden">
            <ChatInterface />
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
