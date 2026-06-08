# CLAUDE.md

## Project

**Naologic Work Order Schedule** — Angular 19 take-home challenge. Interactive Gantt-style timeline for managing work orders across manufacturing work centers.

## Tech Stack

- **Angular 19** — standalone components, signals, `@if`/`@for` control flow
- **SCSS** — CSS custom properties from `src/styles.scss`
- **Bootstrap 5** — utility classes only
- **ng-select** — dropdowns
- **@ng-bootstrap** — date pickers
- No Angular Material

## Commit Convention

```
Feature name: Short description
```

## Design System

Tokens live in `src/styles.scss` as CSS custom properties.

- Brand: `--color-brand-500: #4f46e5`
- Status badges: `.nao-badge--complete` / `--in-progress` / `--blocked` / `--open`
- Font: Circular Std (files go in `src/assets/fonts/`)

## Design Reference

https://www.sketch.com/s/d56a77de-9753-45a8-af7a-d93a42276667

Components: Avatar, Button, Buttons, Controls, Cursor, Dropdown, Table.

## Dev

```bash
npm install --legacy-peer-deps
ng serve
```
