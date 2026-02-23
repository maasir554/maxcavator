import { useEffect, useState } from 'react'
import { getDb } from "@/lib/db"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, RefreshCw, Database, FileText, Layers, ChevronRight } from "lucide-react"

const CORE_TABLES = [
    { name: "documents", icon: FileText, label: "Documents" },
    { name: "pdf_tables", icon: Layers, label: "PDF Tables" },
    { name: "chunks", icon: Database, label: "Chunks" },
]

function JsonCell({ value }: { value: any }) {
    const [expanded, setExpanded] = useState(false)

    if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">null</span>
    }

    if (typeof value !== 'object') {
        return <span>{String(value)}</span>
    }

    const json = JSON.stringify(value, null, 2)
    const preview = JSON.stringify(value).slice(0, 60)

    return (
        <div className="max-w-xs">
            {expanded ? (
                <pre
                    className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap cursor-pointer max-h-48 overflow-auto"
                    onClick={() => setExpanded(false)}
                >
                    {json}
                </pre>
            ) : (
                <span
                    className="text-xs cursor-pointer hover:text-primary transition-colors font-mono"
                    onClick={() => setExpanded(true)}
                    title="Click to expand"
                >
                    {preview.length > 60 ? preview + '…' : preview}
                </span>
            )}
        </div>
    )
}

function formatCell(key: string, value: any) {
    // Hide vector embeddings — too large to display
    if (key.includes('embedding')) {
        if (!value) return <span className="text-muted-foreground italic">null</span>
        return <span className="text-muted-foreground italic text-xs">vector[{value.length || '?'}]</span>
    }

    if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">null</span>
    }

    if (typeof value === 'object') {
        return <JsonCell value={value} />
    }

    // Truncate long text
    const str = String(value)
    if (str.length > 80) {
        return <span title={str}>{str.slice(0, 80)}…</span>
    }

    return <span>{str}</span>
}

export default function DataExplorer() {
    const [activeTable, setActiveTable] = useState<string>("documents")
    const [tableData, setTableData] = useState<any[]>([])
    const [sqlQuery, setSqlQuery] = useState("")
    const [queryResult, setQueryResult] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const [rowCount, setRowCount] = useState<Record<string, number>>({})

    useEffect(() => {
        fetchTableData(activeTable)
        fetchRowCounts()
    }, [])

    const fetchRowCounts = async () => {
        try {
            const db = getDb()
            const counts: Record<string, number> = {}
            for (const t of CORE_TABLES) {
                try {
                    const res = await db.query(`SELECT COUNT(*) as count FROM ${t.name}`)
                    counts[t.name] = Number((res.rows[0] as any).count)
                } catch {
                    counts[t.name] = 0
                }
            }
            setRowCount(counts)
        } catch (e) {
            console.error("Failed to fetch row counts", e)
        }
    }

    const fetchTableData = async (tableName: string) => {
        setActiveTable(tableName)
        setError(null)
        try {
            const db = getDb()
            const res = await db.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT 100`)
            setTableData(res.rows)
        } catch (e: any) {
            setError(e.message)
            setTableData([])
        }
    }

    const runQuery = async () => {
        if (!sqlQuery) return
        try {
            const db = getDb()
            const res = await db.query(sqlQuery)
            setQueryResult(res.rows)
            setError(null)
        } catch (e: any) {
            setError(e.message)
            setQueryResult([])
        }
    }

    const refresh = () => {
        fetchTableData(activeTable)
        fetchRowCounts()
    }

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Data Explorer</h2>
                <Button variant="outline" size="sm" onClick={refresh}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Refresh
                </Button>
            </div>

            <div className="flex flex-1 gap-4 h-full overflow-hidden">
                {/* Sidebar: Core Tables */}
                <Card className="w-56 flex flex-col shrink-0">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Core Tables</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-2">
                        <div className="space-y-1">
                            {CORE_TABLES.map((t) => {
                                const Icon = t.icon
                                const isActive = activeTable === t.name
                                return (
                                    <button
                                        key={t.name}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${isActive
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                        onClick={() => fetchTableData(t.name)}
                                    >
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        <span className="flex-1 text-left truncate">{t.label}</span>
                                        <span className="text-xs opacity-60">{rowCount[t.name] ?? '–'}</span>
                                        {isActive && <ChevronRight className="h-3 w-3 shrink-0" />}
                                    </button>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Main: Data Grid & SQL */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Tabs defaultValue="browse" className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between shrink-0">
                            <TabsList>
                                <TabsTrigger value="browse">Browse Data</TabsTrigger>
                                <TabsTrigger value="sql">SQL Editor</TabsTrigger>
                            </TabsList>
                            {activeTable && (
                                <span className="text-xs text-muted-foreground font-mono">
                                    {activeTable} · {tableData.length} row{tableData.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        <TabsContent value="browse" className="flex-1 border rounded-md p-0 overflow-auto mt-2">
                            {tableData.length > 0 ? (
                                <div className="overflow-auto h-full">
                                    <Table className="min-w-max">
                                        <TableHeader>
                                            <TableRow>
                                                {Object.keys(tableData[0]).map((key) => (
                                                    <TableHead key={key} className="text-xs font-semibold whitespace-nowrap">
                                                        {key}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tableData.map((row, i) => (
                                                <TableRow key={i}>
                                                    {Object.entries(row).map(([key, val], j) => (
                                                        <TableCell key={j} className="text-xs py-2">
                                                            {formatCell(key, val)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    {error ? error : 'No data yet. Upload and process a PDF to populate tables.'}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="sql" className="flex-1 flex flex-col mt-2">
                            <div className="flex gap-2 mb-3">
                                <Input
                                    placeholder="SELECT * FROM chunks WHERE document_id = '...' LIMIT 20"
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && runQuery()}
                                    className="font-mono text-xs"
                                />
                                <Button onClick={runQuery} size="sm">
                                    <Play className="mr-1.5 h-3.5 w-3.5" /> Run
                                </Button>
                            </div>

                            {error && (
                                <div className="p-3 mb-3 bg-destructive/15 text-destructive rounded-md font-mono text-xs">
                                    {error}
                                </div>
                            )}

                            <div className="flex-1 border rounded-md overflow-auto">
                                {queryResult.length > 0 ? (
                                    <Table className="min-w-max">
                                        <TableHeader>
                                            <TableRow>
                                                {Object.keys(queryResult[0]).map((key) => (
                                                    <TableHead key={key} className="text-xs font-semibold whitespace-nowrap">
                                                        {key}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {queryResult.map((row, i) => (
                                                <TableRow key={i}>
                                                    {Object.entries(row).map(([key, val], j) => (
                                                        <TableCell key={j} className="text-xs py-2">
                                                            {formatCell(key, val)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm">
                                        Run a query to see results
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
