import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { ColumnKey } from "@/types/sources"

type ColumnSettingsContentProps = {
  columnOrder: ColumnKey[]
  columnVisibility: Record<ColumnKey, boolean>
  draggedColumnIndex: number | null
  dragOverColumnIndex: number | null
  setDraggedColumnIndex: (index: number | null) => void
  setDragOverColumnIndex: (index: number | null) => void
  setColumnOrder: (order: ColumnKey[]) => void
  setColumnVisibility: (visibility: Record<ColumnKey, boolean>) => void
  getColumnLabel: (key: ColumnKey) => string
  showAutoResizeToggle?: boolean
  autoResizeValue?: boolean
  onAutoResizeChange?: (checked: boolean) => void
  autoResizeLabel?: string
  idPrefix?: string
  showHideLabel: string
  reorderLabel: string
}

export function ColumnSettingsContent({
  columnOrder,
  columnVisibility,
  draggedColumnIndex,
  dragOverColumnIndex,
  setDraggedColumnIndex,
  setDragOverColumnIndex,
  setColumnOrder,
  setColumnVisibility,
  getColumnLabel,
  showAutoResizeToggle = false,
  autoResizeValue = false,
  onAutoResizeChange,
  autoResizeLabel = "",
  idPrefix = "",
  showHideLabel,
  reorderLabel,
}: ColumnSettingsContentProps) {
  return (
    <div className="space-y-4">
      {/* Draggable column visibility and ordering controls */}
      <div>
        <Label className="text-sm font-medium">{showHideLabel}</Label>
        <p className="text-xs text-muted-foreground mb-2">{reorderLabel}</p>
        <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto">
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
                id={`${idPrefix}${col}`}
                checked={columnVisibility[col]}
                onCheckedChange={(checked) => {
                  setColumnVisibility({ ...columnVisibility, [col]: checked as boolean })
                }}
              />
              <Label htmlFor={`${idPrefix}${col}`} className="text-sm font-normal cursor-pointer flex-1">
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
      {/* Optional editor behavior toggle for table cell inputs */}
      {showAutoResizeToggle && onAutoResizeChange ? (
        <div className="flex items-center space-x-2 pt-2 border-t">
          <Checkbox
            id={`${idPrefix}autoResizeTextarea`}
            checked={autoResizeValue}
            onCheckedChange={(checked) => {
              onAutoResizeChange(checked as boolean)
            }}
          />
          <Label htmlFor={`${idPrefix}autoResizeTextarea`} className="text-sm font-normal cursor-pointer">
            {autoResizeLabel}
          </Label>
        </div>
      ) : null}
    </div>
  )
}
