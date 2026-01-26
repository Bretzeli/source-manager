"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { getProject } from "@/app/actions/projects"
import { getCitationsFromGithub } from "@/app/actions/citations"
import { getSources, getTags } from "@/app/actions/sources"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, FileText } from "lucide-react"
import type { Source, Tag } from "@/types/sources"

type CitationData = {
  citations: string[]
  totalCitations: number
  totalUniqueCitations: number
  uniqueSources: number
  sourceUsage: Record<string, number>
  topicUsage: Record<string, number>
  sources: Source[]
  averageCitationsPerSentence: number
  averageUniqueCitationsPerSentence: number
  totalSentences: number
  documentStructure: Array<{
    level: number
    type: string
    title: string
    lineNumber: number
    citations: string[]
    uniqueCitationCommands: number
    filePath: string
  }>
}

export default function CitationsPage() {
  const params = useParams()
  const projectId = params.projectId as string
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [citationData, setCitationData] = useState<CitationData | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [projectName, setProjectName] = useState("")
  const [selectedTopic, setSelectedTopic] = useState<string>("all")

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        
        const [project, citations, sourcesData, tagsData] = await Promise.all([
          getProject(projectId),
          getCitationsFromGithub(projectId),
          getSources(projectId),
          getTags(projectId),
        ])
        
        if (project) {
          setProjectName(project.title)
        }
        
        setCitationData(citations)
        setSources(sourcesData as Source[])
        setTags(tagsData as Tag[])
      } catch (err) {
        console.error("Failed to load citations:", err)
        setError(err instanceof Error ? err.message : "Failed to load citations")
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [projectId])

  // Prepare topic usage data for chart with colors
  const topicChartData = useMemo(() => {
    if (!citationData) return []
    
    return Object.entries(citationData.topicUsage)
      .map(([topic, count]) => {
        const tag = tags.find((t) => t.name === topic)
        return {
          topic,
          count,
          color: tag?.color || "#3b82f6",
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [citationData, tags])

  // Prepare source usage data for chart (filtered by topic if selected)
  const sourceChartData = useMemo(() => {
    if (!citationData) return []
    
    let sourceIdsToShow = Object.keys(citationData.sourceUsage)
    
    // Filter by topic if selected
    if (selectedTopic !== "all") {
      const tag = tags.find((t) => t.name === selectedTopic)
      if (tag) {
        sourceIdsToShow = sources
          .filter((source) => 
            source.tags.some((t) => t.id === tag.id) &&
            citationData.sourceUsage[source.id]
          )
          .map((s) => s.id)
      }
    }
    
    // Color palette for sources (gradient from blue to purple)
    const colorPalette = [
      "#3b82f6", // blue-500
      "#6366f1", // indigo-500
      "#8b5cf6", // violet-500
      "#a855f7", // purple-500
      "#d946ef", // fuchsia-500
      "#ec4899", // pink-500
      "#f43f5e", // rose-500
      "#ef4444", // red-500
      "#f59e0b", // amber-500
      "#10b981", // emerald-500
      "#14b8a6", // teal-500
      "#06b6d4", // cyan-500
    ]
    
    return sourceIdsToShow
      .map((sourceId, index) => {
        const source = sources.find((s) => s.id === sourceId)
        if (!source) return null
        
        // Use primary tag color if available, otherwise use gradient
        const primaryTag = source.tags[0]
        const color = primaryTag?.color || colorPalette[index % colorPalette.length]
        
        return {
          source: source.abbreviation || source.title.substring(0, 30),
          count: citationData.sourceUsage[sourceId],
          fullTitle: source.title,
          color,
        }
      })
      .filter((item): item is { source: string; count: number; fullTitle: string; color: string } => item !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20) // Limit to top 20 for readability
  }, [citationData, sources, selectedTopic, tags])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Citations</h1>
          <p className="text-muted-foreground mt-1">
            Citation analysis for {projectName}
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!citationData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Citations</h1>
          <p className="text-muted-foreground mt-1">
            Citation analysis for {projectName}
          </p>
        </div>
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            No GitHub repository configured or no files selected. Please configure your GitHub repository in project settings.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const topicChartConfig = {
    count: {
      label: "Citations",
      color: "hsl(var(--chart-1))",
    },
  }

  const sourceChartConfig = {
    count: {
      label: "Citations",
      color: "hsl(var(--chart-2))",
    },
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Citations</h1>
        <p className="text-muted-foreground mt-1">
          Citation analysis for {projectName}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Citations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{citationData.totalCitations}</div>
            <p className="text-xs text-muted-foreground">
              Individual source citations
            </p>
            <div className="mt-2 pt-2 border-t">
              <div className="text-lg font-semibold">{citationData.totalUniqueCitations}</div>
              <p className="text-xs text-muted-foreground">
                Unique citation commands
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{citationData.uniqueSources}</div>
            <p className="text-xs text-muted-foreground">
              Different sources cited
            </p>
            <div className="mt-2 pt-2 border-t">
              <div className="text-lg font-semibold">
                {sources.length > 0
                  ? Math.round((citationData.uniqueSources / sources.length) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                Coverage of {sources.length} total sources
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Citations/Sentence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {citationData.totalSentences > 0
                ? citationData.averageCitationsPerSentence.toFixed(2)
                : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              Individual citations per sentence
            </p>
            <div className="mt-2 pt-2 border-t">
              <div className="text-lg font-semibold">
                {citationData.totalSentences > 0
                  ? citationData.averageUniqueCitationsPerSentence.toFixed(2)
                  : "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                Unique citation commands per sentence
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Topic Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Citation Frequency by Topic</CardTitle>
            <CardDescription>
              Individual source citations per topic (tag)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topicChartData.length > 0 ? (
              <ChartContainer config={topicChartConfig} className="h-[400px]">
                <BarChart data={topicChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="topic"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {topicChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No topic data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Citation Frequency by Source</CardTitle>
            <CardDescription>
              Individual source citations per source
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="topic-filter" className="text-sm">Filter by Topic</Label>
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger id="topic-filter" className="mt-1">
                  <SelectValue placeholder="All topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.name}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sourceChartData.length > 0 ? (
              <ChartContainer config={sourceChartConfig} className="h-[400px]">
                <BarChart data={sourceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="source"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value, name, props) => [
                      `${value} citations`,
                      props.payload.fullTitle || props.payload.source,
                    ]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {sourceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                {selectedTopic !== "all"
                  ? "No sources found for selected topic"
                  : "No source data available"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Document Structure */}
      {citationData.documentStructure.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Document Structure</CardTitle>
            <CardDescription>
              Citations per chapter, section, subsection, etc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {citationData.documentStructure.map((section, index) => {
                const indent = section.level * 20
                const typeLabel = section.type.charAt(0).toUpperCase() + section.type.slice(1)
                const citationCount = section.citations.length
                const uniqueCitationCount = section.uniqueCitationCommands
                
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                    style={{ paddingLeft: `${16 + indent}px` }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground font-mono">
                        {typeLabel}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {section.title}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        ({section.filePath})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold">
                          {citationCount}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          citations
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold">
                          {uniqueCitationCount}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          unique
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
