"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { FileDown, Loader2, Moon, Sun } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useActiveTheme } from "@/components/active-theme-provider"
import { PdfExportPreview } from "@/components/pdf-export-preview"
import { useSession } from "@/lib/auth-client"
import { useTranslations } from "@/lib/i18n"
import { appThemes, type AppThemeId } from "@/lib/theme-config"
import { createDefaultPdfConfig, PDF_SORT_KEYS, type PdfExportConfig, type PdfSortKey } from "@/lib/pdf-export/config"
import { getPdfPalette } from "@/lib/pdf-export/palette"
import { sortSourcesForPdf } from "@/lib/pdf-export/sort"
import type { ColumnKey, Source } from "@/types/sources"
import { COLUMN_ORDER } from "@/types/sources"

interface PDFExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allSources: Source[]
  /** Sources matching the table's current search and filters. */
  filteredSources: Source[]
  projectTitle: string
  projectDescription: string | null
  onExport: (config: PdfExportConfig, sources: Source[]) => Promise<void>
}

const PREVIEW_WIDTH = 252

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))

export function PDFExportDialog(props: PDFExportDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[880px]">
        {/* Mounted per opening, so every export starts from the defaults (current mode and theme). */}
        <PdfExportForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3.5">
      <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{title}</h3>
      {children}
    </section>
  )
}

function OptionRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
  children,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-6">
        <Label htmlFor={id} className="flex flex-col items-start gap-1 leading-snug">
          <span>{label}</span>
          {hint ? <span className="text-muted-foreground text-xs font-normal">{hint}</span> : null}
        </Label>
        <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} className="mt-0.5" />
      </div>
      {children}
    </div>
  )
}

function ThemeSwatch({ themeId, mode }: { themeId: AppThemeId; mode: PdfExportConfig["mode"] }) {
  const palette = getPdfPalette(themeId, mode)
  return (
    <span
      className="ring-border inline-flex size-4 shrink-0 items-center justify-center rounded-full ring-1"
      style={{ backgroundColor: palette.paper }}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: palette.accent }} />
    </span>
  )
}

function PdfExportForm({
  onOpenChange,
  allSources,
  filteredSources,
  projectTitle,
  projectDescription,
  onExport,
}: PDFExportDialogProps) {
  const { t, locale } = useTranslations()
  const tp = t.sources.pdfExport
  const { resolvedTheme } = useTheme()
  const { activeTheme } = useActiveTheme()
  const { data: session } = useSession()

  const [config, setConfig] = useState<PdfExportConfig>(() =>
    createDefaultPdfConfig({ mode: resolvedTheme === "dark" ? "dark" : "light", themeId: activeTheme, authorName: "" }),
  )
  // null until edited: follows the signed-in user's name, which may arrive after opening.
  const [authorName, setAuthorName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = <K extends keyof PdfExportConfig>(key: K, value: PdfExportConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }))

  const effectiveConfig: PdfExportConfig = { ...config, authorName: authorName ?? session?.user?.name ?? "" }
  const selected = config.keepFilters ? filteredSources : allSources
  const ordered = useMemo(() => sortSourcesForPdf(selected, config.sortBy, locale), [selected, config.sortBy, locale])
  const hasDescription = Boolean(projectDescription?.trim())
  const hasContent = config.fields.some((field) => field !== "abbreviation") || config.includeApaCitation
  const canExport = selected.length > 0 && hasContent && !busy

  const toggleField = (column: ColumnKey, checked: boolean) =>
    update(
      "fields",
      COLUMN_ORDER.filter((candidate) => (candidate === column ? checked : config.fields.includes(candidate))),
    )

  const handleExport = async () => {
    setBusy(true)
    try {
      await onExport(effectiveConfig, selected)
    } finally {
      setBusy(false)
    }
  }

  const countLabel =
    selected.length === 0
      ? tp.noSources
      : selected.length === 1
        ? tp.sourceCountOne
        : fill(tp.sourceCount, { count: new Intl.NumberFormat(locale).format(selected.length) })

  return (
    <>
      <div className="grid min-h-0 md:grid-cols-[minmax(0,1fr)_316px]">
        <div className="flex min-h-0 flex-col">
          <DialogHeader className="px-6 pt-6 pb-5">
            <DialogTitle>{tp.title}</DialogTitle>
            <DialogDescription>{tp.description}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(64vh,620px)] space-y-8 overflow-y-auto px-6 pb-7">
            <Section title={tp.content}>
              <div className="space-y-2.5">
                <p className="text-sm font-medium">{tp.columns}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {COLUMN_ORDER.map((column) => (
                    <Label key={column} htmlFor={`pdf-field-${column}`} className="cursor-pointer font-normal">
                      <Checkbox
                        id={`pdf-field-${column}`}
                        checked={config.fields.includes(column)}
                        onCheckedChange={(checked) => toggleField(column, checked === true)}
                      />
                      {t.sources.columns[column]}
                    </Label>
                  ))}
                </div>
                {!hasContent ? <p className="text-destructive text-xs">{tp.noColumns}</p> : null}
              </div>
              <OptionRow
                id="pdf-apa"
                label={tp.apaCitation}
                hint={tp.apaCitationHint}
                checked={config.includeApaCitation}
                onCheckedChange={(checked) => update("includeApaCitation", checked)}
              />
            </Section>

            <Section title={tp.selection}>
              <div className="flex items-center justify-between gap-6">
                <Label htmlFor="pdf-sort">{tp.sortBy}</Label>
                <Select value={config.sortBy} onValueChange={(value) => update("sortBy", value as PdfSortKey)}>
                  <SelectTrigger id="pdf-sort" className="w-[210px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PDF_SORT_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {tp.sort[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <OptionRow
                id="pdf-keep-filters"
                label={tp.keepFilters}
                hint={fill(tp.keepFiltersHint, { count: filteredSources.length, total: allSources.length })}
                checked={config.keepFilters}
                onCheckedChange={(checked) => update("keepFilters", checked)}
              />
            </Section>

            <Section title={tp.appearance}>
              <div className="flex items-center justify-between gap-6">
                <Label id="pdf-mode-label">{tp.mode}</Label>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  aria-labelledby="pdf-mode-label"
                  value={config.mode}
                  onValueChange={(value) => {
                    if (value === "light" || value === "dark") update("mode", value)
                  }}
                >
                  <ToggleGroupItem value="light" className="gap-1.5 px-3">
                    <Sun className="size-3.5" />
                    {tp.light}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="dark" className="gap-1.5 px-3">
                    <Moon className="size-3.5" />
                    {tp.dark}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="flex items-center justify-between gap-6">
                <Label htmlFor="pdf-theme">{tp.theme}</Label>
                <Select value={config.themeId} onValueChange={(value) => update("themeId", value as AppThemeId)}>
                  <SelectTrigger id="pdf-theme" className="w-[210px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {appThemes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        <ThemeSwatch themeId={theme.id} mode={config.mode} />
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Section>

            <Section title={tp.header}>
              <OptionRow
                id="pdf-project-title"
                label={tp.projectTitle}
                checked={config.includeProjectTitle}
                onCheckedChange={(checked) => update("includeProjectTitle", checked)}
              />
              <OptionRow
                id="pdf-project-description"
                label={tp.projectDescription}
                hint={hasDescription ? undefined : tp.noProjectDescription}
                checked={config.includeProjectDescription && hasDescription}
                disabled={!hasDescription}
                onCheckedChange={(checked) => update("includeProjectDescription", checked)}
              />
              <OptionRow
                id="pdf-author"
                label={tp.author}
                checked={config.includeAuthor}
                onCheckedChange={(checked) => update("includeAuthor", checked)}
              >
                {config.includeAuthor ? (
                  <Input
                    aria-label={tp.author}
                    placeholder={tp.authorPlaceholder}
                    value={effectiveConfig.authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                  />
                ) : null}
              </OptionRow>
              <OptionRow
                id="pdf-date"
                label={tp.downloadDate}
                checked={config.includeDownloadDate}
                onCheckedChange={(checked) => update("includeDownloadDate", checked)}
              />
              <OptionRow
                id="pdf-credit"
                label={tp.sourceManagerNote}
                hint={tp.sourceManagerNoteHint}
                checked={config.includeSourceManagerNote}
                onCheckedChange={(checked) => update("includeSourceManagerNote", checked)}
              />
            </Section>
          </div>
        </div>

        <aside className="bg-muted/40 hidden flex-col items-center gap-4 border-l px-8 pt-14 pb-6 md:flex">
          <PdfExportPreview
            sources={ordered}
            config={{ ...effectiveConfig, includeProjectDescription: config.includeProjectDescription && hasDescription }}
            projectTitle={projectTitle}
            projectDescription={projectDescription}
            strings={tp.document}
            locale={locale}
            width={PREVIEW_WIDTH}
          />
          <span className="text-muted-foreground text-xs">{tp.preview}</span>
        </aside>
      </div>

      <DialogFooter className="items-center border-t px-6 py-4 sm:justify-between">
        <span className="text-muted-foreground hidden text-sm sm:inline">{countLabel}</span>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tp.cancel}
          </Button>
          <Button onClick={handleExport} disabled={!canExport}>
            {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
            {busy ? tp.generating : tp.download}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
