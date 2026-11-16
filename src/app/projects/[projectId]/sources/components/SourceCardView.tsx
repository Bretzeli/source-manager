"use client"

import * as React from "react"
import {
  AlignLeft,
  Braces,
  CalendarDays,
  ChevronRight,
  Copy,
  Expand,
  FileText,
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  StickyNote,
  Tag as TagIcon,
  Trash2,
  Users,
} from "lucide-react"
import { useTranslations } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { formatPublicationDate } from "@/lib/sources-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ColumnKey, Source } from "@/types/sources"
import { InlineSourceCellEditor } from "../inline-source-cell-editor"
import { SourcesMarkdownPreview } from "../sources-markdown-preview"
import type { RichTextColumn } from "../sources-rich-text-fullscreen-dialog"
import { renderLinks } from "../utils/render-links"
import { SourceTagsPopoverContent } from "./SourceTagsPopoverContent"

/** Fields that are collapsed by default in a card because they can get long. */
export const CARD_COLLAPSIBLE_COLUMNS = ["description", "notes", "links", "bibtex"] as const
export type CardCollapsibleColumn = (typeof CARD_COLLAPSIBLE_COLUMNS)[number]

export const cardSectionKey = (sourceId: string, column: CardCollapsibleColumn) => `${sourceId}:${column}`

const SECTION_ICONS: Record<CardCollapsibleColumn, React.ComponentType<{ className?: string }>> = {
  description: AlignLeft,
  notes: StickyNote,
  links: Link2,
  bibtex: Braces,
}

const EDITABLE_COLUMNS: ColumnKey[] = [
  "abbreviation",
  "title",
  "authors",
  "publicationDate",
  "description",
  "notes",
  "links",
  "bibtex",
]

/** Hidden until the card is hovered/focused on devices with a mouse; always visible on touch devices (see globals.css). */
const REVEAL = "source-card-reveal"

/** Abbreviation / date / their "+" chips share one fixed-height row so they sit on the same vertical center. */
const META_FIELD_CLASS = "flex h-6 items-center"

const isCollapsible = (col: ColumnKey): col is CardCollapsibleColumn =>
  (CARD_COLLAPSIBLE_COLUMNS as readonly string[]).includes(col)

/** One-line plain-text teaser for a collapsed markdown/plain field. */
function toPreviewText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/[#>*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

type TagOption = { id: string; name: string; color: string }
type Dimensions = { width: number; height: number } | null

export type SourceCardViewProps = {
  sources: Source[]
  tags: TagOption[]
  visibleColumns: ColumnKey[]
  getColumnLabel: (col: ColumnKey) => string
  expandedSections: Set<string>
  onToggleSection: (sourceId: string, column: CardCollapsibleColumn, open: boolean) => void
  editingCell: { sourceId: string; column: ColumnKey } | null
  editValue: string
  cellDimensions: Dimensions
  autoResizeTextarea: boolean
  richTextFontSize: string
  richTextMarkdownMode: boolean
  wide: boolean
  onStartEdit: (sourceId: string, column: ColumnKey, value: string | null, dimensions: Dimensions) => void
  onCommit: (value: string) => void
  onCancel: () => void
  onClearCellDimensions: () => void
  onOpenRichText: (sourceId: string, column: RichTextColumn, value: string | null, markdownMode?: boolean) => void
  onUpdateTags: (sourceId: string, tagIds: string[]) => void
  onCreateTag: (sourceId: string) => void
  onCopyBibtex: (bibtex: string | null) => void
  onGenerateBibtex: (sourceId: string) => void
  onDelete: (sourceId: string) => void
}

export function SourceCardView(props: SourceCardViewProps) {
  const { t } = useTranslations()

  if (props.sources.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed py-12 text-center text-muted-foreground", props.wide && "mx-4")}>
        {t.sources.cardView.noMatches}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3",
        props.wide && "mx-4 2xl:grid-cols-4"
      )}
    >
      {props.sources.map((source) => (
        <SourceCard key={source.id} source={source} {...props} />
      ))}
    </div>
  )
}

type SourceCardProps = SourceCardViewProps & { source: Source }

function SourceCard({
  source,
  tags,
  visibleColumns,
  getColumnLabel,
  expandedSections,
  onToggleSection,
  editingCell,
  editValue,
  cellDimensions,
  autoResizeTextarea,
  richTextFontSize,
  richTextMarkdownMode,
  onStartEdit,
  onCommit,
  onCancel,
  onClearCellDimensions,
  onOpenRichText,
  onUpdateTags,
  onCreateTag,
  onCopyBibtex,
  onGenerateBibtex,
  onDelete,
}: SourceCardProps) {
  const { t } = useTranslations()
  const cv = t.sources.cardView
  // Menu actions that start an inline editor run after the menu has closed, so focus
  // returning to the trigger doesn't immediately blur (and commit) the new editor.
  const pendingMenuAction = React.useRef<(() => void) | null>(null)

  const isVisible = (col: ColumnKey) => visibleColumns.includes(col)
  const isEditing = (col: ColumnKey) => editingCell?.sourceId === source.id && editingCell.column === col
  const valueOf = (col: ColumnKey) => source[col as keyof Source] as string | null

  const startEdit = (col: ColumnKey, element?: HTMLElement | null) => {
    const rect = element?.getBoundingClientRect()
    onStartEdit(source.id, col, valueOf(col), rect ? { width: rect.width, height: rect.height } : null)
    if (isCollapsible(col)) onToggleSection(source.id, col, true)
  }

  const renderEditor = (col: ColumnKey) => (
    <InlineSourceCellEditor
      key={`${source.id}-${col}`}
      column={col}
      initialValue={editValue}
      cellDimensions={cellDimensions}
      autoResizeTextarea={autoResizeTextarea}
      richTextFontSize={richTextFontSize}
      markdownModeOnMount={richTextMarkdownMode}
      onOpenFullscreen={(draft, mdMode) => onOpenRichText(source.id, col as RichTextColumn, draft, mdMode)}
      onCommit={onCommit}
      onCancel={onCancel}
      onClearCellDimensions={onClearCellDimensions}
    />
  )

  /** Read-only value that switches to the inline editor on double-click, like a table cell. */
  const editable = (col: ColumnKey, children: React.ReactNode, className?: string) =>
    isEditing(col) ? (
      <div className="w-full basis-full">{renderEditor(col)}</div>
    ) : (
      <div
        className={cn(
          "-mx-1.5 cursor-text rounded-md px-1.5 transition-colors hover:bg-muted/60",
          className
        )}
        title={cv.doubleClickToEdit}
        onDoubleClick={(e) => startEdit(col, e.currentTarget)}
      >
        {children}
      </div>
    )

  /** Dashed "+ Field" chip for empty header fields, so they stay editable without cluttering the card. */
  const addChip = (col: ColumnKey) =>
    isEditing(col) ? (
      <div className="w-full basis-full">{renderEditor(col)}</div>
    ) : (
      <button
        type="button"
        onClick={() => startEdit(col)}
        className={cn(
          REVEAL,
          "inline-flex h-6 items-center gap-1 rounded-md border border-dashed px-2 text-xs leading-none text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Plus className="h-3 w-3" />
        {getColumnLabel(col)}
      </button>
    )

  const abbreviation = source.abbreviation
  const date = source.publicationDate
  const showMetaRow = isVisible("abbreviation") || isVisible("publicationDate")
  const collapsibleColumns = visibleColumns.filter(isCollapsible)

  return (
    <article className="source-card group/card relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md">
      {/* Accent strip in the colors of the source's tags */}
      {isVisible("tags") && source.tags.length > 0 && (
        <div className="flex h-1 w-full" aria-hidden>
          {source.tags.map((tag) => (
            <div key={tag.id} className="flex-1" style={{ backgroundColor: tag.color }} />
          ))}
        </div>
      )}

      <div className="space-y-3 p-4">
        {/* Meta row: abbreviation + date, actions */}
        <div className="flex items-start gap-2">
          <div className="flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {showMetaRow && (
              <>
                {isVisible("abbreviation") &&
                  (abbreviation || isEditing("abbreviation")
                    ? editable(
                        "abbreviation",
                        <span className="inline-flex h-6 items-center rounded-md bg-primary/10 px-2 font-mono text-xs font-semibold leading-none text-primary ring-1 ring-inset ring-primary/20">
                          {abbreviation}
                        </span>,
                        META_FIELD_CLASS + " mx-0 px-0"
                      )
                    : addChip("abbreviation"))}
                {isVisible("publicationDate") &&
                  (date || isEditing("publicationDate")
                    ? editable(
                        "publicationDate",
                        <span className="inline-flex h-6 items-center gap-1 text-xs leading-none text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          {formatPublicationDate(date)}
                        </span>,
                        META_FIELD_CLASS
                      )
                    : addChip("publicationDate"))}
              </>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0" aria-label={cv.actions}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(e) => {
                const action = pendingMenuAction.current
                if (!action) return
                e.preventDefault()
                pendingMenuAction.current = null
                action()
              }}
            >
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Pencil className="mr-2 h-4 w-4" />
                  {cv.editField}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {EDITABLE_COLUMNS.map((col) => (
                    <DropdownMenuItem
                      key={col}
                      onSelect={() => {
                        pendingMenuAction.current = () => startEdit(col)
                      }}
                    >
                      {getColumnLabel(col)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {(["description", "notes"] as const).map((col) => (
                    <DropdownMenuItem
                      key={`rich-${col}`}
                      onSelect={() => {
                        pendingMenuAction.current = () => onOpenRichText(source.id, col, valueOf(col))
                      }}
                    >
                      <Expand className="mr-2 h-4 w-4" />
                      {getColumnLabel(col)} · {cv.editorMode}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onCopyBibtex(source.bibtex)}>
                <Copy className="mr-2 h-4 w-4" />
                {t.sources.copyBibtex}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onGenerateBibtex(source.id)}>
                <FileText className="mr-2 h-4 w-4" />
                {t.sources.autoGenerateBibtex}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(source.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t.sources.deleteSource}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title (always shown: it identifies the card) */}
        {editable(
          "title",
          <h3 className="break-words text-base font-semibold leading-snug tracking-tight">
            {source.title || <span className="text-muted-foreground">-</span>}
          </h3>
        )}

        {/* Authors */}
        {isVisible("authors") &&
          (source.authors || isEditing("authors")
            ? editable(
                "authors",
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-pre-wrap break-words">{source.authors}</span>
                </div>
              )
            : addChip("authors"))}

        {/* Tags */}
        {isVisible("tags") && (
          <div className="flex flex-wrap items-center gap-1.5">
            {source.tags.map((tag) => (
              <Tooltip key={tag.id}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="rounded-full px-2.5"
                    style={{ backgroundColor: tag.color, color: "white", borderColor: tag.color }}
                  >
                    {tag.abbreviation || tag.name}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{tag.name}</TooltipContent>
              </Tooltip>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    REVEAL,
                    "h-6 gap-1 rounded-full border border-dashed px-2 text-xs font-normal text-muted-foreground"
                  )}
                >
                  <TagIcon className="h-3 w-3" />
                  {source.tags.length === 0 ? cv.addTags : cv.editTags}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" onWheelCapture={(event) => event.stopPropagation()}>
                <SourceTagsPopoverContent
                  source={source}
                  tags={tags}
                  label={t.sources.addDialog.tags}
                  createTagLabel={t.sources.addDialog.createTag}
                  onUpdateTags={onUpdateTags}
                  onCreateTag={onCreateTag}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Long fields: collapsed by default */}
      {collapsibleColumns.length > 0 && (
        <div className="divide-y border-t bg-muted/20">
          {collapsibleColumns.map((col) => {
            const value = valueOf(col)
            const isEmpty = !value || !value.trim()
            const editing = isEditing(col)
            const open = editing || (!isEmpty && expandedSections.has(cardSectionKey(source.id, col)))
            const Icon = SECTION_ICONS[col]
            const isRich = col === "description" || col === "notes"

            return (
              <div key={col}>
                <div className="flex items-center gap-1 py-1 pl-4 pr-2">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => (isEmpty ? startEdit(col) : onToggleSection(source.id, col, !open))}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-90",
                        isEmpty && "opacity-0"
                      )}
                    />
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {getColumnLabel(col)}
                    </span>
                    {!open && (
                      <span
                        className={cn(
                          "min-w-0 truncate text-xs",
                          isEmpty ? "italic text-muted-foreground/60" : "text-muted-foreground"
                        )}
                      >
                        {isEmpty ? cv.emptyClickToAdd : toPreviewText(value)}
                      </span>
                    )}
                  </button>
                  {isRich && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(REVEAL, "h-7 w-7 shrink-0")}
                      onClick={() => onOpenRichText(source.id, col, value)}
                      title={cv.openEditorMode}
                      aria-label={`${getColumnLabel(col)}: ${cv.openEditorMode}`}
                    >
                      <Expand className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {col === "bibtex" && !isEmpty && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(REVEAL, "h-7 w-7 shrink-0")}
                      onClick={() => onCopyBibtex(value)}
                      title={t.sources.copyBibtex}
                      aria-label={t.sources.copyBibtex}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {open && (
                  <div className="pb-3 pl-[2.375rem] pr-4">
                    {editable(
                      col,
                      col === "bibtex" ? (
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-xs">
                          {value}
                        </pre>
                      ) : col === "links" ? (
                        <div className="text-sm">{renderLinks(value)}</div>
                      ) : (
                        <SourcesMarkdownPreview markdown={value} fontSizePx={richTextFontSize} />
                      ),
                      "py-1"
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}
