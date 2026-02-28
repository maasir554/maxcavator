import * as React from "react"
import { cn } from "@/lib/utils"

export interface AutoResizeTextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    maxHeight?: number;
    onEnter?: () => void;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
    ({ className, maxHeight = 120, onEnter, value, onChange, onKeyDown, ...props }, ref) => {
        const internalRef = React.useRef<HTMLTextAreaElement>(null);

        // Combine refs
        const setRefs = React.useCallback(
            (node: HTMLTextAreaElement | null) => {
                internalRef.current = node;
                if (typeof ref === 'function') {
                    ref(node);
                } else if (ref) {
                    (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
                }
            },
            [ref]
        );

        React.useEffect(() => {
            if (internalRef.current) {
                // Reset height to recalculate scrollHeight
                internalRef.current.style.height = 'auto';
                const newHeight = Math.min(internalRef.current.scrollHeight, maxHeight);
                internalRef.current.style.height = `${newHeight}px`;
            }
        }, [value, maxHeight]);

        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Allow user to trigger default onKeyDown first (if any)
            if (onKeyDown) onKeyDown(e);
            if (e.defaultPrevented) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onEnter?.();
            }
        };

        return (
            <textarea
                {...props}
                ref={setRefs}
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                rows={1}
                className={cn(
                    "flex w-full resize-none bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
            />
        )
    }
)
AutoResizeTextarea.displayName = "AutoResizeTextarea"

export { AutoResizeTextarea }
