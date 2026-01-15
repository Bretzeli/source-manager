"use client"

import React from "react"
import { useTranslations } from "@/lib/i18n"
import { parseBibtex, bibtexToSourceFields } from "@/lib/bibtex"
import { useSources } from "@/hooks/use-sources"
import { formatPublicationDate } from "@/lib/sources-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Plus, MoreVertical, Trash2, Copy, FileText, Settings2, ArrowUpDown, Search, X, ChevronUp, ChevronDown, Download, Upload, Tag, Edit2, Merge } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ColumnKey, Source } from "@/types/sources"

const PREDEFINED_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Dark Green", value: "#047857" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Brown", value: "#92400e" },
]

export default function SourcesPage() {
  const { t } = useTranslations()
  const {
    sources,
    topics,
    loading,
    filteredAndSortedSources,
    paginatedSources,
    totalPages,
    uniqueYears,
    uniqueAuthors,
    visibleColumns,
    addDialogOpen,
    setAddDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleting,
    deleteAllDialogOpen,
    setDeleteAllDialogOpen,
    deletingAll,
    selectedDeleteSourceIds,
    setSelectedDeleteSourceIds,
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    draggedColumnIndex,
    setDraggedColumnIndex,
    dragOverColumnIndex,
    setDragOverColumnIndex,
    columnWidths,
    setColumnWidths,
    searchQuery,
    setSearchQuery,
    topicFilter,
    setTopicFilter,
    yearFromFilter,
    setYearFromFilter,
    yearToFilter,
    setYearToFilter,
    authorFilter,
    setAuthorFilter,
    sortColumn,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    editingCell,
    editValue,
    setEditValue,
    newSource,
    setNewSource,
    creating,
    createTopicDialogOpen,
    setCreateTopicDialogOpen,
    newTopic,
    setNewTopic,
    customColor,
    setCustomColor,
    importDialogOpen,
    setImportDialogOpen,
    importFile,
    setImportFile,
    importType,
    setImportType,
    importData,
    setImportData,
    selectedImportIndices,
    setSelectedImportIndices,
    importing,
    existingBibtexSet,
    importColumnVisibility,
    setImportColumnVisibility,
    importColumnOrder,
    setImportColumnOrder,
    importDraggedColumnIndex,
    setImportDraggedColumnIndex,
    importDragOverColumnIndex,
    setImportDragOverColumnIndex,
    handleCellDoubleClick,
    handleCellCancel,
    handleCellSave,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteAllClick,
    handleDeleteAllConfirm,
    handleCopyBibtex,
    handleAddSource,
    handleCreateTopic,
    handleSort,
    handleFileSelect,
    handleExcludeExisting,
    handleImport,
    handleExportCSV,
    handleExportJSON,
    handleUpdateSourceTopics,
    bibtexExportDialogOpen,
    setBibtexExportDialogOpen,
    selectedBibtexExportSourceIds,
    setSelectedBibtexExportSourceIds,
    bibtexExportTopicFilter,
    setBibtexExportTopicFilter,
    bibtexExportColumnVisibility,
    setBibtexExportColumnVisibility,
    handleOpenBibtexExport,
    handleCopyBibtexToClipboard,
    handleDownloadBibtexFile,
    manageTopicsDialogOpen,
    setManageTopicsDialogOpen,
    editingTopic,
    setEditingTopic,
    editingTopicData,
    setEditingTopicData,
    handleUpdateTopic,
    handleDeleteTopic,
    mergingTopics,
    selectedTopicsToMerge,
    setSelectedTopicsToMerge,
    mergeTopicData,
    setMergeTopicData,
    handleMergeTopics,
  } = useSources()

  const [isResizing, setIsResizing] = React.useState(false)
  const [hasResized, setHasResized] = React.useState(false)
  const [deleteTopicDialogOpen, setDeleteTopicDialogOpen] = React.useState(false)
  const [topicToDelete, setTopicToDelete] = React.useState<{ id: string; name: string } | null>(null)

  const getColumnLabel = (key: ColumnKey) => {
    return t.sources.columns[key]
  }

  const handleColumnResize = (column: ColumnKey, newWidth: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [column]: Math.max(50, newWidth), // Minimum width of 50px
    }))
  }

  const handleResizeStart = (e: React.MouseEvent, column: ColumnKey) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = columnWidths[column]
    let hasMoved = false

    setIsResizing(true)
    setHasResized(false)

    const handleMouseMove = (e: MouseEvent) => {
      hasMoved = true
      const diff = e.clientX - startX
      const newWidth = startWidth + diff
      handleColumnResize(column, newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      setIsResizing(false)
      if (hasMoved) {
        setHasResized(true)
        // Reset after a short delay to allow click event to be prevented
        setTimeout(() => {
          setHasResized(false)
        }, 100)
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const handleHeaderClick = (col: ColumnKey, e: React.MouseEvent) => {
    // Prevent sorting if we just finished resizing
    if (hasResized || isResizing) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    handleSort(col)
  }

  // Render links as free text with auto-clickable URLs, preserving newlines
  const renderLinks = (links: string | null): React.ReactNode => {
    if (!links) return "-"
    
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
    
    // Split by newlines to preserve line breaks
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
          
          // Reset regex
          urlRegex.lastIndex = 0
          
          while ((match = urlRegex.exec(line)) !== null) {
            // Add text before the URL
            if (match.index > lastIndex) {
              parts.push(line.substring(lastIndex, match.index))
            }
            
            // Add clickable URL
            const url = match[0].startsWith("http://") || match[0].startsWith("https://") 
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
              </a>
            )
            
            lastIndex = match.index + match[0].length
          }
          
          // Add remaining text after last URL
          if (lastIndex < line.length) {
            parts.push(line.substring(lastIndex))
          }
          
          // If no URLs found, just return the line as text
          if (parts.length === 0) {
            return <span key={lineIndex}>{line}</span>
          }
          
          return <div key={lineIndex}>{parts}</div>
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t.sources.title}</h1>
        <p className="text-muted-foreground mt-1">{t.sources.manageSources}</p>
      </div>

      {/* Table Operations: Search, Filters, Column Settings */}
      <div className="mb-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.sources.search.placeholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Topic</Label>
            <Select value={topicFilter} onValueChange={(v) => { setTopicFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t.sources.filters.topic} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.sources.filters.all}</SelectItem>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full border border-border"
                        style={{ backgroundColor: topic.color }}
                      />
                      <span>{topic.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Year From</Label>
            <Select value={yearFromFilter} onValueChange={(v) => { setYearFromFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={t.sources.filters.yearFrom} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.sources.filters.all}</SelectItem>
                {uniqueYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Year To</Label>
            <Select value={yearToFilter} onValueChange={(v) => { setYearToFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={t.sources.filters.yearTo} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.sources.filters.all}</SelectItem>
                {uniqueYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Author</Label>
            <Select value={authorFilter} onValueChange={(v) => { setAuthorFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t.sources.filters.author} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.sources.filters.all}</SelectItem>
                {uniqueAuthors.map((author) => (
                  <SelectItem key={author} value={author}>
                    {author}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="mr-2 h-4 w-4" />
                {t.sources.columnSettings.title}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">{t.sources.columnSettings.showHide}</Label>
              <p className="text-xs text-muted-foreground mb-2">{t.sources.columnSettings.reorder}</p>
              <div className="mt-2 space-y-2">
                {columnOrder.map((col, index) => (
                  <div
                    key={col}
                    draggable
                    onDragStart={() => {
                      setDraggedColumnIndex(index)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverColumnIndex(index)
                    }}
                    onDragLeave={() => {
                      setDragOverColumnIndex(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedColumnIndex !== null && draggedColumnIndex !== index) {
                        const newOrder = [...columnOrder]
                        const [removed] = newOrder.splice(draggedColumnIndex, 1)
                        newOrder.splice(index, 0, removed)
                        setColumnOrder(newOrder)
                      }
                      setDraggedColumnIndex(null)
                      setDragOverColumnIndex(null)
                    }}
                    className={`flex items-center space-x-2 p-2 rounded-md transition-colors cursor-move ${
                      dragOverColumnIndex === index ? "bg-accent" : ""
                    } ${draggedColumnIndex === index ? "opacity-50" : ""}`}
                  >
                    <div className="text-muted-foreground select-none">⋮⋮</div>
                    <Checkbox
                      id={col}
                      checked={columnVisibility[col]}
                      onCheckedChange={(checked) => {
                        setColumnVisibility({ ...columnVisibility, [col]: checked as boolean })
                      }}
                    />
                    <Label htmlFor={col} className="text-sm font-normal cursor-pointer flex-1">
                      {getColumnLabel(col)}
                    </Label>
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          if (index > 0) {
                            const newOrder = [...columnOrder]
                            newOrder[index] = columnOrder[index - 1]
                            newOrder[index - 1] = col
                            setColumnOrder(newOrder)
                          }
                        }}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          if (index < columnOrder.length - 1) {
                            const newOrder = [...columnOrder]
                            newOrder[index] = columnOrder[index + 1]
                            newOrder[index + 1] = col
                            setColumnOrder(newOrder)
                          }
                        }}
                        disabled={index === columnOrder.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
        </div>
      </div>

      {/* Actions: Add, Import, Export, Delete */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t.sources.addSource}
        </Button>
        <Button variant="outline" onClick={() => setManageTopicsDialogOpen(true)}>
          <Tag className="mr-2 h-4 w-4" />
          Manage Topics
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t.sources.export.download}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>
              {t.sources.export.csv}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJSON}>
              {t.sources.export.json}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleOpenBibtexExport}>
              <FileText className="mr-2 h-4 w-4" />
              BibTeX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              {t.sources.import.import}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setImportType("csv"); setImportDialogOpen(true); }}>
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setImportType("json"); setImportDialogOpen(true); }}>
              JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setImportType("miro-csv"); setImportDialogOpen(true); }}>
              Custom Miro CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button 
          variant="destructive" 
          onClick={handleDeleteAllClick}
          disabled={sources.length === 0}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete All Sources
        </Button>
      </div>

      {/* Table */}
      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <p className="text-muted-foreground mb-6">{t.sources.noSources}</p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t.sources.addSource}
          </Button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((col, index) => (
                    <TableHead
                      key={col}
                      className="cursor-pointer select-none relative group"
                      onClick={(e) => handleHeaderClick(col, e)}
                      style={{ width: `${columnWidths[col]}px`, minWidth: `${columnWidths[col]}px`, maxWidth: `${columnWidths[col]}px` }}
                    >
                      <div className="flex items-center gap-2 break-words whitespace-normal">
                        {getColumnLabel(col)}
                        {sortColumn === col && (
                          <ArrowUpDown className="h-4 w-4 flex-shrink-0" />
                        )}
                      </div>
                      {index < visibleColumns.length - 1 && (
                        <div
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/40 transition-colors z-10"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleResizeStart(e, col)
                          }}
                        />
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                      <div className="flex justify-center items-center w-full">
                        No sources match your filters
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSources.map((source) => (
                    <TableRow key={source.id}>
                      {visibleColumns.map((col) => {
                        const isEditing = editingCell?.sourceId === source.id && editingCell?.column === col
                        const cellValue = source[col as keyof Source] as string | null

                        return (
                          <TableCell
                            key={col}
                            onDoubleClick={() => handleCellDoubleClick(source.id, col, cellValue)}
                            className={`${col !== "topics" && col !== "bibtex" ? "cursor-pointer" : ""} break-words whitespace-normal`}
                            style={{ width: `${columnWidths[col]}px`, minWidth: `${columnWidths[col]}px`, maxWidth: `${columnWidths[col]}px` }}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                {(col === "bibtex" || col === "description" || col === "notes" || col === "links") ? (
                                  <Textarea
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={(e) => {
                                      if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('button[title="Cancel"]')) {
                                        handleCellSave()
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey && col !== "links") {
                                        e.preventDefault()
                                        handleCellSave()
                                      } else if (e.key === "Escape") {
                                        e.preventDefault()
                                        handleCellCancel()
                                      }
                                    }}
                                    autoFocus
                                    rows={col === "bibtex" ? 6 : 3}
                                    className="min-w-[300px]"
                                  />
                                ) : (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={(e) => {
                                      if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('button[title="Cancel"]')) {
                                        handleCellSave()
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault()
                                        handleCellSave()
                                      } else if (e.key === "Escape") {
                                        handleCellCancel()
                                      }
                                    }}
                                    autoFocus
                                    className="h-8"
                                  />
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                  }}
                                  onClick={handleCellCancel}
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : col === "topics" ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-auto p-1">
                                    <div className="flex flex-col gap-1">
                                      {source.topics.length === 0 ? (
                                        <span className="text-muted-foreground text-sm">No topics</span>
                                      ) : (
                                        source.topics.map((topic) => (
                                          <Tooltip key={topic.id}>
                                            <TooltipTrigger asChild>
                                              <Badge
                                                style={{ backgroundColor: topic.color, color: "white", borderColor: topic.color }}
                                                variant="outline"
                                                className="w-fit"
                                              >
                                                {topic.abbreviation || topic.name}
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {topic.abbreviation ? topic.name : topic.name}
                                            </TooltipContent>
                                          </Tooltip>
                                        ))
                                      )}
                                    </div>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                  <div className="space-y-4">
                                    <Label>{t.sources.addDialog.topics}</Label>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                      {topics.map((topic) => (
                                        <div key={topic.id} className="flex items-center space-x-2">
                                          <Checkbox
                                            checked={source.topics.some((t) => t.id === topic.id)}
                                            onCheckedChange={async (checked) => {
                                              const currentTopicIds = source.topics.map((t) => t.id)
                                              const newTopicIds = checked
                                                ? [...currentTopicIds, topic.id]
                                                : currentTopicIds.filter((id) => id !== topic.id)

                                              handleUpdateSourceTopics(source.id, newTopicIds)
                                            }}
                                          />
                                          <Label className="flex items-center gap-2 cursor-pointer">
                                            <Badge
                                              style={{ backgroundColor: topic.color, color: "white", borderColor: topic.color }}
                                              variant="outline"
                                            >
                                              {topic.name}
                                            </Badge>
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setCreateTopicDialogOpen(true)}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      {t.sources.addDialog.createTopic}
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : col === "bibtex" || col === "description" || col === "notes" ? (
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {cellValue || "-"}
                              </div>
                            ) : col === "publicationDate" ? (
                              <div className="text-sm break-words">{formatPublicationDate(cellValue)}</div>
                            ) : col === "links" ? (
                              <div className="text-sm break-words">{renderLinks(cellValue)}</div>
                            ) : col === "authors" ? (
                              <div className="text-sm whitespace-pre-wrap break-words">{cellValue || "-"}</div>
                            ) : col === "title" ? (
                              <div className="text-sm break-words" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{cellValue || "-"}</div>
                            ) : col === "abbreviation" ? (
                              <div className="text-sm break-words">{cellValue || "-"}</div>
                            ) : (
                              <div className="break-words">{cellValue || "-"}</div>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCopyBibtex(source.bibtex)}>
                              <Copy className="mr-2 h-4 w-4" />
                              {t.sources.copyBibtex}
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled>
                              <FileText className="mr-2 h-4 w-4" />
                              {t.sources.addCitation}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteClick(source.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t.sources.deleteSource}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t.sources.pagination.showing} {pageSize === "all" ? filteredAndSortedSources.length : (currentPage - 1) * pageSize + 1}-
                {pageSize === "all" ? filteredAndSortedSources.length : Math.min(currentPage * pageSize, filteredAndSortedSources.length)}{" "}
                {t.sources.pagination.of} {filteredAndSortedSources.length} {t.sources.pagination.results}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={pageSize === "all" ? "all" : pageSize.toString()}
                onValueChange={(v) => {
                  setPageSize(v === "all" ? "all" : parseInt(v))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 {t.sources.pagination.perPage}</SelectItem>
                  <SelectItem value="10">10 {t.sources.pagination.perPage}</SelectItem>
                  <SelectItem value="25">25 {t.sources.pagination.perPage}</SelectItem>
                  <SelectItem value="50">50 {t.sources.pagination.perPage}</SelectItem>
                  <SelectItem value="100">100 {t.sources.pagination.perPage}</SelectItem>
                  <SelectItem value="all">{t.sources.filters.all}</SelectItem>
                </SelectContent>
              </Select>
              {pageSize !== "all" && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add Source Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.sources.addDialog.title}</DialogTitle>
            <DialogDescription>{t.sources.addDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="abbreviation">{t.sources.addDialog.abbreviation}</Label>
              <Input
                id="abbreviation"
                value={newSource.abbreviation}
                onChange={(e) => setNewSource({ ...newSource, abbreviation: e.target.value })}
                placeholder={t.sources.addDialog.abbreviationPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">{t.sources.addDialog.titleLabel} *</Label>
              <Input
                id="title"
                value={newSource.title}
                onChange={(e) => setNewSource({ ...newSource, title: e.target.value })}
                placeholder={t.sources.addDialog.titlePlaceholder}
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="authors">{t.sources.addDialog.authors}</Label>
                <span className="text-xs text-muted-foreground">(separated by semicolon)</span>
              </div>
              <Input
                id="authors"
                value={newSource.authors}
                onChange={(e) => setNewSource({ ...newSource, authors: e.target.value })}
                placeholder={t.sources.addDialog.authorsPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="publicationDate">{t.sources.addDialog.publicationDate}</Label>
              <Input
                id="publicationDate"
                type="text"
                value={newSource.publicationDate}
                onChange={(e) => setNewSource({ ...newSource, publicationDate: e.target.value })}
                placeholder={t.sources.addDialog.publicationDatePlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{t.sources.addDialog.descriptionLabel}</Label>
              <Textarea
                id="description"
                value={newSource.description}
                onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                placeholder={t.sources.addDialog.descriptionPlaceholder}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">{t.sources.addDialog.notes}</Label>
              <Textarea
                id="notes"
                value={newSource.notes}
                onChange={(e) => setNewSource({ ...newSource, notes: e.target.value })}
                placeholder={t.sources.addDialog.notesPlaceholder}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="links">{t.sources.addDialog.links}</Label>
              <Input
                id="links"
                value={newSource.links}
                onChange={(e) => setNewSource({ ...newSource, links: e.target.value })}
                placeholder={t.sources.addDialog.linksPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="topics">{t.sources.addDialog.topics}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    {newSource.topicIds.length === 0
                      ? "Select topics"
                      : `${newSource.topicIds.length} topic(s) selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {topics.map((topic) => (
                        <div key={topic.id} className="flex items-center space-x-2">
                          <Checkbox
                            checked={newSource.topicIds.includes(topic.id)}
                            onCheckedChange={(checked) => {
                              setNewSource({
                                ...newSource,
                                topicIds: checked
                                  ? [...newSource.topicIds, topic.id]
                                  : newSource.topicIds.filter((id) => id !== topic.id),
                              })
                            }}
                          />
                          <Label className="flex items-center gap-2 cursor-pointer">
                            <Badge
                              style={{ backgroundColor: topic.color, color: "white", borderColor: topic.color }}
                              variant="outline"
                            >
                              {topic.name}
                            </Badge>
                          </Label>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateTopicDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t.sources.addDialog.createTopic}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bibtex">{t.sources.addDialog.bibtex}</Label>
              <Textarea
                id="bibtex"
                value={newSource.bibtex}
                onChange={(e) => {
                  setNewSource({ ...newSource, bibtex: e.target.value })
                  if (e.target.value.trim()) {
                    const parsed = parseBibtex(e.target.value)
                    if (parsed) {
                      const fields = bibtexToSourceFields(parsed)
                      setNewSource((prev) => ({
                        ...prev,
                        bibtex: e.target.value,
                        abbreviation: prev.abbreviation || fields.abbreviation || "",
                        title: prev.title || fields.title || "",
                        authors: prev.authors || fields.authors || "",
                        publicationDate: prev.publicationDate || fields.publicationDate || "",
                      }))
                    }
                  }
                }}
                placeholder={t.sources.addDialog.bibtexPlaceholder}
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false)
                setNewSource({
                  abbreviation: "",
                  title: "",
                  authors: "",
                  publicationDate: "",
                  description: "",
                  notes: "",
                  links: "",
                  bibtex: "",
                  topicIds: [],
                })
              }}
              disabled={creating}
            >
              {t.home.cancel}
            </Button>
            <Button onClick={handleAddSource} disabled={creating || !newSource.title}>
              {creating ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {t.sources.addDialog.creating}
                </>
              ) : (
                t.sources.addDialog.create
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Topic Dialog */}
      <Dialog open={createTopicDialogOpen} onOpenChange={setCreateTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.sources.addDialog.createTopic}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="topicName">{t.sources.addDialog.topicName} *</Label>
              <Input
                id="topicName"
                value={newTopic.name}
                onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="topicAbbreviation">{t.sources.addDialog.topicAbbreviation}</Label>
              <Input
                id="topicAbbreviation"
                value={newTopic.abbreviation}
                onChange={(e) => setNewTopic({ ...newTopic, abbreviation: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="topicColor">{t.sources.addDialog.topicColor}</Label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => {
                        setNewTopic({ ...newTopic, color: color.value })
                        setCustomColor(false)
                      }}
                      className={`w-10 h-10 rounded-md border-2 transition-all ${
                        newTopic.color === color.value && !customColor
                          ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground"
                          : "border-border hover:border-foreground/50"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomColor(true)}
                    className={`w-10 h-10 rounded-md border-2 transition-all flex items-center justify-center ${
                      customColor
                        ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground"
                        : "border-border hover:border-foreground/50"
                    }`}
                    title="Custom"
                  >
                    <span className="text-xs">+</span>
                  </button>
                </div>
                {customColor && (
                  <div className="flex items-center gap-2">
                    <Input
                      id="topicColor"
                      type="color"
                      value={newTopic.color}
                      onChange={(e) => {
                        setNewTopic({ ...newTopic, color: e.target.value })
                        setCustomColor(true)
                      }}
                      className="w-20 h-10"
                    />
                    <Input
                      value={newTopic.color}
                      onChange={(e) => {
                        setNewTopic({ ...newTopic, color: e.target.value })
                        setCustomColor(true)
                      }}
                      placeholder="#3b82f6"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateTopicDialogOpen(false)
              setNewTopic({ name: "", abbreviation: "", color: "#3b82f6" })
              setCustomColor(false)
            }}>
              {t.home.cancel}
            </Button>
            <Button
              onClick={handleCreateTopic}
              disabled={!newTopic.name}
            >
              {t.sources.addDialog.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.sources.deleteSource}</AlertDialogTitle>
            <AlertDialogDescription>{t.sources.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.home.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {t.sources.deleting}
                </>
              ) : (
                t.home.delete
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Sources Dialog */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[95vh] overflow-hidden !flex !flex-col">
          <DialogHeader>
            <DialogTitle>Delete Sources</DialogTitle>
            <DialogDescription>
              Select the sources you want to delete. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedDeleteSourceIds.size} source{selectedDeleteSourceIds.size !== 1 ? 's' : ''} selected for deletion
              </div>
              <div className="flex gap-2 items-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSelectedDeleteSourceIds(new Set(sources.map(s => s.id)))
                  }}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSelectedDeleteSourceIds(new Set())
                  }}
                >
                  Deselect All
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings2 className="mr-2 h-4 w-4" />
                      {t.sources.columnSettings.title}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">{t.sources.columnSettings.showHide}</Label>
                        <p className="text-xs text-muted-foreground mb-2">{t.sources.columnSettings.reorder}</p>
                        <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto">
                          {importColumnOrder.map((col, index) => (
                            <div
                              key={col}
                              draggable
                              onDragStart={() => {
                                setImportDraggedColumnIndex(index)
                              }}
                              onDragOver={(e) => {
                                e.preventDefault()
                                setImportDragOverColumnIndex(index)
                              }}
                              onDragLeave={() => {
                                setImportDragOverColumnIndex(null)
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                if (importDraggedColumnIndex !== null && importDraggedColumnIndex !== index) {
                                  const newOrder = [...importColumnOrder]
                                  const [removed] = newOrder.splice(importDraggedColumnIndex, 1)
                                  newOrder.splice(index, 0, removed)
                                  setImportColumnOrder(newOrder)
                                }
                                setImportDraggedColumnIndex(null)
                                setImportDragOverColumnIndex(null)
                              }}
                              className={`flex items-center space-x-2 p-2 rounded-md transition-colors cursor-move ${
                                importDragOverColumnIndex === index ? "bg-accent" : ""
                              } ${importDraggedColumnIndex === index ? "opacity-50" : ""}`}
                            >
                              <div className="text-muted-foreground select-none">⋮⋮</div>
                              <Checkbox
                                id={`delete-${col}`}
                                checked={importColumnVisibility[col]}
                                onCheckedChange={(checked) => {
                                  setImportColumnVisibility({ ...importColumnVisibility, [col]: checked as boolean })
                                }}
                              />
                              <Label htmlFor={`delete-${col}`} className="text-sm font-normal cursor-pointer flex-1">
                                {getColumnLabel(col)}
                              </Label>
                              <div className="flex flex-col gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 p-0"
                                  onClick={() => {
                                    if (index > 0) {
                                      const newOrder = [...importColumnOrder]
                                      newOrder[index] = importColumnOrder[index - 1]
                                      newOrder[index - 1] = col
                                      setImportColumnOrder(newOrder)
                                    }
                                  }}
                                  disabled={index === 0}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 p-0"
                                  onClick={() => {
                                    if (index < importColumnOrder.length - 1) {
                                      const newOrder = [...importColumnOrder]
                                      newOrder[index] = importColumnOrder[index + 1]
                                      newOrder[index + 1] = col
                                      setImportColumnOrder(newOrder)
                                    }
                                  }}
                                  disabled={index === importColumnOrder.length - 1}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {sources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sources to delete
              </div>
            ) : (
              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedDeleteSourceIds.size === sources.length && sources.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDeleteSourceIds(new Set(sources.map(s => s.id)))
                            } else {
                              setSelectedDeleteSourceIds(new Set())
                            }
                          }}
                        />
                      </TableHead>
                      {importColumnOrder.filter((col) => importColumnVisibility[col]).map((col) => (
                        <TableHead key={col}>{getColumnLabel(col)}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((source) => {
                      const isSelected = selectedDeleteSourceIds.has(source.id)
                      const importVisibleColumns = importColumnOrder.filter((col) => importColumnVisibility[col])
                      return (
                        <TableRow key={source.id} className={isSelected ? "" : "opacity-50"}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedDeleteSourceIds)
                                if (checked) {
                                  newSelected.add(source.id)
                                } else {
                                  newSelected.delete(source.id)
                                }
                                setSelectedDeleteSourceIds(newSelected)
                              }}
                            />
                          </TableCell>
                          {importVisibleColumns.map((col) => {
                            const cellValue = source[col as keyof Source] as string | null

                            return (
                              <TableCell key={col}>
                                {col === "topics" ? (
                                  source.topics.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {source.topics.map((topic) => (
                                        <Badge
                                          key={topic.id}
                                          variant="outline"
                                          style={{
                                            backgroundColor: topic.color,
                                            color: "white",
                                            borderColor: topic.color,
                                          }}
                                        >
                                          {topic.abbreviation || topic.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    "-"
                                  )
                                ) : col === "publicationDate" ? (
                                  <div className="max-w-[150px] text-sm">{formatPublicationDate(cellValue)}</div>
                                ) : col === "links" ? (
                                  <div className="max-w-[300px] text-sm">{renderLinks(cellValue)}</div>
                                ) : col === "authors" ? (
                                  <div className="max-w-[200px] text-sm whitespace-pre-wrap break-words">{cellValue || "-"}</div>
                                ) : col === "bibtex" || col === "description" || col === "notes" ? (
                                  <div className="max-w-[400px] text-sm whitespace-pre-wrap break-words">{cellValue || "-"}</div>
                                ) : (
                                  <div className="truncate max-w-[200px]">{cellValue || "-"}</div>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAllDialogOpen(false)
                setSelectedDeleteSourceIds(new Set())
              }}
              disabled={deletingAll}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAllConfirm}
              disabled={deletingAll || selectedDeleteSourceIds.size === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedDeleteSourceIds.size} Source${selectedDeleteSourceIds.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[95vh] overflow-hidden !flex !flex-col">
          <DialogHeader>
            <DialogTitle>{t.sources.import.importSources}</DialogTitle>
            <DialogDescription>
              {t.sources.import.selectFile}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4 py-4">
            {!importFile ? (
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 gap-4">
                <input
                  id="import-file"
                  type="file"
                  accept={importType === "json" ? ".json" : ".csv"}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div 
                  className="flex flex-col items-center gap-2 cursor-pointer"
                  onClick={() => {
                    const fileInput = document.getElementById("import-file") as HTMLInputElement
                    fileInput?.click()
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t.sources.import.selectFile}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Select value={importType} onValueChange={(v) => setImportType(v as "csv" | "json" | "miro-csv")}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="miro-csv">Custom Miro CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => {
                    const fileInput = document.getElementById("import-file") as HTMLInputElement
                    fileInput?.click()
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Select File
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{t.sources.import.fileSelected}: {importFile.name}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={handleExcludeExisting}>
                      {t.sources.import.excludeExisting}
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings2 className="mr-2 h-4 w-4" />
                          {t.sources.columnSettings.title}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium">{t.sources.columnSettings.showHide}</Label>
                            <p className="text-xs text-muted-foreground mb-2">{t.sources.columnSettings.reorder}</p>
                            <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto">
                              {importColumnOrder.map((col, index) => (
                                <div
                                  key={col}
                                  draggable
                                  onDragStart={() => {
                                    setImportDraggedColumnIndex(index)
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    setImportDragOverColumnIndex(index)
                                  }}
                                  onDragLeave={() => {
                                    setImportDragOverColumnIndex(null)
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    if (importDraggedColumnIndex !== null && importDraggedColumnIndex !== index) {
                                      const newOrder = [...importColumnOrder]
                                      const [removed] = newOrder.splice(importDraggedColumnIndex, 1)
                                      newOrder.splice(index, 0, removed)
                                      setImportColumnOrder(newOrder)
                                    }
                                    setImportDraggedColumnIndex(null)
                                    setImportDragOverColumnIndex(null)
                                  }}
                                  className={`flex items-center space-x-2 p-2 rounded-md transition-colors cursor-move ${
                                    importDragOverColumnIndex === index ? "bg-accent" : ""
                                  } ${importDraggedColumnIndex === index ? "opacity-50" : ""}`}
                                >
                                  <div className="text-muted-foreground select-none">⋮⋮</div>
                                  <Checkbox
                                    id={`import-${col}`}
                                    checked={importColumnVisibility[col]}
                                    onCheckedChange={(checked) => {
                                      setImportColumnVisibility({ ...importColumnVisibility, [col]: checked as boolean })
                                    }}
                                  />
                                  <Label htmlFor={`import-${col}`} className="text-sm font-normal cursor-pointer flex-1">
                                    {getColumnLabel(col)}
                                  </Label>
                                  <div className="flex flex-col gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 p-0"
                                      onClick={() => {
                                        if (index > 0) {
                                          const newOrder = [...importColumnOrder]
                                          newOrder[index] = importColumnOrder[index - 1]
                                          newOrder[index - 1] = col
                                          setImportColumnOrder(newOrder)
                                        }
                                      }}
                                      disabled={index === 0}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 p-0"
                                      onClick={() => {
                                        if (index < importColumnOrder.length - 1) {
                                          const newOrder = [...importColumnOrder]
                                          newOrder[index] = importColumnOrder[index + 1]
                                          newOrder[index + 1] = col
                                          setImportColumnOrder(newOrder)
                                        }
                                      }}
                                      disabled={index === importColumnOrder.length - 1}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedImportIndices.size} {t.sources.import.sourcesToImport}
                </div>
                {importData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t.sources.import.noSourcesToImport}
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedImportIndices.size === importData.length && importData.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedImportIndices(new Set(importData.map((_, index) => index)))
                                } else {
                                  setSelectedImportIndices(new Set())
                                }
                              }}
                            />
                          </TableHead>
                          {importColumnOrder.filter((col) => importColumnVisibility[col]).map((col) => (
                            <TableHead key={col}>{getColumnLabel(col)}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.map((source, index) => {
                          const hasExistingBibtex = source.bibtex && existingBibtexSet.has(source.bibtex.trim())
                          const importVisibleColumns = importColumnOrder.filter((col) => importColumnVisibility[col])
                          return (
                            <TableRow key={index} className={hasExistingBibtex ? "opacity-50" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedImportIndices.has(index)}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedImportIndices)
                                    if (checked) {
                                      newSelected.add(index)
                                    } else {
                                      newSelected.delete(index)
                                    }
                                    setSelectedImportIndices(newSelected)
                                  }}
                                />
                              </TableCell>
                              {importVisibleColumns.map((col) => {
                                let cellValue: string | null = null
                                if (col === "abbreviation") cellValue = source.abbreviation || null
                                else if (col === "title") cellValue = source.title || null
                                else if (col === "authors") cellValue = source.authors || null
                                else if (col === "publicationDate") cellValue = source.publicationDate || null
                                else if (col === "description") cellValue = source.description || null
                                else if (col === "notes") cellValue = source.notes || null
                                else if (col === "links") cellValue = source.links || null
                                else if (col === "bibtex") cellValue = source.bibtex || null

                                return (
                                  <TableCell key={col}>
                                    {col === "topics" ? (
                                      source.topicNames && source.topicNames.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {source.topicNames.map((topicName, i) => (
                                            <Badge
                                              key={i}
                                              variant="outline"
                                              style={{
                                                backgroundColor: source.topicColors?.[topicName] || "#3b82f6",
                                                color: "white",
                                                borderColor: source.topicColors?.[topicName] || "#3b82f6",
                                              }}
                                            >
                                              {topicName}
                                            </Badge>
                                          ))}
                                        </div>
                                      ) : (
                                        "-"
                                      )
                                    ) : col === "publicationDate" ? (
                                      <div className="max-w-[150px] text-sm">{formatPublicationDate(cellValue)}</div>
                                    ) : col === "links" ? (
                                      <div className="max-w-[300px] text-sm">{renderLinks(cellValue)}</div>
                                    ) : col === "authors" ? (
                                      <div className="max-w-[200px] text-sm whitespace-pre-wrap break-words">{cellValue || "-"}</div>
                                    ) : col === "bibtex" || col === "description" || col === "notes" ? (
                                      <div className="max-w-[400px] text-sm whitespace-pre-wrap break-words">{cellValue || "-"}</div>
                                    ) : (
                                      <div className="truncate max-w-[200px]">{cellValue || "-"}</div>
                                    )}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false)
                setImportFile(null)
                setImportType("csv")
                setImportData([])
                setSelectedImportIndices(new Set())
              }}
              disabled={importing}
            >
              {t.sources.import.cancel}
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || selectedImportIndices.size === 0 || !importFile}
            >
              {importing ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {t.sources.import.importing}
                </>
              ) : (
                t.sources.import.importSelected
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BibTeX Export Dialog */}
      <Dialog open={bibtexExportDialogOpen} onOpenChange={setBibtexExportDialogOpen}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[95vh] overflow-hidden !flex !flex-col">
          <DialogHeader>
            <DialogTitle>Export BibTeX</DialogTitle>
            <DialogDescription>
              Select sources to export as BibTeX. Choose to copy to clipboard or download as a file.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {selectedBibtexExportSourceIds.size} source{selectedBibtexExportSourceIds.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Topic Filter</Label>
                  <Select value={bibtexExportTopicFilter} onValueChange={(v) => { 
                    setBibtexExportTopicFilter(v)
                    // Reselect all sources with new filter
                    const filtered = v === "all" 
                      ? sources 
                      : sources.filter(s => s.topics.some(t => t.id === v))
                    setSelectedBibtexExportSourceIds(new Set(filtered.map(s => s.id)))
                  }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Topics" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics</SelectItem>
                      {topics.map((topic) => (
                        <SelectItem key={topic.id} value={topic.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full border border-border"
                              style={{ backgroundColor: topic.color }}
                            />
                            <span>{topic.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Label className="text-xs text-muted-foreground mb-1 block w-full">Columns</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="bibtex-export-desc"
                        checked={bibtexExportColumnVisibility.description}
                        onCheckedChange={(checked) => {
                          setBibtexExportColumnVisibility({ ...bibtexExportColumnVisibility, description: checked as boolean })
                        }}
                      />
                      <Label htmlFor="bibtex-export-desc" className="text-sm cursor-pointer">Description</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="bibtex-export-notes"
                        checked={bibtexExportColumnVisibility.notes}
                        onCheckedChange={(checked) => {
                          setBibtexExportColumnVisibility({ ...bibtexExportColumnVisibility, notes: checked as boolean })
                        }}
                      />
                      <Label htmlFor="bibtex-export-notes" className="text-sm cursor-pointer">Notes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="bibtex-export-topics"
                        checked={bibtexExportColumnVisibility.topics}
                        onCheckedChange={(checked) => {
                          setBibtexExportColumnVisibility({ ...bibtexExportColumnVisibility, topics: checked as boolean })
                        }}
                      />
                      <Label htmlFor="bibtex-export-topics" className="text-sm cursor-pointer">Topics</Label>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const filtered = bibtexExportTopicFilter === "all" 
                        ? sources 
                        : sources.filter(s => s.topics.some(t => t.id === bibtexExportTopicFilter))
                      setSelectedBibtexExportSourceIds(new Set(filtered.map(s => s.id)))
                    }}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSelectedBibtexExportSourceIds(new Set())
                    }}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
            </div>
            {sources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sources available
              </div>
            ) : (() => {
              const filteredSources = bibtexExportTopicFilter === "all" 
                ? sources 
                : sources.filter(s => s.topics.some(t => t.id === bibtexExportTopicFilter))
              
              return (
                <div className="flex-1 overflow-auto border rounded-lg">
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedBibtexExportSourceIds.size === filteredSources.length && filteredSources.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedBibtexExportSourceIds(new Set(filteredSources.map(s => s.id)))
                                } else {
                                  setSelectedBibtexExportSourceIds(new Set())
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Abbreviation</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Authors</TableHead>
                          <TableHead>Publication Date</TableHead>
                          {bibtexExportColumnVisibility.description && <TableHead>Description</TableHead>}
                          {bibtexExportColumnVisibility.notes && <TableHead>Notes</TableHead>}
                          {bibtexExportColumnVisibility.topics && <TableHead>Topics</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSources.map((source) => {
                          const isSelected = selectedBibtexExportSourceIds.has(source.id)

                          return (
                            <TableRow key={source.id} className={isSelected ? "" : "opacity-50"}>
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedBibtexExportSourceIds)
                                    if (checked) {
                                      newSelected.add(source.id)
                                    } else {
                                      newSelected.delete(source.id)
                                    }
                                    setSelectedBibtexExportSourceIds(newSelected)
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="whitespace-nowrap">{source.abbreviation || "-"}</div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[300px] truncate">{source.title || "-"}</div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[200px] text-sm whitespace-pre-wrap break-words">{source.authors || "-"}</div>
                              </TableCell>
                              <TableCell>
                                <div className="whitespace-nowrap text-sm">{formatPublicationDate(source.publicationDate)}</div>
                              </TableCell>
                              {bibtexExportColumnVisibility.description && (
                                <TableCell>
                                  <div className="max-w-[250px] text-sm whitespace-pre-wrap break-words">{source.description || "-"}</div>
                                </TableCell>
                              )}
                              {bibtexExportColumnVisibility.notes && (
                                <TableCell>
                                  <div className="max-w-[250px] text-sm whitespace-pre-wrap break-words">{source.notes || "-"}</div>
                                </TableCell>
                              )}
                              {bibtexExportColumnVisibility.topics && (
                                <TableCell>
                                  {source.topics.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {source.topics.map((topic) => (
                                        <Badge
                                          key={topic.id}
                                          variant="outline"
                                          style={{
                                            backgroundColor: topic.color,
                                            color: "white",
                                            borderColor: topic.color,
                                          }}
                                        >
                                          {topic.abbreviation || topic.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBibtexExportDialogOpen(false)
                setSelectedBibtexExportSourceIds(new Set())
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyBibtexToClipboard}
              disabled={selectedBibtexExportSourceIds.size === 0}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </Button>
            <Button
              onClick={handleDownloadBibtexFile}
              disabled={selectedBibtexExportSourceIds.size === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Download as File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Topics Dialog */}
      <Dialog open={manageTopicsDialogOpen} onOpenChange={setManageTopicsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Topics</DialogTitle>
            <DialogDescription>Add, edit, delete, or merge topics</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Merge Topics Section */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Merge className="h-4 w-4" />
                <h3 className="font-semibold">Merge Topics</h3>
              </div>
              <p className="text-sm text-muted-foreground">Select multiple topics to merge into one</p>
              
              <div className="grid gap-4">
                <div>
                  <Label>Topics to Merge (select 2 or more)</Label>
                  <div className="mt-2 max-h-[150px] overflow-y-auto border rounded-md p-2 space-y-2">
                    {topics.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No topics available</p>
                    ) : (
                      topics.map((topic) => (
                        <div key={topic.id} className="flex items-center space-x-2">
                          <Checkbox
                            checked={selectedTopicsToMerge.has(topic.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedTopicsToMerge)
                              if (checked) {
                                newSelected.add(topic.id)
                              } else {
                                newSelected.delete(topic.id)
                              }
                              setSelectedTopicsToMerge(newSelected)
                            }}
                          />
                          <Badge
                            style={{ backgroundColor: topic.color, color: "white", borderColor: topic.color }}
                            variant="outline"
                          >
                            {topic.abbreviation || topic.name}
                          </Badge>
                          <span className="text-sm">{topic.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="merge-name">Merged Topic Name *</Label>
                      <Input
                        id="merge-name"
                        value={mergeTopicData.name}
                        onChange={(e) => setMergeTopicData({ ...mergeTopicData, name: e.target.value })}
                        placeholder="Enter name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="merge-abbreviation">Abbreviation</Label>
                      <Input
                        id="merge-abbreviation"
                        value={mergeTopicData.abbreviation}
                        onChange={(e) => setMergeTopicData({ ...mergeTopicData, abbreviation: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="merge-color">Color</Label>
                    <div className="flex gap-2">
                      <div className="flex flex-wrap gap-2 flex-1">
                        {PREDEFINED_COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setMergeTopicData({ ...mergeTopicData, color: color.value })}
                            className={`w-8 h-8 rounded-md border-2 transition-all ${
                              mergeTopicData.color === color.value
                                ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground"
                                : "border-border hover:border-foreground/50"
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                      </div>
                      <Input
                        id="merge-color"
                        type="color"
                        value={mergeTopicData.color}
                        onChange={(e) => setMergeTopicData({ ...mergeTopicData, color: e.target.value })}
                        className="w-12 h-8"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleMergeTopics}
                  disabled={selectedTopicsToMerge.size < 2 || !mergeTopicData.name.trim() || mergingTopics}
                >
                  {mergingTopics ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <Merge className="mr-2 h-4 w-4" />
                      Merge {selectedTopicsToMerge.size} Topic{selectedTopicsToMerge.size !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Topics List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">All Topics</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTopic(null)
                    setEditingTopicData({ name: "", abbreviation: "", color: "#3b82f6" })
                    setCreateTopicDialogOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Topic
                </Button>
              </div>

              {topics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No topics yet. Create one to get started.</p>
              ) : (
                <div className="space-y-2">
                  {topics.map((topic) => (
                    <div
                      key={topic.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          style={{ backgroundColor: topic.color, color: "white", borderColor: topic.color }}
                          variant="outline"
                        >
                          {topic.abbreviation || topic.name}
                        </Badge>
                        <div>
                          <div className="font-medium">{topic.name}</div>
                          {topic.abbreviation && topic.abbreviation !== topic.name && (
                            <div className="text-xs text-muted-foreground">{topic.abbreviation}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTopic(topic)
                            setEditingTopicData({
                              name: topic.name,
                              abbreviation: topic.abbreviation || "",
                              color: topic.color,
                            })
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTopicToDelete({ id: topic.id, name: topic.name })
                            setDeleteTopicDialogOpen(true)
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageTopicsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Topic Confirmation Dialog */}
      <AlertDialog open={deleteTopicDialogOpen} onOpenChange={setDeleteTopicDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{topicToDelete?.name}&quot;? This will remove it from all sources. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (topicToDelete) {
                  handleDeleteTopic(topicToDelete.id)
                  setDeleteTopicDialogOpen(false)
                  setTopicToDelete(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Topic Dialog */}
      <Dialog 
        open={editingTopic !== null} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingTopic(null)
            setEditingTopicData({ name: "", abbreviation: "", color: "#3b82f6" })
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Topic</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-topic-name">Name *</Label>
              <Input
                id="edit-topic-name"
                value={editingTopicData.name}
                onChange={(e) => setEditingTopicData({ ...editingTopicData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-topic-abbreviation">Abbreviation</Label>
              <Input
                id="edit-topic-abbreviation"
                value={editingTopicData.abbreviation}
                onChange={(e) => setEditingTopicData({ ...editingTopicData, abbreviation: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-topic-color">Color</Label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEditingTopicData({ ...editingTopicData, color: color.value })}
                      className={`w-10 h-10 rounded-md border-2 transition-all ${
                        editingTopicData.color === color.value
                          ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground"
                          : "border-border hover:border-foreground/50"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-topic-color"
                    type="color"
                    value={editingTopicData.color}
                    onChange={(e) => setEditingTopicData({ ...editingTopicData, color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={editingTopicData.color}
                    onChange={(e) => setEditingTopicData({ ...editingTopicData, color: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTopic(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTopic} disabled={!editingTopicData.name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
