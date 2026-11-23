# Minmini CRM — Design Tokens & Shared Component Library

A unified design system and component library built specifically for Minmini CRM to guarantee visual consistency, accessibility, and pixel-perfect Light and Dark theme rendering.

---

## 📦 Directory Structure

```
components/ui/
├── tokens.ts       # Design tokens (colors, typography, radii, shadows, sources, status)
├── Button.tsx      # Unified Button (primary, secondary, outline, ghost, danger, success, brand)
├── Badge.tsx       # Badge & StatusBadge (hot, warm, cold, enrolled, responded, new, neutral)
├── Card.tsx        # Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
├── StatCard.tsx    # Metric / KPI summary card with icon, trend indicator, and dark-theme support
├── Input.tsx       # Form text input with label, icons, and error handling
├── Select.tsx      # Form select dropdown with custom chevron indicator
├── Textarea.tsx    # Multiline text area input
├── Modal.tsx       # Accessible modal dialog with backdrop blur & smooth animations
├── Table.tsx       # Table, TableHeader, TableBody, TableRow (with hover highlight), TableHead, TableCell
├── Tabs.tsx        # Segmented pill & underline tab switchers
├── Avatar.tsx      # User/Student avatar with initials fallback and status dot
├── EmptyState.tsx  # Consistent placeholder when lists or search results are empty
└── index.ts        # Single barrel export
```

---

## 🚀 Quick Usage Examples

### 1. Importing
```tsx
import {
  tokens,
  Button,
  Badge,
  StatusBadge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Input,
  Select,
  Modal,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Tabs,
  Avatar,
  EmptyState,
} from './components/ui';
```

---

### 2. Design Tokens (`tokens`)

Use `tokens` whenever you need standard classes or brand constants:

```tsx
// Adaptive Backgrounds
<div className={tokens.colors.bg.surface}>...</div>
<div className={tokens.colors.bg.surfaceElevated}>...</div>

// Adaptive Borders & Typography
<div className={`border ${tokens.colors.border.default}`}>
  <h2 className={tokens.typography.h2}>Dashboard</h2>
  <p className={tokens.typography.body}>Welcome back</p>
</div>
```

---

### 3. Buttons (`Button`)

```tsx
// Primary brand action
<Button variant="primary" size="md">Save Lead</Button>

// Secondary / Cancel
<Button variant="secondary" size="md">Cancel</Button>

// Brand purple (as used in "What's New")
<Button variant="brand" size="md">Publish Feature</Button>

// Loading state
<Button variant="primary" isLoading={isSaving}>Submit</Button>
```

---

### 4. Status Badges (`StatusBadge` & `Badge`)

Automatically formats and styles pipeline and lead stages across Light and Dark mode without contrast issues:

```tsx
// Resolves Hot, Warm, Cold, Enrolled, Responded automatically
<StatusBadge status="Hot" />
<StatusBadge status="Warm" />
<StatusBadge status="Cold" />
<StatusBadge status="Enrolled" />

// Custom generic badge
<Badge variant="new" size="sm">NEW</Badge>
```

---

### 5. KPI / Metric Cards (`StatCard`)

Standardizes all overview cards (Dashboard, Daily Report, Sales Training, AI Report):

```tsx
<StatCard
  label="Total Leads"
  value={2338}
  subLabel="From Meta, WhatsApp, Website"
  icon={<Icons.User className="w-5 h-5" />}
  iconBg="bg-blue-600"
  trend={{ value: "+12%", isPositive: true }}
/>
```

---

### 6. Tables (`Table`)

Implements the unified dark navy header bar and row hover highlight:

```tsx
<Table>
  <TableHeader>
    <TableRow isHoverable={false}>
      <TableHead>Student</TableHead>
      <TableHead>Contact</TableHead>
      <TableHead>Course</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {leads.map(lead => (
      <TableRow key={lead._id} isSelected={selectedId === lead._id}>
        <TableCell className="font-semibold">{lead.userName}</TableCell>
        <TableCell>{lead.userNumber}</TableCell>
        <TableCell>{lead.course}</TableCell>
        <TableCell><StatusBadge status={lead.status} /></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### 7. Form Controls (`Input`, `Select`, `Textarea`)

```tsx
<Input
  label="Feature Title"
  placeholder="e.g. WhatsApp Lead Capture"
  value={title}
  onChange={e => setTitle(e.target.value)}
  leftIcon={<Icons.FileText className="w-4 h-4" />}
/>

<Select
  label="Type"
  value={type}
  onChange={e => setType(e.target.value)}
  options={['Feature', 'Fix', 'Improvement']}
/>
```

---

### 8. Modals (`Modal`)

```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Add a new feature"
  subtitle="It will be shown to all users for 2 days."
  footer={
    <>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button variant="primary" onClick={handleSubmit}>Publish</Button>
    </>
  }
>
  <form className="space-y-4">
    ...
  </form>
</Modal>
```
