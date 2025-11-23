# React Web Frontend Training Project

A comprehensive React + TypeScript frontend application demonstrating modern web development patterns and best practices.

## 🎯 Project Overview

This project implements a full-featured issue tracking and team collaboration system, covering all major frontend patterns:

- **CRUD Operations**: Full create, read, update, delete functionality for projects, issues, and comments
- **Authentication & Authorization**: JWT-based auth with role-based access control (RBAC)
- **Team Management**: Team creation, member management, and workspace collaboration
- **Data Visualization**: Statistics dashboard with charts and data fetching patterns
- **Advanced Search**: Product search with filters and URL query synchronization
- **Testing**: Comprehensive unit, integration, and E2E tests
- **Accessibility**: WCAG-compliant with semantic HTML and ARIA attributes

## 🛠️ Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v7
- **State Management**: React Query (TanStack Query)
- **Forms**: react-hook-form + Zod
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library + Playwright
- **API Client**: Axios

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/              # App-level configuration
│   │   ├── layouts/      # Layout components
│   │   └── routes/       # Page components
│   ├── features/         # Feature-based modules
│   │   ├── auth/         # Authentication
│   │   ├── issue/        # Issue management
│   │   ├── project/      # Project management
│   │   ├── team/         # Team collaboration
│   │   ├── stats/        # Statistics & charts
│   │   └── product/      # Product search
│   ├── shared/           # Shared utilities
│   │   ├── components/   # Reusable components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utilities & configs
│   │   └── types/        # TypeScript types
│   └── test/             # Test setup
├── tests/
│   └── e2e/              # E2E test scenarios
└── public/               # Static assets
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint

# Build for production
npm run build
```

## 🧪 Testing

### Unit & Integration Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Test Coverage

The project includes comprehensive tests for:

- ✅ All major page components (Projects, Issues, Teams)
- ✅ Form validation and submission
- ✅ User interactions and navigation
- ✅ E2E workflow: Login → Project selection → Issue creation → Detail view
- ✅ Error handling and loading states
- ✅ Accessibility features

## ♿ Accessibility

This project follows WCAG 2.1 Level AA guidelines:

- **Semantic HTML**: Proper use of `<main>`, `<nav>`, `<section>`, `<article>`, etc.
- **ARIA Attributes**: Comprehensive aria-label, aria-labelledby, role attributes
- **Keyboard Navigation**: Full keyboard accessibility for all interactive elements
- **Screen Reader Support**: Proper labeling and structure for assistive technologies

## 📊 Features Implemented

### Milestone 1: Bootstrap & Routing
- ✅ Vite + React + TypeScript setup
- ✅ React Router configuration
- ✅ Basic layout with header/sidebar
- ✅ Tailwind CSS integration
- ✅ CI/CD pipeline

### Milestone 2: Issue Tracker CRUD
- ✅ Project list and creation
- ✅ Issue list with filters
- ✅ Issue detail, create, edit, delete
- ✅ Comments functionality
- ✅ Form validation with react-hook-form + Zod

### Milestone 3: Authentication & Authorization
- ✅ Login page with JWT
- ✅ Protected routes
- ✅ Team management
- ✅ Role-based access control (OWNER/MANAGER/MEMBER)
- ✅ Global error handling

### Milestone 4: Statistics & Data Patterns
- ✅ Statistics dashboard
- ✅ Popular issues page
- ✅ External API integration
- ✅ Loading/error/empty states

### Milestone 5: Search & Filters
- ✅ Product search with advanced filters
- ✅ URL query synchronization
- ✅ Reusable table component
- ✅ Performance optimization (React.memo, code splitting)

### Milestone 6: Testing & Accessibility
- ✅ Unit tests with Vitest + React Testing Library
- ✅ E2E tests with Playwright
- ✅ Accessibility improvements (semantic tags, ARIA attributes)
- ✅ Keyboard navigation support

## 🔧 Configuration Files

- `vite.config.ts` - Vite build configuration
- `vitest.config.ts` - Vitest test configuration
- `playwright.config.ts` - Playwright E2E configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `eslint.config.js` - ESLint configuration

## 📝 API Integration

The frontend is designed to work with any backend that implements the API specification defined in `CLAUDE.md`. For development without a backend, you can use:

- json-server for mock REST API
- MSW (Mock Service Worker) for API mocking
- Static mock data in development mode

## 🤝 Contributing

1. Follow the existing code structure and patterns
2. Write tests for new features
3. Ensure accessibility standards are met
4. Run `npm run lint` and `npm test` before committing
5. Follow conventional commit messages

## 📄 License

This is a training project for learning purposes.

## 🎓 Learning Outcomes

By completing this project, you will have hands-on experience with:

- Modern React patterns and best practices
- TypeScript in a real-world application
- State management with React Query
- Form handling and validation
- Authentication and authorization flows
- Testing strategies (unit, integration, E2E)
- Accessibility and inclusive design
- Performance optimization techniques
- CI/CD pipeline setup
