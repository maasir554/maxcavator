import LayoutShell from "@/components/layout-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DataExplorer from "@/components/data-explorer"
import ChatInterface from "@/components/chat-interface"

import { useExtractionStore } from '@/store/extraction-store'

function App() {
  const jobs = useExtractionStore(state => state.jobs);
  const totalDocs = Object.keys(jobs).length;
  const totalTables = 0;

  return (
    <LayoutShell>
      <Tabs defaultValue="dashboard" className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <TabsList>
            <TabsTrigger value="dashboard">Overview</TabsTrigger>
            <TabsTrigger value="data">Data Explorer</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="flex-1 overflow-hidden flex flex-col space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 shrink-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalDocs}</div>
                <p className="text-xs text-muted-foreground">
                  +0% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tables Extracted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTables}</div>
                <p className="text-xs text-muted-foreground">
                  Check Data Explorer
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 border rounded-md overflow-hidden flex flex-col">
            <div className="p-2 bg-muted/20 border-b">
              <h3 className="text-sm font-medium">Chat Assistant</h3>
            </div>
            <div className="flex-1 relative">
              <div className="absolute inset-0">
                <ChatInterface />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data" className="flex-1 h-full overflow-hidden">
          <DataExplorer />
        </TabsContent>
      </Tabs>
    </LayoutShell>
  )
}

export default App
