"use client"

import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface AutoResizeTextareaProps extends React.ComponentProps<typeof Textarea> {
  autoResize?: boolean
  initialWidth?: number
  initialHeight?: number
}

export function AutoResizeTextarea({
  autoResize = true,
  initialWidth,
  initialHeight,
  className,
  value,
  onChange,
  ...props
}: AutoResizeTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [height, setHeight] = React.useState<number | undefined>(initialHeight)
  const [width, setWidth] = React.useState<number | undefined>(initialWidth)

  // Set initial size to match cell
  React.useEffect(() => {
    if (textareaRef.current) {
      if (initialHeight !== undefined) {
        setHeight(initialHeight)
        textareaRef.current.style.height = `${initialHeight}px`
      }
      if (initialWidth !== undefined) {
        setWidth(initialWidth)
        textareaRef.current.style.width = `${initialWidth}px`
      }
    }
  }, [initialHeight, initialWidth])

  // Auto-resize on content change
  React.useEffect(() => {
    if (textareaRef.current && autoResize) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = "auto"
      // Set height to scrollHeight, but don't go below initial height
      const newHeight = Math.max(
        textareaRef.current.scrollHeight,
        initialHeight || 0
      )
      textareaRef.current.style.height = `${newHeight}px`
      setHeight(newHeight)
    }
  }, [value, autoResize, initialHeight])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e)
    }
  }

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      className={cn(
        autoResize ? "resize-none" : "resize-y",
        className
      )}
      style={{
        width: width !== undefined ? `${width}px` : undefined,
        height: height !== undefined ? `${height}px` : undefined,
        minHeight: initialHeight !== undefined ? `${initialHeight}px` : undefined,
        minWidth: initialWidth !== undefined ? `${initialWidth}px` : undefined,
      }}
      {...props}
    />
  )
}

