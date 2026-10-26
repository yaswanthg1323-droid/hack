# AidKit Brand Style Guide

## Design Tokens
- Colors:
  - `--color-primary`: #0284c7 (teal/sky blue)
  - `--color-primary-hover`: #0369a1
  - `--color-primary-light`: #e0f2fe
  - `--color-danger`: #ef4444 (emergency red)
  - `--color-danger-light`: #fee2e2
  - `--color-warning`: #f59e0b (amber)
  - `--color-warning-light`: #fef3c7
  - `--color-success`: #10b981 (emerald)
  - `--color-success-light`: #d1fae5
  - `--color-bg`: #f8fafc (slate 50)
  - `--color-surface`: #ffffff (pure white)
  - `--color-surface-hover`: #f1f5f9
  - `--color-border`: #e2e8f0
  - `--color-text`: #0f172a
  - `--color-text-muted`: #64748b
  - `--color-text-inverse`: #ffffff
- Typography & Spacing:
  - Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Spacing tokens: `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-6` (24px)
  - Radii: `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (16px), `--radius-full` (9999px)

## Component Classes
- Structure: `.app-shell`, `.app-header`, `.header-title`, `.header-actions`, `.app-nav`, `.nav-item`, `.nav-item.active`, `.app-main`, `.container`
- Cards: `.card`, `.card-header`, `.card-title`, `.card-body`, `.card-footer`
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-outline`, `.btn-sm`, `.btn-lg`, `.btn-block`
- Form: `.form-group`, `.form-label`, `.form-control`, `.form-select`, `.form-textarea`, `.form-hint`
- Badges & Alerts: `.badge`, `.badge-primary`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.alert`, `.alert-danger`, `.alert-warning`, `.alert-success`, `.alert-info`
- Empty States: `.empty-state`, `.empty-state-icon`, `.empty-state-title`, `.empty-state-text`
- Modals: `.modal-backdrop`, `.modal-container`, `.modal-header`, `.modal-title`, `.modal-body`, `.modal-footer`

## Rules
- Never hardcode colors, spacing, or fonts; use theme tokens.
- Reusable UI elements must strictly adhere to theme.css classes.
