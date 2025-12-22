# Timer Application

## Overview

A focus timer application built with React frontend and Express backend. The app allows users to set custom timers, save timer presets, track session history, and view productivity statistics. Features include Pomodoro mode, customizable sounds, dark/light theme, and timer styling options. The interface is in Traditional Chinese (繁體中文).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React useState for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark/light mode support)
- **Animations**: Framer Motion for smooth transitions
- **Timer Display**: react-circular-progressbar for visual timer progress

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **API Design**: RESTful endpoints defined in shared routes file with Zod validation
- **Session Storage**: connect-pg-simple for PostgreSQL-backed sessions

### Data Storage
- **Database**: PostgreSQL
- **Schema Location**: `shared/schema.ts`
- **Tables**:
  - `presets`: Stores saved timer configurations (id, name, duration)
  - `timer_history`: Tracks completed timer sessions (id, duration, completedAt, type)

### Build System
- **Frontend Bundler**: Vite with React plugin
- **Backend Bundler**: esbuild for production builds
- **Development**: tsx for running TypeScript directly
- **Path Aliases**: `@/` for client source, `@shared/` for shared code

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts`: Database schema definitions and Zod validation schemas
- `routes.ts`: API route definitions with type-safe request/response schemas

### Key Design Decisions

1. **Monorepo Structure**: Client, server, and shared code in single repository for easier development and type sharing.

2. **Type-Safe API**: Zod schemas defined in shared routes ensure consistent validation between frontend and backend.

3. **Component Library**: shadcn/ui provides accessible, customizable components without the overhead of a full component library.

4. **Database-First Schema**: Drizzle-zod generates validation schemas directly from database tables.

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations via `npm run db:push`

### UI/UX Libraries
- **Radix UI**: Headless UI primitives for accessibility
- **Lucide React**: Icon library
- **Embla Carousel**: Carousel functionality
- **Vaul**: Drawer component

### Audio
- **External Sound URLs**: Timer completion sounds hosted on mixkit.co CDN

### Development Tools
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner for Replit environment