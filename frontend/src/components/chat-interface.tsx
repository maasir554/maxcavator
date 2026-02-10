import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Send, Bot, User, Loader2 } from "lucide-react"
import { apiService } from "@/services/api-service"
import { dbService } from "@/services/db-service"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    data?: any[];
    error?: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! Upload a PDF and ask me questions about its data." }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input;
        setInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            // 1. Get Schema
            const schema = await dbService.getFullSchema();

            // 2. Generate SQL
            const sql = await apiService.generateSql(userMsg, schema);

            // 3. Execute SQL
            let data: any[] = [];
            let errorMsg = undefined;
            try {
                const res = await dbService.executeQuery(sql);
                data = res.rows;
            } catch (e: any) {
                errorMsg = e.message;
            }

            // 4. Respond
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMsg ? "I ran into an error executing the query." : `I found ${data.length} results.`,
                sql: sql,
                data: data,
                error: errorMsg
            }]);

        } catch (e: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I encountered an error processing your request.",
                error: e.message
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4 max-w-3xl mx-auto">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {m.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4 text-primary" />
                                </div>
                            )}

                            <div className={`flex flex-col gap-2 max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`p-3 rounded-lg ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                                </div>

                                {m.sql && (
                                    <Card className="p-2 bg-muted/50 font-mono text-xs overflow-x-auto w-full border-dashed">
                                        {m.sql}
                                    </Card>
                                )}

                                {m.error && (
                                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                        Error: {m.error}
                                    </div>
                                )}

                                {m.data && m.data.length > 0 && (
                                    <Card className="w-full overflow-hidden">
                                        <div className="max-h-[300px] overflow-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        {Object.keys(m.data[0]).map(k => (
                                                            <TableHead key={k} className="h-8 text-xs">{k}</TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {m.data.slice(0, 50).map((row, idx) => (
                                                        <TableRow key={idx}>
                                                            {Object.values(row).map((v: any, j) => (
                                                                <TableCell key={j} className="py-1 text-xs">{String(v)}</TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {m.data.length > 50 && (
                                            <div className="p-1 text-center text-xs text-muted-foreground bg-muted/20">
                                                Showing first 50 rows
                                            </div>
                                        )}
                                    </Card>
                                )}
                            </div>

                            {m.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 text-primary" />
                            </div>
                            <div className="bg-muted p-3 rounded-lg">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-background">
                <div className="max-w-3xl mx-auto flex gap-2">
                    <Input
                        placeholder="Ask about your data..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        disabled={isLoading}
                    />
                    <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
