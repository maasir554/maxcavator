import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

interface ThemeProviderState {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "maxcavator-theme"

const ThemeProviderContext = createContext<ThemeProviderState>({
    theme: "system",
    setTheme: () => null,
})

export function ThemeProvider({
    children,
    defaultTheme = "system",
}: {
    children: React.ReactNode
    defaultTheme?: Theme
}) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(STORAGE_KEY) as Theme) || defaultTheme
    )

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove("light", "dark")

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light"
            root.classList.add(systemTheme)
        } else {
            root.classList.add(theme)
        }
    }, [theme])

    // Listen for OS-level theme changes when in system mode
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
        const handler = () => {
            if (theme !== "system") return
            const root = window.document.documentElement
            root.classList.remove("light", "dark")
            root.classList.add(mediaQuery.matches ? "dark" : "light")
        }

        mediaQuery.addEventListener("change", handler)
        return () => mediaQuery.removeEventListener("change", handler)
    }, [theme])

    const value = {
        theme,
        setTheme: (newTheme: Theme) => {
            localStorage.setItem(STORAGE_KEY, newTheme)
            setTheme(newTheme)
        },
    }

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")
    return context
}
