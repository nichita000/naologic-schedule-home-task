# Naologic Schedule — Work Order Timeline

Angular 17 take-home task: interactive Gantt-style timeline for managing work orders across manufacturing work centers.

## Getting Started

```bash
npm install
ng serve
```

Open [http://localhost:4200](http://localhost:4200).

## Stack

- **Angular 17** (standalone components, signals)
- **ng-select** — status/work-center dropdowns
- **@ng-bootstrap** — date pickers
- **Bootstrap 5** — CSS utilities
- **SCSS** — custom component styling

## Features

- Timeline grid with Day / Week / Month zoom
- Work order bars positioned by start/end date
- Status badges (Open, In Progress, Complete, Blocked)
- Click empty row → create work order (date pre-filled)
- ⋮ menu on each bar → Edit / Delete
- Overlap validation (same work center, same time)
- "Today" indicator line
- Slide-out panel with Reactive Form validation

## Architecture

```
src/app/
  models/           — WorkCenter, WorkOrder interfaces + status config
  services/
    schedule.service.ts   — data store (signals), CRUD, overlap detection
    timeline.service.ts   — date→px math, zoom, column generation
  components/
    schedule/             — root layout, panel state
    timeline-header/      — zoom controls, date column headers
    timeline-grid/        — scrollable grid, today line, row layout
    work-order-bar/       — positioned bar, ⋮ menu
    work-order-panel/     — slideout create/edit form
```

## Pixel-Perfect Notes

Design tokens are defined as CSS custom properties in `src/styles.scss` (`:root`). Update colors, widths, and heights from the Sketch file once accessed.

Circular Std font files should be placed in `src/assets/fonts/` and the `@font-face` declarations in `styles.scss` uncommented.
