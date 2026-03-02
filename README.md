# LifeOS

## Overview

LifeOS is a local-first life management application. It solves the problem of fragmented personal tracking by consolidating tasks, calendar events, financial snapshots, and personal notes into a single interface. 

The architecture guarantees privacy by keeping all data local. It relies on IndexedDB and localStorage, eliminating the need for external database subscriptions or network requests for core functionality. State management is handled through a unified React Context provider, which maintains a flat array of task objects to represent nested hierarchies.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open the application:
Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### Core Architecture
The application uses a unified Task interface for all entities. Life areas, Kanban columns, and granular subtasks are all treated as tasks with a designated `parentId`. The root tasks form the dashboard cards. Subtasks belong to these root nodes. 

State is maintained in memory via `TaskProvider` and asynchronously persisted to IndexedDB. This design provides immediate UI updates during drag-and-drop operations while ensuring data durability. 

### Key Systems

**Nested Hierarchy:** Tasks support infinite nesting. The application relies on path traversal utilities (`getTaskPath` and `getSubtreeIds`) to render breadcrumbs and calculate recursive deletions without circular references.

**Dual Date Tracking:** 
The application separates deadlines from execution planning. 
* `dueDate`: Defines the hard deadline.
* `scheduledDate`: Maps the task to a specific day on the integrated FullCalendar view.

**Completed Archive:** 
Tasks marked as completed are hidden from the primary view after 7 days. This is calculated dynamically using a `completedAt` timestamp. It prevents clutter while keeping historical data accessible via the search and archive modals.

**Financial Snapshots:**
The Kanban board includes specific logic for a "finances" area. It serializes a separate ledger of assets, liabilities, and recurring subscriptions directly to localStorage. This data is rendered as a time-series history without polluting the core task tree.

## Technical Stack

* Framework: Next.js 14 (App Router)
* Language: TypeScript
* Styling: Tailwind CSS
* Persistence: IndexedDB (via `idb` wrapper) and standard `localStorage`
* Drag and Drop: `@dnd-kit/core`
* Calendar: FullCalendar React Wrapper
