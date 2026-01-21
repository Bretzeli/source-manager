/**
 * Custom hook for sources page business logic
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { useTranslations } from "@/lib/i18n"
import { getSources, getTags, createSource, updateSource, deleteSource, deleteAllSources, createTag, updateTag, deleteTag, mergeTags, batchImportSources } from "@/app/actions/sources"
import { getProject } from "@/app/actions/projects"
import { parseBibtex, serializeBibtex, bibtexToSourceFields, sourceFieldsToBibtex, bibtexFieldsMatch } from "@/lib/bibtex"
import { loadPreferences, savePreferences } from "@/lib/sources-preferences"
import { parseImportFile, exportToCSV, exportToJSON, formatPublicationDate, sanitizeFilename } from "@/lib/sources-utils"
import type { Source, Tag, ColumnKey, ImportSourceData } from "@/types/sources"
import { COLUMN_ORDER } from "@/types/sources"

export function useSources() {
  const params = useParams()
  const projectId = params.projectId as string
  const { t } = useTranslations()

  const [sources, setSources] = useState<Source[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [projectName, setProjectName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [selectedDeleteSourceIds, setSelectedDeleteSourceIds] = useState<Set<string>>(new Set())

  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    abbreviation: true,
    title: true,
    authors: true,
    publicationDate: true,
    tags: true,
    description: true,
    notes: true,
    links: true,
    bibtex: false,
  })
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(COLUMN_ORDER)
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null)
  const [dragOverColumnIndex, setDragOverColumnIndex] = useState<number | null>(null)
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>({
    abbreviation: 120,
    title: 200,
    authors: 180,
    publicationDate: 120,
    tags: 120,
    description: 250,
    notes: 250,
    links: 250,
    bibtex: 350,
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [yearFromFilter, setYearFromFilter] = useState<string>("all")
  const [yearToFilter, setYearToFilter] = useState<string>("all")
  const [authorFilter, setAuthorFilter] = useState<string>("all")
  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const [pageSize, setPageSize] = useState<number | "all">(25)
  const [currentPage, setCurrentPage] = useState(1)

  const [editingCell, setEditingCell] = useState<{ sourceId: string; column: ColumnKey } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [originalValue, setOriginalValue] = useState<string>("")

  const [newSource, setNewSource] = useState({
    abbreviation: "",
    title: "",
    authors: "",
    publicationDate: "",
    description: "",
    notes: "",
    links: "",
    bibtex: "",
    tagIds: [] as string[],
  })
  const [creating, setCreating] = useState(false)
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false)
  const [newTag, setNewTag] = useState({
    name: "",
    abbreviation: "",
    color: "#3b82f6",
  })
  const [customColor, setCustomColor] = useState(false)

  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<"csv" | "json" | "miro-csv">("csv")
  const [importData, setImportData] = useState<ImportSourceData[]>([])
  const [selectedImportIndices, setSelectedImportIndices] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [existingBibtexSet, setExistingBibtexSet] = useState<Set<string>>(new Set())

  const [importColumnVisibility, setImportColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    abbreviation: true,
    title: true,
    authors: true,
    publicationDate: true,
    tags: true,
    description: true,
    notes: true,
    links: true,
    bibtex: true,
  })
  const [importColumnOrder, setImportColumnOrder] = useState<ColumnKey[]>(COLUMN_ORDER)
  const [importDraggedColumnIndex, setImportDraggedColumnIndex] = useState<number | null>(null)
  const [importDragOverColumnIndex, setImportDragOverColumnIndex] = useState<number | null>(null)

  const [bibtexExportDialogOpen, setBibtexExportDialogOpen] = useState(false)
  const [selectedBibtexExportSourceIds, setSelectedBibtexExportSourceIds] = useState<Set<string>>(new Set())
  const [bibtexExportTagFilter, setBibtexExportTagFilter] = useState<string>("all")
  const [bibtexExportColumnVisibility, setBibtexExportColumnVisibility] = useState({
    description: true,
    notes: true,
    tags: true,
  })

  const [manageTagsDialogOpen, setManageTagsDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [editingTagData, setEditingTagData] = useState({
    name: "",
    abbreviation: "",
    color: "#3b82f6",
  })
  const [mergingTags, setMergingTags] = useState(false)
  const [selectedTagsToMerge, setSelectedTagsToMerge] = useState<Set<string>>(new Set())
  const [mergeTagData, setMergeTagData] = useState({
    name: "",
    abbreviation: "",
    color: "#3b82f6",
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [sourcesData, tagsData, projectData] = await Promise.all([
        getSources(projectId),
        getTags(projectId),
        getProject(projectId),
      ])
      setSources(sourcesData as Source[])
      setTags(tagsData as Tag[])
      if (projectData) {
        setProjectName(projectData.title)
      }
    } catch (error) {
      toast.error(t.errors.generic)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [projectId, t.errors.generic])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPrefs = loadPreferences(projectId)
      if (savedPrefs.columnVisibility) {
        setColumnVisibility(savedPrefs.columnVisibility)
      }
      if (savedPrefs.columnOrder) {
        setColumnOrder(savedPrefs.columnOrder)
      }
      if (savedPrefs.columnWidths) {
        setColumnWidths({ ...columnWidths, ...savedPrefs.columnWidths })
      }
      if (savedPrefs.tagFilter) {
        setTagFilter(savedPrefs.tagFilter)
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
        setPageSize(savedPrefs.pageSize as number | "all")
      }
    }
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (typeof window !== "undefined") {
      savePreferences(projectId, {
        columnVisibility,
        columnOrder,
        columnWidths,
        tagFilter,
        yearFromFilter,
        yearToFilter,
        authorFilter,
        pageSize,
      })
    }
  }, [projectId, columnVisibility, columnOrder, columnWidths, tagFilter, yearFromFilter, yearToFilter, authorFilter, pageSize])

  const filteredAndSortedSources = useMemo(() => {
    let filtered = [...sources]

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
          source.tags.some((t) => t.name.toLowerCase().includes(query))
        )
      })
    }

    if (tagFilter !== "all") {
      filtered = filtered.filter((source) => source.tags.some((t) => t.id === tagFilter))
    }

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

    if (authorFilter !== "all") {
      filtered = filtered.filter((source) => {
        if (!source.authors) return false
        return source.authors.toLowerCase().includes(authorFilter.toLowerCase())
      })
    }

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
  }, [sources, searchQuery, tagFilter, yearFromFilter, yearToFilter, authorFilter, sortColumn, sortDirection])

  const paginatedSources = useMemo(() => {
    if (pageSize === "all") return filteredAndSortedSources
    const start = (currentPage - 1) * pageSize
    return filteredAndSortedSources.slice(start, start + pageSize)
  }, [filteredAndSortedSources, pageSize, currentPage])

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1
    return Math.ceil(filteredAndSortedSources.length / pageSize)
  }, [filteredAndSortedSources.length, pageSize])

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
    let value = currentValue || ""
    // For publicationDate, format to show only yyyy or yyyy-mm when day/month are defaults (01-01)
    if (column === "publicationDate" && value) {
      const formatted = formatPublicationDate(value)
      // formatPublicationDate returns "-" for null, but we want empty string for editing
      value = formatted === "-" ? "" : formatted
    }
    setEditValue(value)
    setOriginalValue(value)
  }

  const handleCellCancel = () => {
    setEditValue(originalValue)
    setEditingCell(null)
    setOriginalValue("")
  }

  const handleCellSave = async () => {
    if (!editingCell) return

    const source = sources.find((s) => s.id === editingCell.sourceId)
    if (!source) return

    try {
      const updateData: {
        abbreviation?: string
        title?: string
        description?: string | null
        authors?: string | null
        publicationDate?: string | null
        notes?: string | null
        links?: string | null
        bibtex?: string | null
        tagIds?: string[]
      } = { [editingCell.column]: editValue || null }

      if (editingCell.column === "bibtex") {
        const parsed = parseBibtex(editValue)
        if (parsed) {
          const fields = bibtexToSourceFields(parsed)
          updateData.title = fields.title || source.title
          updateData.authors = fields.authors || source.authors
          updateData.publicationDate = fields.publicationDate || source.publicationDate
          updateData.abbreviation = fields.abbreviation ?? source.abbreviation ?? undefined
        }
      } else {
        const currentBibtex = source.bibtex ? parseBibtex(source.bibtex) : null
        if (currentBibtex) {
          const sourceFields = {
            title: editingCell.column === "title" ? editValue : source.title,
            authors: editingCell.column === "authors" ? editValue : source.authors,
            publicationDate: editingCell.column === "publicationDate" ? editValue : source.publicationDate,
          }

          const beforeEdit = {
            title: source.title,
            authors: source.authors ?? undefined,
            publicationDate: source.publicationDate ?? undefined,
          }

          if (bibtexFieldsMatch(currentBibtex, currentBibtex, beforeEdit)) {
            const newBibtex = sourceFieldsToBibtex({
              abbreviation: source.abbreviation || "",
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

      setSources((prevSources) =>
        prevSources.map((s) => {
          if (s.id === editingCell.sourceId) {
            const updated = { ...s, ...updateData }
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

  const handleDeleteAllClick = () => {
    // Preselect all sources
    setSelectedDeleteSourceIds(new Set(sources.map(s => s.id)))
    setDeleteAllDialogOpen(true)
  }

  const handleDeleteAllConfirm = async () => {
    if (selectedDeleteSourceIds.size === 0) {
      toast.error("No sources selected for deletion")
      return
    }

    try {
      setDeletingAll(true)
      // Delete selected sources one by one (or we could create a batch delete function)
      const deletePromises = Array.from(selectedDeleteSourceIds).map(sourceId => 
        deleteSource(projectId, sourceId)
      )
      await Promise.all(deletePromises)
      toast.success(`${selectedDeleteSourceIds.size} source${selectedDeleteSourceIds.size !== 1 ? 's' : ''} deleted successfully`)
      setDeleteAllDialogOpen(false)
      setSelectedDeleteSourceIds(new Set())
      await loadData()
    } catch (error) {
      toast.error(t.errors.generic)
      console.error(error)
    } finally {
      setDeletingAll(false)
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

      const sourceData = { ...newSource }

      if (newSource.bibtex.trim()) {
        const parsed = parseBibtex(newSource.bibtex)
        if (parsed) {
          const bibtexFields = bibtexToSourceFields(parsed)
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
        tagIds: sourceData.tagIds,
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
        tagIds: [],
      })
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setCreating(false)
    }
  }

  const handleCreateTag = async () => {
    try {
      const tag = await createTag(projectId, {
        abbreviation: newTag.abbreviation || null,
        name: newTag.name,
        color: newTag.color,
      })
      setTags([...tags, tag as Tag])
      setCreateTagDialogOpen(false)
      setNewTag({ name: "", abbreviation: "", color: "#3b82f6" })
      setCustomColor(false)
      toast.success("Tag created successfully")
      await loadData()
    } catch (error) {
      toast.error(t.errors.generic)
    }
  }

  const handleUpdateTag = async () => {
    if (!editingTag) return

    try {
      await updateTag(projectId, editingTag.id, {
        abbreviation: editingTagData.abbreviation || null,
        name: editingTagData.name,
        color: editingTagData.color,
      })
      toast.success("Tag updated successfully")
      setEditingTag(null)
      setEditingTagData({ name: "", abbreviation: "", color: "#3b82f6" })
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTag(projectId, tagId)
      toast.success("Tag deleted successfully")
      // Remove from merge selection if selected
      const newSelected = new Set(selectedTagsToMerge)
      newSelected.delete(tagId)
      setSelectedTagsToMerge(newSelected)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    }
  }

  const handleMergeTags = async () => {
    if (selectedTagsToMerge.size < 2) {
      toast.error("Please select at least 2 tags to merge")
      return
    }

    if (!mergeTagData.name.trim()) {
      toast.error("Please provide a name for the merged tag")
      return
    }

    try {
      setMergingTags(true)
      await mergeTags(projectId, Array.from(selectedTagsToMerge), {
        name: mergeTagData.name,
        abbreviation: mergeTagData.abbreviation || null,
        color: mergeTagData.color,
      })
      toast.success(`Successfully merged ${selectedTagsToMerge.size} tags`)
      setSelectedTagsToMerge(new Set())
      setMergeTagData({ name: "", abbreviation: "", color: "#3b82f6" })
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setMergingTags(false)
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportFile(file)
    const text = await file.text()

    try {
      const importSources = parseImportFile(text, file.name, importType)
      setImportData(importSources)
      setSelectedImportIndices(new Set(importSources.map((_, index) => index)))

      const existingBibtex = new Set(sources.filter((s) => s.bibtex).map((s) => s.bibtex!.trim()))
      setExistingBibtexSet(existingBibtex)
    } catch (error) {
      toast.error(t.sources.import.invalidFile)
      console.error(error)
    }
  }

  const handleExcludeExisting = () => {
    const newSelected = new Set<number>()
    importData.forEach((source, index) => {
      if (!source.bibtex || !existingBibtexSet.has(source.bibtex.trim())) {
        newSelected.add(index)
      }
    })
    setSelectedImportIndices(newSelected)
  }

  const handleImport = async () => {
    if (selectedImportIndices.size === 0) {
      toast.error(t.sources.import.noSourcesToImport)
      return
    }

    try {
      setImporting(true)
      const sourcesToImport = Array.from(selectedImportIndices).map((index) => importData[index])
      await batchImportSources(projectId, sourcesToImport)
      toast.success(t.sources.import.importSuccess)
      setImportDialogOpen(false)
      setImportFile(null)
      setImportType("csv")
      setImportData([])
      setSelectedImportIndices(new Set())
      await loadData()
    } catch (error) {
      toast.error(t.sources.import.importError)
      console.error(error)
    } finally {
      setImporting(false)
    }
  }

  const handleExportCSV = () => {
    exportToCSV(filteredAndSortedSources, projectName, t.sources.title.toLowerCase())
  }

  const handleExportJSON = () => {
    exportToJSON(filteredAndSortedSources, projectName, t.sources.title.toLowerCase())
  }

  const handleOpenBibtexExport = () => {
    // Preselect all sources (respecting tag filter)
    const filteredSources = bibtexExportTagFilter === "all" 
      ? sources 
      : sources.filter(s => s.tags.some(t => t.id === bibtexExportTagFilter))
    setSelectedBibtexExportSourceIds(new Set(filteredSources.map(s => s.id)))
    setBibtexExportDialogOpen(true)
  }

  const getFilteredSourcesForBibtexExport = () => {
    let filtered = sources.filter(s => selectedBibtexExportSourceIds.has(s.id))
    
    // Apply tag filter
    if (bibtexExportTagFilter !== "all") {
      filtered = filtered.filter(s => s.tags.some(t => t.id === bibtexExportTagFilter))
    }
    
    return filtered
  }

  const handleCopyBibtexToClipboard = async () => {
    if (selectedBibtexExportSourceIds.size === 0) {
      toast.error("No sources selected")
      return
    }

    try {
      const selectedSources = getFilteredSourcesForBibtexExport()
      const bibtexEntries: string[] = []

      selectedSources.forEach((source) => {
        if (source.bibtex) {
          bibtexEntries.push(source.bibtex)
        }
      })

      if (bibtexEntries.length === 0) {
        toast.error("No BibTeX entries found in selected sources")
        return
      }

      const combinedBibtex = bibtexEntries.join("\n\n")
      await navigator.clipboard.writeText(combinedBibtex)
      toast.success(`${bibtexEntries.length} BibTeX entr${bibtexEntries.length !== 1 ? 'ies' : 'y'} copied to clipboard`)
      setBibtexExportDialogOpen(false)
    } catch (error) {
      toast.error("Failed to copy BibTeX to clipboard")
      console.error(error)
    }
  }

  const handleDownloadBibtexFile = () => {
    if (selectedBibtexExportSourceIds.size === 0) {
      toast.error("No sources selected")
      return
    }

    try {
      const selectedSources = getFilteredSourcesForBibtexExport()
      const bibtexEntries: string[] = []

      selectedSources.forEach((source) => {
        if (source.bibtex) {
          bibtexEntries.push(source.bibtex)
        }
      })

      if (bibtexEntries.length === 0) {
        toast.error("No BibTeX entries found in selected sources")
        return
      }

      const combinedBibtex = bibtexEntries.join("\n\n")
      const blob = new Blob([combinedBibtex], { type: "text/plain;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      const sanitizedProjectName = sanitizeFilename(projectName)
      const dateStr = new Date().toISOString().split("T")[0]
      link.setAttribute("download", `${sanitizedProjectName}_bibliography_${dateStr}.bib`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success(`${bibtexEntries.length} BibTeX entr${bibtexEntries.length !== 1 ? 'ies' : 'y'} downloaded`)
      setBibtexExportDialogOpen(false)
    } catch (error) {
      toast.error("Failed to download BibTeX file")
      console.error(error)
    }
  }

  const handleUpdateSourceTags = async (sourceId: string, newTagIds: string[]) => {
    try {
      await updateSource(projectId, sourceId, { tagIds: newTagIds })

      setSources((prevSources) =>
        prevSources.map((s) => {
          if (s.id === sourceId) {
            const newTags = newTagIds
              .map((tagId) => {
                const tagData = tags.find((t) => t.id === tagId)
                return tagData
                  ? {
                      id: tagData.id,
                      abbreviation: tagData.abbreviation,
                      name: tagData.name,
                      color: tagData.color,
                    }
                  : null
              })
              .filter((t): t is NonNullable<typeof t> => t !== null)

            return {
              ...s,
              tags: newTags,
            }
          }
          return s
        })
      )

      toast.success(t.sources.sourceUpdated)
    } catch (error) {
      toast.error(t.errors.generic)
      console.error(error)
    }
  }

  return {
    // Data
    sources,
    tags,
    projectName,
    loading,
    filteredAndSortedSources,
    paginatedSources,
    totalPages,
    uniqueYears,
    uniqueAuthors,
    visibleColumns: columnOrder.filter((col) => columnVisibility[col]),

    // State
    addDialogOpen,
    setAddDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    sourceToDelete,
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
    tagFilter,
    setTagFilter,
    yearFromFilter,
    setYearFromFilter,
    yearToFilter,
    setYearToFilter,
    authorFilter,
    setAuthorFilter,
    sortColumn,
    sortDirection,
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
    createTagDialogOpen,
    setCreateTagDialogOpen,
    newTag,
    setNewTag,
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

    // Handlers
    handleCellDoubleClick,
    handleCellCancel,
    handleCellSave,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteAllClick,
    handleDeleteAllConfirm,
    handleCopyBibtex,
    handleAddSource,
    handleCreateTag,
    handleSort,
    handleFileSelect,
    handleExcludeExisting,
    handleImport,
    handleExportCSV,
    handleExportJSON,
    handleUpdateSourceTags,
    bibtexExportDialogOpen,
    setBibtexExportDialogOpen,
    selectedBibtexExportSourceIds,
    setSelectedBibtexExportSourceIds,
    bibtexExportTagFilter,
    setBibtexExportTagFilter,
    bibtexExportColumnVisibility,
    setBibtexExportColumnVisibility,
    handleOpenBibtexExport,
    handleCopyBibtexToClipboard,
    handleDownloadBibtexFile,
    loadData,
    setSources,
    setTags,
    formatPublicationDate,
    manageTagsDialogOpen,
    setManageTagsDialogOpen,
    editingTag,
    setEditingTag,
    editingTagData,
    setEditingTagData,
    handleUpdateTag,
    handleDeleteTag,
    mergingTags,
    selectedTagsToMerge,
    setSelectedTagsToMerge,
    mergeTagData,
    setMergeTagData,
    handleMergeTags,
  }
}

