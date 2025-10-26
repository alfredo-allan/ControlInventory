# Design Guidelines: Controle de Perecíveis

## Design Approach
**Utility-First Design System** - This inventory management application prioritizes efficiency, data clarity, and workflow optimization. Drawing from Material Design principles for information-dense interfaces while maintaining modern Brazilian market aesthetics.

## Typography System
**Primary Font**: Sora (Google Fonts)
- Page Titles: text-2xl to text-3xl, font-semibold
- Section Headers: text-xl, font-medium
- Card Titles: text-lg, font-medium
- Body Text: text-base, font-normal
- Helper Text/Labels: text-sm, font-normal
- Small Print/Metadata: text-xs

## Layout System
**Spacing Units**: Consistent use of Tailwind units 2, 4, 6, 8, 12, 16, 24
- Container Padding: p-4 (mobile), p-6 to p-8 (desktop)
- Card Spacing: gap-4 to gap-6 between cards
- Form Field Spacing: space-y-4 for stacked inputs
- Section Margins: mb-6 to mb-12 between major sections

**Grid Patterns**:
- Registration Form: Single column on mobile, 2-column layout on desktop (lg:grid-cols-2) for compact data entry
- Product List: Card grid with grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Maximum container width: max-w-7xl for main content areas

## Component Library

### Navigation
**Header Component**:
- Fixed top header with app name, theme toggle (sun/moon icon), and hamburger menu (mobile)
- Desktop: Horizontal navigation with icons from Lucide React (FileText, List, RefreshCw, Trash2, Dog)
- Mobile: Slide-out menu panel with full-height navigation
- "Farejar" button gets distinctive treatment with dog icon and accent styling

### Cards
**Modern Card Design**:
- Rounded corners: rounded-lg to rounded-xl
- Subtle shadows: shadow-sm with shadow-md on hover
- Border treatment: border border-gray-200 (light) / border-gray-700 (dark)
- Internal padding: p-4 to p-6
- Hover state: subtle scale transform (hover:scale-[1.02]) and shadow increase

### Forms
**Input Fields**:
- Consistent height: h-10 to h-12
- Rounded borders: rounded-md
- Clear focus states with ring utilities
- Labels positioned above inputs with mb-1 to mb-2
- EAN input with loading spinner when fetching from API
- Date picker with calendar icon, Portuguese locale, distinctive styling

**Buttons**:
- Primary Actions: Solid background with rounded-md, px-4 py-2, font-medium
- Secondary Actions: Outlined style with transparent background
- Icon buttons: Square aspect ratio, p-2, rounded-md
- Disabled state: Reduced opacity and cursor-not-allowed

### Modals
**Modal Pattern**:
- Centered overlay with backdrop blur (backdrop-blur-sm)
- Modal container: max-w-2xl, rounded-lg, shadow-2xl
- Header with title and close button (X icon)
- Content area with scrollable body if needed
- Footer with action buttons aligned right
- Smooth entrance/exit animations

### Data Display
**Product List Cards**:
- Product name as prominent heading
- EAN code in monospace font (font-mono)
- Expiry date with color coding: green (>7 days), yellow (3-7 days), red (≤3 days)
- Quantity and type badges
- Operator name in smaller, muted text
- Action buttons in card footer (Update, Delete icons)

**"Farejar" Alert View**:
- Warning banner style for items expiring soon
- Color-coded urgency levels
- Clear date countdown display
- Batch action capabilities

### Theme Toggle
**Light/Dark Mode**:
- Smooth transition between themes
- Toggle switch in header (sun/moon icons)
- Preserve user preference in LocalStorage
- Ensure sufficient contrast in both modes
- Adjust shadow intensity per theme

## Print Styles
**Print View Design**:
- Clean, ink-efficient layout
- Remove: navigation, theme toggle, action buttons, decorative elements
- Preserve: essential data, clear hierarchy, product information
- Header with app name and print date
- Tabular or list format for products
- Page breaks between logical sections

## Loading States
**Animations**:
- Spinner for API calls (Lucide Loader icon with spin animation)
- Skeleton loaders for product cards during initial load
- Subtle pulse animation for loading states
- Success/error toast notifications with slide-in animation

## Accessibility
- Keyboard navigation for all interactive elements
- ARIA labels for icon-only buttons
- Focus visible indicators
- Semantic HTML structure
- Form validation with clear error messages

## Icons
**Lucide React Icons** (via CDN):
- Navigation: FileText, List, RefreshCw, Trash2, Dog
- Forms: Calendar, Barcode, Package, User
- Actions: Check, X, Edit2, Trash, Search
- UI: Menu, Sun, Moon, ChevronDown, AlertCircle

## Responsive Breakpoints
- Mobile: base (< 768px) - Single column, stacked forms
- Tablet: md (768px+) - 2-column grids, expanded forms
- Desktop: lg (1024px+) - 3-column grids, side-by-side layouts

## Images
No hero images required. This is a utility application focused on data entry and management. Visual emphasis through iconography, color-coded status indicators, and clean card-based layouts.