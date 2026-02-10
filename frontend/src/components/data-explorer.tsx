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
import { Play, RefreshCw } from "lucide-react"

export default function DataExplorer() {
    const [tables, setTables] = useState<any[]>([])
    const [activeTable, setActiveTable] = useState<string | null>(null)
    const [tableData, setTableData] = useState<any[]>([])
    const [sqlQuery, setSqlQuery] = useState("")
    const [queryResult, setQueryResult] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchTables()
    }, [])

    const fetchTables = async () => {
        try {
            const db = getDb()
            const tablesList = await db.getTables()
            setTables(tablesList)
            if (tablesList.length > 0 && !activeTable) {
                // Automatically select first table if none selected
                // setActiveTable(tablesList[0].table_name)
            }
        } catch (e: any) {
            console.error("Failed to fetch tables", e)
            setError(e.message)
        }
    }

    const fetchTableData = async (tableName: string) => {
        setActiveTable(tableName)
        try {
            const db = getDb()
            const res = await db.query(`SELECT * FROM ${tableName} LIMIT 50`)
            setTableData(res.rows)
            setError(null)
        } catch (e: any) {
            setError(e.message)
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

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Data Explorer</h2>
                <Button variant="outline" size="sm" onClick={fetchTables}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Schema
                </Button>
            </div>

            <div className="flex flex-1 space-x-4 h-full overflow-hidden">
                {/* Sidebar: Table List */}
                <Card className="w-64 flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-sm">Tables</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-2">
                        <div className="space-y-1">
                            {tables.map((t) => (
                                <Button
                                    key={t.table_name}
                                    variant={activeTable === t.table_name ? "secondary" : "ghost"}
                                    className="w-full justify-start text-sm truncate"
                                    onClick={() => fetchTableData(t.table_name)}
                                >
                                    {t.table_name}
                                </Button>
                            ))}
                            {tables.length === 0 && (
                                <span className="text-xs text-muted-foreground p-2">No tables found.</span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Main: Data Grid & SQL */}
                <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                    <Tabs defaultValue="browse" className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                            <TabsList>
                                <TabsTrigger value="browse">Browse Data</TabsTrigger>
                                <TabsTrigger value="sql">SQL Editor</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="browse" className="flex-1 border rounded-md p-0 overflow-auto mt-2">
                            {activeTable ? (
                                tableData.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {Object.keys(tableData[0]).map((key) => (
                                                    <TableHead key={key}>{key}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tableData.map((row, i) => (
                                                <TableRow key={i}>
                                                    {Object.values(row).map((val: any, j) => (
                                                        <TableCell key={j}>
                                                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground">Table is empty or loading...</div>
                                )
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">Select a table to view data</div>
                            )}
                        </TabsContent>

                        <TabsContent value="sql" className="flex-1 flex flex-col mt-2">
                            <div className="flex space-x-2 mb-4">
                                <Input
                                    placeholder="SELECT * FROM documents..."
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && runQuery()}
                                    className="font-mono"
                                />
                                <Button onClick={runQuery}>
                                    <Play className="mr-2 h-4 w-4" /> Run
                                </Button>
                            </div>

                            {error && (
                                <div className="p-4 mb-4 bg-destructive/15 text-destructive rounded-md font-mono text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex-1 border rounded-md overflow-auto">
                                {queryResult.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {Object.keys(queryResult[0]).map((key) => (
                                                    <TableHead key={key}>{key}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {queryResult.map((row, i) => (
                                                <TableRow key={i}>
                                                    {Object.values(row).map((val: any, j) => (
                                                        <TableCell key={j}>
                                                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground">Run a query to see results</div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
