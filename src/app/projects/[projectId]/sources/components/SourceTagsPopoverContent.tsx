"use client"

import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { Source } from "@/types/sources"

type TagOption = { id: string; name: string; color: string }

type SourceTagsPopoverContentProps = {
  source: Source
  tags: TagOption[]
  label: string
  createTagLabel: string
  onUpdateTags: (sourceId: string, tagIds: string[]) => void
  onCreateTag: (sourceId: string) => void
}

/** Tag checklist used inside a Popover to assign tags to a single source (table and card view). */
export function SourceTagsPopoverContent({
  source,
  tags,
  label,
  createTagLabel,
  onUpdateTags,
  onCreateTag,
}: SourceTagsPopoverContentProps) {
  return (
    <div className="space-y-4">
      <Label>{label}</Label>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center space-x-2">
            <Checkbox
              checked={source.tags.some((t) => t.id === tag.id)}
              onCheckedChange={(checked) => {
                const currentTagIds = source.tags.map((t) => t.id)
                const newTagIds = checked
                  ? [...currentTagIds, tag.id]
                  : currentTagIds.filter((id) => id !== tag.id)
                onUpdateTags(source.id, newTagIds)
              }}
            />
            <Label className="flex items-center gap-2 cursor-pointer">
              <Badge
                style={{ backgroundColor: tag.color, color: "white", borderColor: tag.color }}
                variant="outline"
              >
                {tag.name}
              </Badge>
            </Label>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={() => onCreateTag(source.id)}>
        <Plus className="mr-2 h-4 w-4" />
        {createTagLabel}
      </Button>
    </div>
  )
}
