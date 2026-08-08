---
name: Kinetic Blueprint
colors:
  surface: '#0c141c'
  surface-dim: '#0c141c'
  surface-bright: '#323a43'
  surface-container-lowest: '#070f16'
  surface-container-low: '#141c24'
  surface-container: '#182028'
  surface-container-high: '#232b33'
  surface-container-highest: '#2e363e'
  on-surface: '#dbe3ee'
  on-surface-variant: '#bec8d1'
  inverse-surface: '#dbe3ee'
  inverse-on-surface: '#29313a'
  outline: '#88929b'
  outline-variant: '#3e4850'
  surface-tint: '#86cfff'
  primary: '#86cfff'
  on-primary: '#00344c'
  primary-container: '#24a1de'
  on-primary-container: '#00344c'
  inverse-primary: '#00658f'
  secondary: '#b7c9da'
  on-secondary: '#213240'
  secondary-container: '#3a4b59'
  on-secondary-container: '#a9bacb'
  tertiary: '#00daf3'
  on-tertiary: '#00363d'
  tertiary-container: '#00a7ba'
  on-tertiary-container: '#00363d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c8e6ff'
  primary-fixed-dim: '#86cfff'
  on-primary-fixed: '#001e2e'
  on-primary-fixed-variant: '#004c6d'
  secondary-fixed: '#d3e5f6'
  secondary-fixed-dim: '#b7c9da'
  on-secondary-fixed: '#0b1d2a'
  on-secondary-fixed-variant: '#384957'
  tertiary-fixed: '#9cf0ff'
  tertiary-fixed-dim: '#00daf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#0c141c'
  on-background: '#dbe3ee'
  surface-variant: '#2e363e'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-snippet:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  canvas-grid: 24px
---

## Brand & Style
The brand personality is **Agile, Intellectual, and Fluid**. This design system bridges the gap between the casual immediacy of Telegram and the structured productivity of a professional LLM workspace. The goal is to evoke an emotional response of "effortless clarity"—where complex AI operations feel as lightweight as a chat message.

The design style is a hybrid of **Modern Corporate** and **Glassmorphism**, utilized specifically to support an "infinite canvas" aesthetic. Surfaces are treated as semi-transparent layers floating over a workspace grid, ensuring that the background remains visible to maintain a sense of expansive, non-linear space. High-contrast accents are used sparingly to guide the eye toward AI-generated insights and primary actions.

## Colors
The palette is derived from Telegram’s core identity but shifted toward a more focused, deep-space workspace environment. 

- **Primary Blue (#24A1DE):** Used for primary actions, active states, and Telegram-integrated features.
- **Secondary Slate (#546574):** Used for metadata, secondary icons, and subtle borders to reduce visual noise.
- **Tertiary Cyan (#00E5FF):** Reserved specifically for AI "status" indicators, glowing nodes on the canvas, and processing states.
- **Neutral/Background:** The "Dark" mode is the default. The background uses a deep navy-charcoal (#0E1621) to provide high contrast for text while maintaining a "canvas" feel.

In **Light Mode**, the primary blue remains, but the background shifts to a very soft grey-blue (#F4F7F9) with pure white glass cards.

## Typography
The typography system prioritizes technical legibility and hierarchy. 

- **Headlines (Geist):** A high-precision, technical font that provides a "developer-tool" feel to the workspace.
- **Body (Inter):** Chosen for its neutrality and extreme readability at various sizes, essential for long-form AI responses.
- **Monospace (JetBrains Mono):** Specifically used for labels, metadata, and AI-generated code blocks to differentiate "system" information from "human" conversation.

All AI-generated text should use a slightly increased line-height (1.6x) to facilitate scanning through large volumes of data.

## Layout & Spacing
The design system utilizes a **Fluid Grid** for panels and a **No Grid** philosophy for the infinite canvas.

- **The Canvas:** An underlying dot-grid (24px spacing) serves as the visual anchor. Elements can be placed freely but snap to this grid to maintain order.
- **Sidebars:** Fixed-width sidebars (280px) for navigation and Telegram thread history.
- **Responsive Behavior:** On mobile, the infinite canvas transitions into a vertically stackable "Feed" view similar to a Telegram chat, where cards become full-width elements. 
- **Spacing Rhythm:** Based on a 4px scale. Components typically use 8px (sm), 16px (md), or 24px (lg) padding.

## Elevation & Depth
Depth is created through **Glassmorphism** and **Tonal Layering** rather than traditional heavy shadows.

- **Level 0 (Canvas):** The base background layer.
- **Level 1 (Cards):** Semi-transparent surfaces with a 12px backdrop-blur and a subtle 1px inner border (white at 10% opacity) to define edges against the canvas.
- **Level 2 (Pinned/Active):** These elements receive a "glow" effect—a soft, low-opacity drop shadow using the Primary Blue color (#24A1DE) to indicate focus.
- **Level 3 (Modals/Popovers):** Higher opacity (90%) with a more pronounced backdrop blur (20px) to pull focus entirely from the canvas.

## Shapes
The shape language balances the softness of Telegram’s UI with the precision of a workspace.

- **General Components:** Use a standard **8px (rounded)** radius for buttons and input fields.
- **Workspace Cards:** Use a **16px (rounded-lg)** radius. This larger radius helps the cards feel like distinct, "pinnable" objects floating on the infinite canvas.
- **Interactive Nodes:** Connecting lines between cards should be rounded/curved (bezier) rather than sharp angles to reinforce the "fluid" brand personality.

## Components
- **Pinned Cards:** The core unit of the workspace. Must include a header area for "Source" (Telegram Chat name), a body for AI text, and a footer for "Actions" (Re-generate, Move to Chat, Archive).
- **Primary Buttons:** Solid Telegram Blue (#24A1DE) with white text. 8px border radius.
- **Ghost Buttons:** Transparent background with a 1px border of Secondary Slate. Used for secondary canvas actions.
- **Input Fields:** Search and Prompt bars should use a "pill" shape (rounded-xl) when floating on the canvas, mimicking the Telegram mobile input style.
- **AI Progress Strips:** A thin, 2px glowing cyan line at the top of a card indicating the LLM is currently generating text.
- **Connection Nodes:** Small circular handles on the sides of cards that allow users to draw "threads" between different AI responses.