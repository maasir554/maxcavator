import { Sun, Moon, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
    const { theme, setTheme } = useTheme()

    const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <Button
                    variant="ghost"
                    className={`w-full text-muted-foreground ${collapsed ? "justify-center px-0" : "justify-start"}`}
                    title="Theme"
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="ml-2">Theme</span>}
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
                    side="top"
                    align="start"
                    sideOffset={8}
                >
                    <DropdownMenu.Item
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        onSelect={() => setTheme("light")}
                    >
                        <Sun className="h-4 w-4" />
                        <span>Light</span>
                        {theme === "light" && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        onSelect={() => setTheme("dark")}
                    >
                        <Moon className="h-4 w-4" />
                        <span>Dark</span>
                        {theme === "dark" && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        onSelect={() => setTheme("system")}
                    >
                        <Monitor className="h-4 w-4" />
                        <span>System</span>
                        {theme === "system" && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}
