declare module "turndown-plugin-gfm" {
  /** Minimal shape used by GFM plugins; matches Turndown’s `use` API. */
  interface TurndownLike {
    use(plugins: Array<(service: TurndownLike) => void>): void
  }

  export function gfm(turndownService: TurndownLike): void
  export function highlightedCodeBlock(turndownService: TurndownLike): void
  export function strikethrough(turndownService: TurndownLike): void
  export function tables(turndownService: TurndownLike): void
  export function taskListItems(turndownService: TurndownLike): void
}
