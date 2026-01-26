"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Source, ColumnKey } from "@/types/sources"
import { COLUMN_ORDER } from "@/types/sources"
import { useTranslations } from "@/lib/i18n"
import { useSession } from "@/lib/auth-client"

export type PDFExportConfig = {
  // Which values to include
  includedColumns: Set<ColumnKey>
  includeAPACitation: boolean
  includeCitationCount: boolean
  
  // Sorting
  sortBy: "title-asc" | "title-desc" | "date" | "abbreviation" | "apa"
  sortDirection: "asc" | "desc"
  
  // Display format
  format: "tabular" | "list"
  
  // Page options
  noPageOverlap: boolean
  newSourceForEachPage: boolean
  
  // Font options
  font: string
  fontSize: number
  
  // Header options
  includeProjectTitle: boolean
  includeProjectDescription: boolean
  includeAuthor: boolean
  authorName: string
  includeDownloadDate: boolean
  includeSourceManagerNote: boolean
}

const DEFAULT_CONFIG: PDFExportConfig = {
  includedColumns: new Set(["abbreviation", "title", "authors", "publicationDate", "tags", "description", "notes", "links"]),
  includeAPACitation: false,
  includeCitationCount: false,
  sortBy: "title-asc",
  sortDirection: "asc",
  format: "list",
  noPageOverlap: true,
  newSourceForEachPage: false,
  font: "Times New Roman",
  fontSize: 12,
  includeProjectTitle: true,
  includeProjectDescription: false,
  includeAuthor: false,
  authorName: "",
  includeDownloadDate: false,
  includeSourceManagerNote: false,
}

interface PDFExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: Source[]
  projectTitle: string
  projectDescription: string | null
  citationData: { sourceUsage: Record<string, number> } | null
  columnVisibility: Record<ColumnKey, boolean>
  onExport: (config: PDFExportConfig) => void
}

const AVAILABLE_FONTS = [
  "Times New Roman",
  "Helvetica",
  "Courier",
  "Arial",
  "Calibri",
  "Georgia",
  "Verdana",
]

export function PDFExportDialog({
  open,
  onOpenChange,
  sources,
  projectTitle,
  projectDescription,
  citationData,
  columnVisibility,
  onExport,
}: PDFExportDialogProps) {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const [config, setConfig] = useState<PDFExportConfig>(() => {
    // Initialize with currently visible columns
    const visibleColumns = COLUMN_ORDER.filter(col => columnVisibility[col])
    return {
      ...DEFAULT_CONFIG,
      includedColumns: new Set(visibleColumns),
      authorName: session?.user?.name || "",
    }
  })

  // Update author name when session loads
  useEffect(() => {
    if (session?.user?.name && !config.authorName) {
      setConfig(prev => ({ ...prev, authorName: session.user.name || "" }))
    }
  }, [session?.user?.name])

  const handleColumnToggle = (column: ColumnKey, checked: boolean) => {
    const newSet = new Set(config.includedColumns)
    if (checked) {
      newSet.add(column)
    } else {
      newSet.delete(column)
    }
    setConfig({ ...config, includedColumns: newSet })
  }

  const handleExport = () => {
    onExport(config)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.sources.pdfExport.title}</DialogTitle>
          <DialogDescription>
            {t.sources.pdfExport.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Which values to include */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t.sources.pdfExport.includeValues}</Label>
            <div className="space-y-2 pl-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.sources.pdfExport.columns}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {COLUMN_ORDER.map((col) => (
                    <div key={col} className="flex items-center space-x-2">
                      <Checkbox
                        id={`col-${col}`}
                        checked={config.includedColumns.has(col)}
                        onCheckedChange={(checked) =>
                          handleColumnToggle(col, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`col-${col}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {t.sources.columns[col]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="apa-citation"
                  checked={config.includeAPACitation}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, includeAPACitation: checked as boolean })
                  }
                />
                <Label htmlFor="apa-citation" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.apaCitation}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="citation-count"
                  checked={config.includeCitationCount}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, includeCitationCount: checked as boolean })
                  }
                />
                <Label htmlFor="citation-count" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.citationCount}
                </Label>
              </div>
            </div>
          </div>

          {/* Sorting */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t.sources.pdfExport.sorting}</Label>
            <Select
              value={config.sortBy}
              onValueChange={(value: PDFExportConfig["sortBy"]) =>
                setConfig({ ...config, sortBy: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title-asc">{t.sources.pdfExport.sortByTitleAsc}</SelectItem>
                <SelectItem value="title-desc">{t.sources.pdfExport.sortByTitleDesc}</SelectItem>
                <SelectItem value="date">{t.sources.pdfExport.sortByDate}</SelectItem>
                <SelectItem value="abbreviation">{t.sources.pdfExport.sortByAbbreviation}</SelectItem>
                <SelectItem value="apa">{t.sources.pdfExport.sortByAPA}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Display format */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t.sources.pdfExport.displayFormat}</Label>
            <RadioGroup
              value={config.format}
              onValueChange={(value: "tabular" | "list") =>
                setConfig({ ...config, format: value })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tabular" id="format-tabular" />
                <Label htmlFor="format-tabular" className="cursor-pointer">
                  {t.sources.pdfExport.formatTabular}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="list" id="format-list" />
                <Label htmlFor="format-list" className="cursor-pointer">
                  {t.sources.pdfExport.formatList}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Page options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t.sources.pdfExport.pageOptions}</Label>
            <div className="space-y-2 pl-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="no-page-overlap"
                  checked={config.noPageOverlap}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, noPageOverlap: checked as boolean })
                  }
                />
                <Label htmlFor="no-page-overlap" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.noPageOverlap}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="new-source-each-page"
                  checked={config.newSourceForEachPage}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, newSourceForEachPage: checked as boolean })
                  }
                />
                <Label htmlFor="new-source-each-page" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.newPagePerSource}
                </Label>
              </div>
            </div>
          </div>

          {/* Font options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t.sources.pdfExport.fontOptions}</Label>
            <div className="grid grid-cols-2 gap-4 pl-4">
              <div className="space-y-2">
                <Label className="text-sm">{t.sources.pdfExport.font}</Label>
                <Select
                  value={config.font}
                  onValueChange={(value) => setConfig({ ...config, font: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FONTS.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t.sources.pdfExport.fontSize}</Label>
                <Input
                  type="number"
                  value={config.fontSize}
                  onChange={(e) =>
                    setConfig({ ...config, fontSize: parseInt(e.target.value) || 12 })
                  }
                />
              </div>
            </div>
          </div>

          {/* Header options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t.sources.pdfExport.headerOptions}</Label>
            <div className="space-y-2 pl-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-project-title"
                  checked={config.includeProjectTitle}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, includeProjectTitle: checked as boolean })
                  }
                />
                <Label htmlFor="include-project-title" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.includeProjectTitle}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-project-description"
                  checked={config.includeProjectDescription}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, includeProjectDescription: checked as boolean })
                  }
                />
                <Label htmlFor="include-project-description" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.includeProjectDescription}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-author"
                  checked={config.includeAuthor}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, includeAuthor: checked as boolean })
                  }
                />
                <Label htmlFor="include-author" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.includeAuthor}
                </Label>
              </div>
              {config.includeAuthor && (
                <div className="pl-6">
                  <Input
                    placeholder={t.sources.pdfExport.authorNamePlaceholder}
                    value={config.authorName}
                    onChange={(e) =>
                      setConfig({ ...config, authorName: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-download-date"
                  checked={config.includeDownloadDate}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, includeDownloadDate: checked as boolean })
                  }
                />
                <Label htmlFor="include-download-date" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.includeDownloadDate}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-source-manager-note"
                  checked={config.includeSourceManagerNote}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, includeSourceManagerNote: checked as boolean })
                  }
                />
                <Label htmlFor="include-source-manager-note" className="text-sm font-normal cursor-pointer">
                  {t.sources.pdfExport.includeSourceManagerNote}
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.sources.pdfExport.cancel}
          </Button>
          <Button onClick={handleExport}>
            {t.sources.pdfExport.export}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

