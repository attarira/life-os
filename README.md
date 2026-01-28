# LifeOS

A local-first life management app with life areas, nested tasks, kanban workflow, and a calendar for scheduled work vs due dates.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Life Areas Dashboard**: High-level cards (Career, Health, Finances, etc.) with status rings, highlights, and quick navigation.
- **Nested Tasks**: Unlimited hierarchy depth. Click a task to drill down into its subtasks.
- **Kanban Workflow**: Status columns with drag-and-drop ordering and movement.
- **Scheduled vs Due Dates**:
  - `scheduledDate` = when you plan to work on it (calendar)
  - `dueDate` = deadline (shown on task cards)
  - If no due date, tasks show **Ongoing**
- **Calendar View**: Month/week/day calendar with scheduled and due tags, click events to open tasks (`/calendar`).
- **Task Details Modal**: Centered popup to edit status, description, scheduled date, due date, and actions.
- **Auto-hide Completed**: Tasks completed more than 7 days ago are hidden (not deleted).
- **Completed Archive**: View all archived completed tasks in a searchable modal.
- **Global Search**: Press `/` to search all tasks by title/description.
- **Import/Export**: Backup and restore your data as JSON.

## Data Model

```typescript
interface Task {
  id: string;           // UUID
  parentId: string;     // Parent task ID ("root" for top-level)
  title: string;        // Required
  description?: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  order: number;        // For sorting within column
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;   // Set when status becomes COMPLETED
  dueDate?: Date;       // Deadline
  scheduledDate?: Date; // Planned work date (calendar)
  tags?: string[];
}
```

- **Root Task**: The immutable root (id="root") is never stored. All tasks have `parentId` pointing to either "root" or another task.
- **No Cycles**: parentId validation prevents circular references.

## Project Structure

```
src/
├── app/
│   ├── page.tsx            # Main app entry
│   ├── calendar/page.tsx   # Calendar view (FullCalendar)
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Tailwind + custom styles
├── lib/
│   ├── types.ts          # Task types and constants
│   ├── task-context.tsx  # React context for state
│   ├── store/
│   │   ├── index.ts           # Store export
│   │   └── indexeddb-store.ts # IndexedDB implementation
│   └── tasks/
│       ├── index.ts       # Task utils export
│       ├── tree-utils.ts  # Path, cycle prevention, subtree helpers
│       └── seed-data.ts   # Initial seed data
└── components/
    ├── Board.tsx            # App router (dashboard vs kanban)
    ├── HomeDashboard.tsx    # Life areas dashboard
    ├── KanbanBoard.tsx      # Kanban view for a life area
    ├── Column.tsx           # Status column
    ├── TaskCard.tsx         # Draggable task card
    ├── TaskPanel.tsx        # Task detail modal
    ├── SearchModal.tsx      # Global search
    ├── CompletedArchive.tsx # Archived tasks modal
    └── ImportExport.tsx     # Backup/restore buttons
```

## 7-Day Completed Auto-Hide Logic

**Location**: `src/lib/task-context.tsx` → `getVisibleChildren()` method

```typescript
const getVisibleChildren = useCallback((): Task[] => {
  return tasks
    .filter(t => t.parentId === currentParentId)
    .filter(t => {
      // Hide completed tasks older than 7 days
      if (t.status === 'COMPLETED' && isCompletedOlderThan(t, COMPLETED_HIDE_DAYS)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);
}, [tasks, currentParentId]);
```

The `isCompletedOlderThan()` helper is in `src/lib/tasks/tree-utils.ts`:

```typescript
export function isCompletedOlderThan(task: Task, days: number): boolean {
  if (!task.completedAt) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(task.completedAt) < cutoff;
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `n` | Focus quick-add input |
| `/` | Open search modal |
| `Esc` | Close panel/modal |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Persistence**: IndexedDB via `idb`
- **Drag & Drop**: @dnd-kit
- **Calendar**: FullCalendar (day/week/month views)
