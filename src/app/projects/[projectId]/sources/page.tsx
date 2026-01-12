"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useTranslations } from "@/lib/i18n"
import { getSources, getTopics, createSource, updateSource, deleteSource, createTopic } from "@/app/actions/sources"
import { parseBibtex, serializeBibtex, bibtexToSourceFields, sourceFieldsToBibtex, bibtexFieldsMatch } from "@/lib/bibtex"
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
import { Plus, MoreVertical, Trash2, Copy, FileText, Settings2, ArrowUpDown, Search, X, ChevronUp, ChevronDown } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { useParams } from "next/navigation"

type Source = {
  id: string
  projectId: string
  abbreviation: string
  title: string
  description: string | null
  authors: string | null
  publicationDate: string | null
  notes: string | null
  links: string | null
  bibtex: string | null
  topics: Array<{
    id: string
    abbreviation: string
    name: string
    color: string
  }>
}

type Topic = {
  id: string
  projectId: string
  abbreviation: string
  name: string
  description: string | null
  notes: string | null
  color: string
}

type ColumnKey = "abbreviation" | "title" | "authors" | "publicationDate" | "topics" | "description" | "notes" | "links" | "bibtex"

const COLUMN_ORDER: ColumnKey[] = ["abbreviation", "title", "authors", "publicationDate", "topics", "description", "notes", "links", "bibtex"]

// Cookie helper functions
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
}

function loadPreferences(projectId: string) {
  const prefix = `sources_prefs_${projectId}_`
  const columnVisibility = getCookie(`${prefix}columnVisibility`)
  const columnOrder = getCookie(`${prefix}columnOrder`)
  const topicFilter = getCookie(`${prefix}topicFilter`)
  const yearFromFilter = getCookie(`${prefix}yearFromFilter`)
  const yearToFilter = getCookie(`${prefix}yearToFilter`)
  const authorFilter = getCookie(`${prefix}authorFilter`)
  const pageSize = getCookie(`${prefix}pageSize`)

  return {
    columnVisibility: columnVisibility ? JSON.parse(columnVisibility) : null,
    columnOrder: columnOrder ? JSON.parse(columnOrder) : null,
    topicFilter: topicFilter || null,
    yearFromFilter: yearFromFilter || null,
    yearToFilter: yearToFilter || null,
    authorFilter: authorFilter || null,
    pageSize: pageSize ? (pageSize === "all" ? "all" : parseInt(pageSize)) : null,
  }
}

function savePreferences(projectId: string, prefs: {
  columnVisibility?: Record<ColumnKey, boolean>
  columnOrder?: ColumnKey[]
  topicFilter?: string
  yearFromFilter?: string
  yearToFilter?: string
  authorFilter?: string
  pageSize?: number | "all"
}) {
  const prefix = `sources_prefs_${projectId}_`
  if (prefs.columnVisibility) setCookie(`${prefix}columnVisibility`, JSON.stringify(prefs.columnVisibility))
  if (prefs.columnOrder) setCookie(`${prefix}columnOrder`, JSON.stringify(prefs.columnOrder))
  if (prefs.topicFilter !== undefined) setCookie(`${prefix}topicFilter`, prefs.topicFilter)
  if (prefs.yearFromFilter !== undefined) setCookie(`${prefix}yearFromFilter`, prefs.yearFromFilter)
  if (prefs.yearToFilter !== undefined) setCookie(`${prefix}yearToFilter`, prefs.yearToFilter)
  if (prefs.authorFilter !== undefined) setCookie(`${prefix}authorFilter`, prefs.authorFilter)
  if (prefs.pageSize !== undefined) setCookie(`${prefix}pageSize`, prefs.pageSize.toString())
}

export default function SourcesPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const { t } = useTranslations()
  
  const [sources, setSources] = useState<Source[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Column visibility and order
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    abbreviation: true,
    title: true,
    authors: true,
    publicationDate: true,
    topics: true,
    description: true,
    notes: true,
    links: true,
    bibtex: false,
  })
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(COLUMN_ORDER)
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null)
  const [dragOverColumnIndex, setDragOverColumnIndex] = useState<number | null>(null)
  
  // Filters and sorting
  const [searchQuery, setSearchQuery] = useState("")
  const [topicFilter, setTopicFilter] = useState<string>("all")
  const [yearFromFilter, setYearFromFilter] = useState<string>("all")
  const [yearToFilter, setYearToFilter] = useState<string>("all")
  const [authorFilter, setAuthorFilter] = useState<string>("all")
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  
  // Pagination
  const [pageSize, setPageSize] = useState<number | "all">(25)
  const [currentPage, setCurrentPage] = useState(1)
  
  // Editing state
  const [editingCell, setEditingCell] = useState<{ sourceId: string; column: ColumnKey } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [originalValue, setOriginalValue] = useState<string>("")
  
  // Add source form state
  const [newSource, setNewSource] = useState({
    abbreviation: "",
    title: "",
    authors: "",
    publicationDate: "",
    description: "",
    notes: "",
    links: "",
    bibtex: "",
    topicIds: [] as string[],
  })
  const [creating, setCreating] = useState(false)
  const [createTopicDialogOpen, setCreateTopicDialogOpen] = useState(false)
  const [newTopic, setNewTopic] = useState({
    name: "",
    abbreviation: "",
    color: "#3b82f6",
  })
  const [customColor, setCustomColor] = useState(false)

  const predefinedColors = [
    { name: "Blue", value: "#3b82f6" },
    { name: "Green", value: "#10b981" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Yellow", value: "#eab308" },
    { name: "Purple", value: "#a855f7" },
    { name: "Pink", value: "#ec4899" },
  ]

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [sourcesData, topicsData] = await Promise.all([
        getSources(projectId),
        getTopics(projectId),
      ])
      setSources(sourcesData as Source[])
      setTopics(topicsData as Topic[])
    } catch (error) {
      toast.error(t.errors.generic)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [projectId, t.errors.generic])

  // Load preferences from cookies on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPrefs = loadPreferences(projectId)
      if (savedPrefs.columnVisibility) {
        setColumnVisibility(savedPrefs.columnVisibility)
      }
      if (savedPrefs.columnOrder) {
        setColumnOrder(savedPrefs.columnOrder)
      }
      if (savedPrefs.topicFilter) {
        setTopicFilter(savedPrefs.topicFilter)
      }
      if (savedPrefs.yearFromFilter) {
        setYearFromFilter(savedPrefs.yearFromFilter)
      }
      if (savedPrefs.yearToFilter) {
        setYearToFilter(savedPrefs.yearToFilter)
      }
      if (savedPrefs.authorFilter) {
        setAuthorFilter(savedPrefs.authorFilter)
      }
      if (savedPrefs.pageSize) {
        setPageSize(savedPrefs.pageSize)
      }
    }
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Save preferences to cookies when they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      savePreferences(projectId, {
        columnVisibility,
        columnOrder,
        topicFilter,
        yearFromFilter,
        yearToFilter,
        authorFilter,
        pageSize,
      })
    }
  }, [projectId, columnVisibility, columnOrder, topicFilter, yearFromFilter, yearToFilter, authorFilter, pageSize])

  // Filter and sort sources
  const filteredAndSortedSources = useMemo(() => {
    let filtered = [...sources]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((source) => {
        return (
          source.abbreviation?.toLowerCase().includes(query) ||
          source.title?.toLowerCase().includes(query) ||
          source.authors?.toLowerCase().includes(query) ||
          source.description?.toLowerCase().includes(query) ||
          source.notes?.toLowerCase().includes(query) ||
          source.links?.toLowerCase().includes(query) ||
          source.bibtex?.toLowerCase().includes(query) ||
          source.topics.some((t) => t.name.toLowerCase().includes(query))
        )
      })
    }

    // Topic filter
    if (topicFilter !== "all") {
      filtered = filtered.filter((source) =>
        source.topics.some((t) => t.id === topicFilter)
      )
    }

    // Year range filter
    if (yearFromFilter !== "all" || yearToFilter !== "all") {
      filtered = filtered.filter((source) => {
        if (!source.publicationDate) return false
        const year = parseInt(source.publicationDate.substring(0, 4))
        const fromYear = yearFromFilter !== "all" ? parseInt(yearFromFilter) : null
        const toYear = yearToFilter !== "all" ? parseInt(yearToFilter) : null
        
        if (fromYear !== null && toYear !== null) {
          return year >= fromYear && year <= toYear
        } else if (fromYear !== null) {
          return year >= fromYear
        } else if (toYear !== null) {
          return year <= toYear
        }
        return true
      })
    }

    // Author filter
    if (authorFilter !== "all") {
      filtered = filtered.filter((source) => {
        if (!source.authors) return false
        return source.authors.toLowerCase().includes(authorFilter.toLowerCase())
      })
    }

    // Sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | null = null
        let bVal: string | null = null

        switch (sortColumn) {
          case "abbreviation":
            aVal = a.abbreviation
            bVal = b.abbreviation
            break
          case "title":
            aVal = a.title
            bVal = b.title
            break
          case "authors":
            aVal = a.authors
            bVal = b.authors
            break
          case "publicationDate":
            aVal = a.publicationDate
            bVal = b.publicationDate
            break
          case "description":
            aVal = a.description
            bVal = b.description
            break
          case "notes":
            aVal = a.notes
            bVal = b.notes
            break
          case "links":
            aVal = a.links
            bVal = b.links
            break
          case "bibtex":
            aVal = a.bibtex
            bVal = b.bibtex
            break
        }

        if (aVal === null && bVal === null) return 0
        if (aVal === null) return 1
        if (bVal === null) return -1

        const comparison = aVal.localeCompare(bVal)
        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return filtered
  }, [sources, searchQuery, topicFilter, yearFromFilter, yearToFilter, authorFilter, sortColumn, sortDirection])

  // Pagination
  const paginatedSources = useMemo(() => {
    if (pageSize === "all") return filteredAndSortedSources
    const start = (currentPage - 1) * pageSize
    return filteredAndSortedSources.slice(start, start + pageSize)
  }, [filteredAndSortedSources, pageSize, currentPage])

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1
    return Math.ceil(filteredAndSortedSources.length / pageSize)
  }, [filteredAndSortedSources.length, pageSize])

  // Get unique years and authors for filters
  const uniqueYears = useMemo(() => {
    const years = new Set<string>()
    sources.forEach((source) => {
      if (source.publicationDate) {
        const year = source.publicationDate.substring(0, 4)
        if (year) years.add(year)
      }
    })
    return Array.from(years).sort().reverse()
  }, [sources])

  const uniqueAuthors = useMemo(() => {
    const authors = new Set<string>()
    sources.forEach((source) => {
      if (source.authors) {
        // Split by comma and add each author
        source.authors.split(",").forEach((author) => {
          const trimmed = author.trim()
          if (trimmed) authors.add(trimmed)
        })
      }
    })
    return Array.from(authors).sort()
  }, [sources])

  const handleCellDoubleClick = (sourceId: string, column: ColumnKey, currentValue: string | null) => {
    setEditingCell({ sourceId, column })
    const value = currentValue || ""
    setEditValue(value)
    setOriginalValue(value)
  }

  const handleCellCancel = () => {
    // Reset to original value and close editing
    setEditValue(originalValue)
    setEditingCell(null)
    setOriginalValue("")
  }

  const handleCellSave = async () => {
    if (!editingCell) return

    const source = sources.find((s) => s.id === editingCell.sourceId)
    if (!source) return

    try {
      const updateData: any = { [editingCell.column]: editValue || null }

      // Handle BibTeX sync
      if (editingCell.column === "bibtex") {
        const parsed = parseBibtex(editValue)
        if (parsed) {
          const fields = bibtexToSourceFields(parsed)
          updateData.title = fields.title || source.title
          updateData.authors = fields.authors || source.authors
          updateData.publicationDate = fields.publicationDate || source.publicationDate
          updateData.abbreviation = fields.abbreviation || source.abbreviation
        }
      } else {
        // If editing a field, check if we should update BibTeX
        const currentBibtex = source.bibtex ? parseBibtex(source.bibtex) : null
        if (currentBibtex) {
          const sourceFields = {
            title: editingCell.column === "title" ? editValue : source.title,
            authors: editingCell.column === "authors" ? editValue : source.authors,
            publicationDate: editingCell.column === "publicationDate" ? editValue : source.publicationDate,
          }
          
          // Check if BibTeX matches current source fields (before edit)
          const beforeEdit = {
            title: source.title,
            authors: source.authors,
            publicationDate: source.publicationDate,
          }
          
          if (bibtexFieldsMatch(currentBibtex, currentBibtex, beforeEdit)) {
            // Update BibTeX to match new values
            const newBibtex = sourceFieldsToBibtex({
              abbreviation: source.abbreviation,
              title: sourceFields.title || "",
              authors: sourceFields.authors || null,
              publicationDate: sourceFields.publicationDate || null,
              description: source.description,
              notes: source.notes,
              links: source.links,
            })
            updateData.bibtex = serializeBibtex(newBibtex)
          }
        }
      }

      await updateSource(projectId, editingCell.sourceId, updateData)
      
      // Update local state without reloading
      setSources((prevSources) =>
        prevSources.map((s) => {
          if (s.id === editingCell.sourceId) {
            const updated = { ...s, ...updateData }
            // If BibTeX was updated, we might need to update other fields too
            if (updateData.bibtex && editingCell.column === "bibtex") {
              const parsed = parseBibtex(updateData.bibtex)
              if (parsed) {
                const fields = bibtexToSourceFields(parsed)
                if (fields.title) updated.title = fields.title
                if (fields.authors) updated.authors = fields.authors
                if (fields.publicationDate) updated.publicationDate = fields.publicationDate
                if (fields.abbreviation) updated.abbreviation = fields.abbreviation
              }
            }
            return updated
          }
          return s
        })
      )
      
      toast.success(t.sources.sourceUpdated)
      setEditingCell(null)
      setEditValue("")
      setOriginalValue("")
    } catch (error) {
      toast.error(t.errors.generic)
      console.error(error)
    }
  }

  const handleDeleteClick = (sourceId: string) => {
    setSourceToDelete(sourceId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!sourceToDelete) return

    try {
      setDeleting(true)
      await deleteSource(projectId, sourceToDelete)
      toast.success(t.sources.sourceDeleted)
      setDeleteDialogOpen(false)
      setSourceToDelete(null)
      await loadData()
    } catch (error) {
      toast.error(t.errors.generic)
      console.error(error)
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyBibtex = async (bibtex: string | null) => {
    if (!bibtex) {
      toast.error("No BibTeX available")
      return
    }
    try {
      await navigator.clipboard.writeText(bibtex)
      toast.success(t.sources.bibtexCopied)
    } catch (error) {
      toast.error("Failed to copy BibTeX")
    }
  }

  const handleAddSource = async () => {
    try {
      setCreating(true)
      
      let sourceData = { ...newSource }
      
      // If BibTeX is provided, parse it and merge with form data
      if (newSource.bibtex.trim()) {
        const parsed = parseBibtex(newSource.bibtex)
        if (parsed) {
          const bibtexFields = bibtexToSourceFields(parsed)
          // Only use BibTeX values if form fields are empty
          if (!sourceData.abbreviation && bibtexFields.abbreviation) {
            sourceData.abbreviation = bibtexFields.abbreviation
          }
          if (!sourceData.title && bibtexFields.title) {
            sourceData.title = bibtexFields.title
          }
          if (!sourceData.authors && bibtexFields.authors) {
            sourceData.authors = bibtexFields.authors
          }
          if (!sourceData.publicationDate && bibtexFields.publicationDate) {
            sourceData.publicationDate = bibtexFields.publicationDate
          }
        }
      } else {
        // If no BibTeX but form fields are filled, generate BibTeX
        if (sourceData.title) {
          const bibtexEntry = sourceFieldsToBibtex({
            abbreviation: sourceData.abbreviation || "",
            title: sourceData.title,
            authors: sourceData.authors || null,
            publicationDate: sourceData.publicationDate || null,
            description: sourceData.description || null,
            notes: sourceData.notes || null,
            links: sourceData.links || null,
          })
          sourceData.bibtex = serializeBibtex(bibtexEntry)
        }
      }

      await createSource(projectId, {
        abbreviation: sourceData.abbreviation || null,
        title: sourceData.title,
        description: sourceData.description || null,
        authors: sourceData.authors || null,
        publicationDate: sourceData.publicationDate || null,
        notes: sourceData.notes || null,
        links: sourceData.links || null,
        bibtex: sourceData.bibtex || null,
        topicIds: sourceData.topicIds,
      })
      
      toast.success(t.sources.sourceCreated)
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
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setCreating(false)
    }
  }

  const handleCreateTopic = async () => {
    try {
      const topic = await createTopic(projectId, {
        abbreviation: newTopic.abbreviation || null,
        name: newTopic.name,
        color: newTopic.color,
      })
      setTopics([...topics, topic as Topic])
      setCreateTopicDialogOpen(false)
      setNewTopic({ name: "", abbreviation: "", color: "#3b82f6" })
      setCustomColor(false)
      toast.success("Topic created successfully")
    } catch (error) {
      toast.error(t.errors.generic)
    }
  }

  const handleSort = (column: ColumnKey) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else {
        setSortColumn(null)
        setSortDirection("asc")
      }
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const getColumnLabel = (key: ColumnKey) => {
    return t.sources.columns[key]
  }

  // Format publication date to show only what's entered
  // The database stores dates as YYYY-MM-DD (normalized), but we want to show only what user entered
  // We'll check the original input by looking at the stored format
  const formatPublicationDate = (date: string | null): string => {
    if (!date) return "-"
    
    // If it's just a year (YYYY) - 4 digits only
    if (/^\d{4}$/.test(date)) {
      return date
    }
    
    // If it's year-month (YYYY-MM) - 7 characters, ends with -MM
    if (/^\d{4}-\d{2}$/.test(date)) {
      return date
    }
    
    // If it's full date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split("-")
      // If day is 01, it was likely entered as YYYY-MM, so show that
      if (day === "01") {
        // Check if month is 01 too - then it was likely just a year
        if (month === "01") {
          return year
        }
        return `${year}-${month}`
      }
      // Otherwise show full date
      return date
    }
    
    return date
  }

  // Render links as clickable with newlines
  const renderLinks = (links: string | null): React.ReactNode => {
    if (!links) return "-"
    const linkArray = links.split(",").map(link => link.trim()).filter(link => link)
    return (
      <div className="flex flex-col gap-1">
        {linkArray.map((link, index) => {
          // Ensure link has protocol
          const url = link.startsWith("http://") || link.startsWith("https://") ? link : `https://${link}`
          return (
            <a
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {link}
            </a>
          )
        })}
      </div>
    )
  }

  const visibleColumns = columnOrder.filter((col) => columnVisibility[col])

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

      {/* Filters and Search */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-4">
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

          <div className="flex flex-col">
            <Label className="text-xs text-muted-foreground mb-1 block opacity-0">Add</Label>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t.sources.addSource}
            </Button>
          </div>
        </div>
      </div>

      {/* Column Settings */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="mb-4">
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
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((col) => (
                    <TableHead
                      key={col}
                      className="cursor-pointer select-none"
                      onClick={() => handleSort(col)}
                    >
                      <div className="flex items-center gap-2">
                        {getColumnLabel(col)}
                        {sortColumn === col && (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                      No sources match your filters
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
                            className={col !== "topics" && col !== "bibtex" ? "cursor-pointer" : ""}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                {(col === "bibtex" || col === "description" || col === "notes") ? (
                                  <Textarea
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={(e) => {
                                      // Only save if the blur is not caused by clicking the cancel button
                                      if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('button[title="Cancel"]')) {
                                        handleCellSave()
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        handleCellSave()
                                      } else if (e.key === "Escape") {
                                        e.preventDefault()
                                        handleCellCancel()
                                      }
                                      // Shift+Enter allows new line (default behavior)
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
                                      // Only save if the blur is not caused by clicking the cancel button
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
                                    // Prevent blur event from firing on the input
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
                                              
                                              await updateSource(projectId, source.id, { topicIds: newTopicIds })
                                              
                                              // Update local state without reloading
                                              setSources((prevSources) =>
                                                prevSources.map((s) => {
                                                  if (s.id === source.id) {
                                                    // Get the topic data for the new topic IDs
                                                    const newTopics = newTopicIds
                                                      .map((topicId) => {
                                                        const topicData = topics.find((t) => t.id === topicId)
                                                        return topicData
                                                          ? {
                                                              id: topicData.id,
                                                              abbreviation: topicData.abbreviation,
                                                              name: topicData.name,
                                                              color: topicData.color,
                                                            }
                                                          : null
                                                      })
                                                      .filter((t): t is NonNullable<typeof t> => t !== null)
                                                    
                                                    return {
                                                      ...s,
                                                      topics: newTopics,
                                                    }
                                                  }
                                                  return s
                                                })
                                              )
                                              
                                              toast.success(t.sources.sourceUpdated)
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
                              <div className="max-w-[400px] text-sm whitespace-pre-wrap break-words">
                                {cellValue || "-"}
                              </div>
                            ) : col === "publicationDate" ? (
                              <div className="max-w-[150px] text-sm">{formatPublicationDate(cellValue)}</div>
                            ) : col === "links" ? (
                              <div className="max-w-[300px] text-sm">{renderLinks(cellValue)}</div>
                            ) : col === "authors" ? (
                              <div className="max-w-[200px] text-sm whitespace-pre-wrap break-words">{cellValue || "-"}</div>
                            ) : (
                              <div className="truncate max-w-[200px]">{cellValue || "-"}</div>
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
                  // Auto-fill fields from BibTeX if they're empty
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
                  {predefinedColors.map((color) => (
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
    </div>
  )
}
