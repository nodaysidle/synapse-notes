# src/utils/

## Responsibility
Pure utility functions with no side effects or React dependencies.

## Modules
- **formatting.ts** — `formatDateShort(dateStr)` → locale date string; `formatDurationPadded(ms)` → `"MM:SS"` padded string used in recorder UI.
- **textAnalysis.ts** — `analyzeText(text)` → extracts keywords by stripping stop-words and counting frequency; `getSharedKeywords(noteA, noteB)` → returns intersection of keyword sets. Used by `GraphView` to determine which notes get connected edges.

## Integration
- Consumed by: `pages/GraphView`, `pages/Home`, `pages/NotesList`, `pages/Record`, `pages/Gallery`
- No external dependencies
