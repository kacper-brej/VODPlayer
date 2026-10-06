---
name: Nocturna admin
description: Incumbent design reference for administrative material and chapter workflows only.
colors:
  nx-bg: "#07070A"
  nx-panel: "#15121C"
  nx-raised: "#23202A"
  nx-border: "#332E3C"
  nx-text: "#F3F0EA"
  nx-text-2: "#A39EAB"
  nx-accent: "#B9A0FF"
  nx-on-accent: "#15121C"
  primary-hover: "#D1C2FF"
  nx-accent-2: "#D8FF72"
  nx-critical: "#FF6F61"
  nx-critical-soft: "#FFB0A7"
typography:
  headline:
    fontFamily: "var(--font-geist-sans)"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "var(--font-geist-sans)"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "var(--font-geist-sans)"
    fontSize: "14px"
    lineHeight: 1.6
  button:
    fontFamily: "var(--font-geist-sans)"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  timestamp:
    fontFamily: "var(--font-geist-mono)"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  thumbnail: "4px"
  control: "10px"
  workspace: "16px"
spacing:
  small: "8px"
  control-gap: "12px"
  group-gap: "16px"
  stack-gap: "20px"
  section: "24px"
  editor: "28px"
components:
  button-primary:
    backgroundColor: "{colors.nx-accent}"
    textColor: "{colors.nx-on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.nx-panel}"
    textColor: "{colors.nx-text}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.nx-bg}"
    textColor: "{colors.nx-text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: Nocturna admin

## Overview

This is a local record of the implemented admin boundary, not an app-wide brand specification. The interface prioritizes operating the library: choose a material, match its title, inspect artwork, and deliberately commit an artwork change. Chapter editing uses readable timestamps and plain Polish feedback.

Source authority: `admin.module.css`, `AdminSectionNav.tsx`, `AdminFeedback.tsx`, `ChapterEditor.tsx`, and the neighboring upload components `MetadataReviewPanel.tsx`, `ArtworkChooser.tsx`, and `UploadWorkflow.tsx`. Shared colors come from `app/globals.css`; `app/layout.tsx` loads Geist and Geist Mono locally. The frontmatter records current values; implementation remains the source for future refreshes.

## Colors

The existing dark nx palette uses purple for primary actions, selected outlines, active navigation, and keyboard focus. `primary-hover` lightens primary buttons. Lime `nx-accent-2` marks completed metadata; coral critical colors distinguish errors and destructive controls.

Neutral background, panel, and raised tokens separate work areas. `nx-text` carries primary content, `nx-text-2` supporting instructions, and `nx-border` boundaries. Preserve these roles within this admin surface.

## Typography

Geist is the operational UI face; Geist Mono makes timestamps easy to compare with tabular numerals. The shared display serif is not used by these admin components. Section subheadings use 16px, weight 600, and 1.4 line height; supporting labels generally use 12–13px. Page descriptions have a 68ch maximum width. On small screens, page headings reduce to 26px, ordinary inputs grow to 16px, and timestamps reduce to 20px.

## Layout

Navigation and pages share a centered 1200px maximum width and 24px desktop gutters. The material workspace places a searchable library on the left and editor on the right; its standard library width is 248px, changing to 280px from 1500px and 200px at 900px and below. At 640px and below, the library becomes a horizontal scrolling row above the editor and page gutters become 16px. Search results reduce from two columns to one at 900px; additional results remain reachable through “Pokaż kolejne wyniki”.

Chapter target selection and its form become one column at 900px. Artwork previews retain a 2:3 poster beside a 16:9 banner. At 640px, artwork choices use two columns for banners/logos and three for posters. Primary controls have a 44px minimum height; main navigation links use 48px.

## Elevation & Depth

These admin components use tonal layering and thin borders without box shadows. Raised backgrounds indicate hover, selection, and feedback. Keep the shared global shadow vocabulary out of this local surface unless the implementation changes.

## Shapes

Controls and artwork choices share softly rounded control corners; larger workspaces and chapter forms use workspace corners. Small poster thumbnails use thumbnail corners. Numbered steps are circular, active navigation has a straight underline, and the file upload area has a dashed border.

## Components

Primary buttons commit or initiate the main task. Secondary buttons use a bordered panel surface; quiet actions use muted text. Destructive controls use critical colors and expose confirmation before removal or reset. Buttons disable during relevant operations. Background and border transitions last 160ms; reduced-motion preferences remove transitions.

Inputs have persistent labels, dark backgrounds, a visible border, and critical borders when invalid. Keyboard focus uses a 2px purple outline with a 4px offset. Timestamp fields accept minutes:seconds and hours:minutes:seconds, with a readable range summary before saving.

Navigation emphasizes everyday admin tasks with an active underline. Smaller server-tool links sit below it. Advanced season, ID, and matching tools live in a disclosure; an uncertain season can open that disclosure automatically.

Artwork tiles first change the preview; a labeled “Ustaw jako…” button commits the choice. Uploading a custom file immediately sets it as the selected artwork, and the interface explains this. Title matching also saves and fetches data directly. Keep these distinct persistence behaviors explicit.

Feedback combines an icon and plain Polish text. Errors use `role="alert"`; other states use `role="status"`. Describe partial results truthfully, including a saved change whose preview could not refresh or a season update whose thumbnail retrieval failed.

## Do's and Don'ts

- Do preserve the shared nx palette and admin typography.
- Do keep all search results reachable and distinguish draft artwork from saved artwork.
- Do explain the result and next useful action in plain Polish.
- Do preserve visible keyboard focus, busy states, and reduced-motion support.
- Don't promote this local workflow reference into an app-wide brand commitment.
- Don't imply that a failed or partial operation completed successfully.
- Don't make technical identifiers the main route through routine material editing.
