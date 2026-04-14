import React from "react"

// Linkified multiline text renderer for source fields.
export function renderLinks(links: string | null): React.ReactNode {
  if (!links) return "-"

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
  const lines = links.split(/\r?\n/)

  return (
    <div className="flex flex-col gap-1 whitespace-pre-wrap break-words">
      {lines.map((line, lineIndex) => {
        if (!line.trim()) {
          return <br key={lineIndex} />
        }

        const parts: React.ReactNode[] = []
        let lastIndex = 0
        let match: RegExpExecArray | null
        urlRegex.lastIndex = 0

        while ((match = urlRegex.exec(line)) !== null) {
          if (match.index > lastIndex) {
            parts.push(line.substring(lastIndex, match.index))
          }

          const url =
            match[0].startsWith("http://") || match[0].startsWith("https://")
              ? match[0]
              : `https://${match[0]}`

          parts.push(
            <a
              key={`${lineIndex}-${match.index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {match[0]}
            </a>,
          )

          lastIndex = match.index + match[0].length
        }

        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex))
        }

        if (parts.length === 0) {
          return <span key={lineIndex}>{line}</span>
        }

        return <div key={lineIndex}>{parts}</div>
      })}
    </div>
  )
}
