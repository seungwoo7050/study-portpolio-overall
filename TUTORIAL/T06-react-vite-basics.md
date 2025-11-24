# T06: React 18 + Vite 기초

**난이도**: 🟡 중급
**예상 소요 시간**: 5~6시간
**선수 과목**: T01 (JavaScript/TypeScript 핵심)

---

## 개요

React 18과 Vite를 사용한 모던 프론트엔드 개발의 기초를 학습합니다. JSX 문법, 컴포넌트 설계, Hooks, 상태 관리, 라우팅까지 다룹니다.

**학습 목표**:
- React 18 핵심 개념 (컴포넌트, Props, State) 이해
- Hooks (useState, useEffect, useRef 등) 활용
- Vite 개발 환경 설정 및 최적화
- React Router로 SPA 라우팅 구현
- Context API로 전역 상태 관리

**프로젝트 연관성**:
- **video-editor**: v1.3 (React UI 구축)
- **e-commerce**: 프론트엔드 전체

---

## 1. React 기초

### 1.1 JSX와 컴포넌트

**JSX**는 JavaScript XML의 약자로, JavaScript 내에서 HTML-like 문법을 작성할 수 있게 해줍니다.

```tsx
// src/components/Welcome.tsx
interface WelcomeProps {
  name: string;
  age?: number;
}

export function Welcome({ name, age }: WelcomeProps) {
  return (
    <div className="welcome">
      <h1>Hello, {name}!</h1>
      {age && <p>You are {age} years old.</p>}
    </div>
  );
}
```

**JSX 규칙**:
- 반드시 하나의 루트 엘리먼트를 반환 (또는 Fragment `<>...</>` 사용)
- `class` 대신 `className` 사용
- `for` 대신 `htmlFor` 사용
- 중괄호 `{}` 안에서 JavaScript 표현식 사용

### 1.2 Props와 State

**Props**: 부모 컴포넌트에서 자식 컴포넌트로 전달되는 읽기 전용 데이터

```tsx
// src/components/Button.tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// 사용
<Button label="Submit" onClick={() => console.log('Clicked')} />
```

**State**: 컴포넌트 내부에서 관리되는 가변 데이터

```tsx
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(prev => prev - 1)}>Decrement</button>
    </div>
  );
}
```

**함수형 업데이트**: 이전 상태를 기반으로 업데이트할 때는 함수형 업데이트를 사용하세요.

```tsx
// ❌ 잘못된 방법 (동시에 여러 번 호출 시 문제)
setCount(count + 1);
setCount(count + 1); // count는 여전히 초기값

// ✅ 올바른 방법
setCount(prev => prev + 1);
setCount(prev => prev + 1); // prev는 최신 값
```

### 1.3 조건부 렌더링과 리스트

**조건부 렌더링**:

```tsx
function StatusMessage({ isLoading, error, data }: StatusProps) {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return <div>Data: {data}</div>;
}

// 삼항 연산자 사용
function Greeting({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div>
      {isLoggedIn ? <UserGreeting /> : <GuestGreeting />}
    </div>
  );
}

// && 연산자 사용 (조건부 렌더링)
function Notification({ hasUnread }: { hasUnread: boolean }) {
  return (
    <div>
      {hasUnread && <span className="badge">New</span>}
    </div>
  );
}
```

**리스트 렌더링**:

```tsx
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id} className={todo.completed ? 'completed' : ''}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

**Key의 중요성**:
- `key`는 React가 어떤 항목이 변경/추가/제거되었는지 식별하는 데 사용됩니다
- 고유한 ID를 사용하세요 (인덱스 사용은 피하세요)
- 형제 요소 간에만 고유하면 됩니다 (전역적으로 고유할 필요 없음)

---

## 2. React Hooks

### 2.1 useState

컴포넌트의 지역 상태를 관리합니다.

```tsx
import { useState } from 'react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login:', { email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

**객체 상태 업데이트**:

```tsx
interface User {
  name: string;
  age: number;
  email: string;
}

function UserProfile() {
  const [user, setUser] = useState<User>({
    name: 'John',
    age: 30,
    email: 'john@example.com',
  });

  const updateName = (name: string) => {
    setUser(prev => ({ ...prev, name }));
  };

  return (
    <input
      value={user.name}
      onChange={(e) => updateName(e.target.value)}
    />
  );
}
```

### 2.2 useEffect

부수 효과(side effects)를 처리합니다: 데이터 페칭, 구독, 타이머 등

```tsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 데이터 페칭
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      });
  }, [userId]); // userId가 변경될 때마다 실행

  if (loading) return <div>Loading...</div>;
  return <div>{user?.name}</div>;
}
```

**cleanup 함수**:

```tsx
function Timer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);

    // cleanup: 컴포넌트 언마운트 또는 effect 재실행 전에 호출
    return () => {
      clearInterval(interval);
    };
  }, []); // 빈 배열: 마운트 시 한 번만 실행

  return <div>Elapsed: {seconds}s</div>;
}
```

**의존성 배열 규칙**:
- `[]`: 마운트 시 한 번만 실행
- `[dep1, dep2]`: dep1 또는 dep2가 변경될 때마다 실행
- 생략: 매 렌더링마다 실행 (거의 사용하지 않음)

### 2.3 useRef

**DOM 요소 접근**:

```tsx
import { useRef, useEffect } from 'react';

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    videoRef.current?.play();
  };

  const handlePause = () => {
    videoRef.current?.pause();
  };

  return (
    <div>
      <video ref={videoRef} src={src} />
      <button onClick={handlePlay}>Play</button>
      <button onClick={handlePause}>Pause</button>
    </div>
  );
}
```

**변경 가능한 값 저장** (렌더링 트리거 없이):

```tsx
function Stopwatch() {
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timer | null>(null);

  const start = () => {
    if (intervalRef.current) return; // 이미 실행 중

    intervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stop(); // cleanup
  }, []);

  return (
    <div>
      <p>Time: {elapsedTime}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

### 2.4 useCallback와 useMemo

**useCallback**: 함수 메모이제이션 (자식 컴포넌트에 함수를 전달할 때 유용)

```tsx
import { useState, useCallback } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);

  // useCallback 없으면 매 렌더링마다 새 함수 생성
  const addTodo = useCallback((text: string) => {
    setTodos(prev => [...prev, { id: Date.now(), text, completed: false }]);
  }, []); // 의존성 없음: 함수는 항상 동일

  const toggleTodo = useCallback((id: number) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  return (
    <div>
      <AddTodoForm onAdd={addTodo} />
      <TodoList todos={todos} onToggle={toggleTodo} />
    </div>
  );
}
```

**useMemo**: 값 메모이제이션 (비용이 큰 계산 결과를 캐싱)

```tsx
import { useMemo } from 'react';

function ExpensiveCalculation({ items }: { items: number[] }) {
  const sum = useMemo(() => {
    console.log('Computing sum...');
    return items.reduce((acc, item) => acc + item, 0);
  }, [items]); // items가 변경될 때만 재계산

  const average = useMemo(() => {
    return items.length > 0 ? sum / items.length : 0;
  }, [items, sum]);

  return (
    <div>
      <p>Sum: {sum}</p>
      <p>Average: {average}</p>
    </div>
  );
}
```

**주의**: 과도한 최적화는 오히려 성능을 해칠 수 있습니다. 프로파일링 후 필요한 곳에만 사용하세요.

### 2.5 Custom Hooks

재사용 가능한 로직을 추출합니다.

```tsx
// src/hooks/useFetch.ts
import { useState, useEffect } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useFetch<T>(url: string): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}

// 사용
function UserList() {
  const { data, loading, error } = useFetch<User[]>('/api/users');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

**useLocalStorage 예제**:

```tsx
// src/hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

// 사용
function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Current theme: {theme}
    </button>
  );
}
```

---

## 3. Vite 설정 및 최적화

### 3.1 프로젝트 초기화

```bash
# Vite 프로젝트 생성
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install

# 개발 서버 실행
npm run dev
```

### 3.2 vite.config.ts

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // 경로 별칭
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
    },
  },

  // 개발 서버 설정
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  // 빌드 최적화
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
```

### 3.3 환경 변수

```bash
# .env.development
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

# .env.production
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

```tsx
// src/config.ts
export const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  wsUrl: import.meta.env.VITE_WS_URL,
};
```

### 3.4 Hot Module Replacement (HMR)

Vite는 기본적으로 HMR을 지원합니다. 파일을 저장하면 즉시 브라우저에 반영됩니다.

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 4. React Router

### 4.1 기본 라우팅

```bash
npm install react-router-dom
```

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import UserProfile from './pages/UserProfile';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/users/1">User 1</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/users/:id" element={<UserProfile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 4.2 Route Parameters와 Query Strings

```tsx
// src/pages/UserProfile.tsx
import { useParams, useSearchParams } from 'react-router-dom';

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'profile';

  return (
    <div>
      <h1>User {id}</h1>
      <p>Current tab: {tab}</p>
    </div>
  );
}

// URL: /users/123?tab=settings
// id = "123", tab = "settings"
```

### 4.3 Programmatic Navigation

```tsx
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = async (credentials: Credentials) => {
    const success = await login(credentials);
    if (success) {
      navigate('/dashboard', { replace: true });
    }
  };

  const goBack = () => {
    navigate(-1); // 뒤로 가기
  };

  return (
    <div>
      <LoginForm onSubmit={handleLogin} />
      <button onClick={goBack}>Back</button>
    </div>
  );
}
```

### 4.4 Protected Routes

```tsx
// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// 사용
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

---

## 5. Context API로 전역 상태 관리

### 5.1 Context 생성

```tsx
// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw new Error('Login failed');

    const userData = await response.json();
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 5.2 Provider 사용

```tsx
// src/main.tsx
import { AuthProvider } from './contexts/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

```tsx
// src/components/UserMenu.tsx
import { useAuth } from '@/contexts/AuthContext';

export function UserMenu() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Link to="/login">Login</Link>;
  }

  return (
    <div>
      <span>Hello, {user?.name}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### 5.3 useReducer와 결합

복잡한 상태 로직은 `useReducer`로 관리하세요.

```tsx
// src/contexts/TodoContext.tsx
import { createContext, useContext, useReducer, ReactNode } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

type TodoAction =
  | { type: 'ADD'; text: string }
  | { type: 'TOGGLE'; id: number }
  | { type: 'DELETE'; id: number };

function todoReducer(state: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'ADD':
      return [...state, { id: Date.now(), text: action.text, completed: false }];
    case 'TOGGLE':
      return state.map(todo =>
        todo.id === action.id ? { ...todo, completed: !todo.completed } : todo
      );
    case 'DELETE':
      return state.filter(todo => todo.id !== action.id);
    default:
      return state;
  }
}

interface TodoContextType {
  todos: Todo[];
  addTodo: (text: string) => void;
  toggleTodo: (id: number) => void;
  deleteTodo: (id: number) => void;
}

const TodoContext = createContext<TodoContextType | undefined>(undefined);

export function TodoProvider({ children }: { children: ReactNode }) {
  const [todos, dispatch] = useReducer(todoReducer, []);

  const addTodo = (text: string) => dispatch({ type: 'ADD', text });
  const toggleTodo = (id: number) => dispatch({ type: 'TOGGLE', id });
  const deleteTodo = (id: number) => dispatch({ type: 'DELETE', id });

  return (
    <TodoContext.Provider value={{ todos, addTodo, toggleTodo, deleteTodo }}>
      {children}
    </TodoContext.Provider>
  );
}

export function useTodos() {
  const context = useContext(TodoContext);
  if (!context) throw new Error('useTodos must be used within TodoProvider');
  return context;
}
```

---

## 6. 컴포넌트 패턴

### 6.1 Composition (합성)

```tsx
// src/components/Card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>;
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="card-footer">{children}</div>;
}

// 사용
<Card>
  <CardHeader>
    <h2>User Profile</h2>
  </CardHeader>
  <CardBody>
    <p>Name: John Doe</p>
    <p>Email: john@example.com</p>
  </CardBody>
  <CardFooter>
    <button>Edit</button>
  </CardFooter>
</Card>
```

### 6.2 Compound Components

```tsx
// src/components/Tabs.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function Tabs({ children, defaultTab }: { children: ReactNode; defaultTab: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children }: { children: ReactNode }) {
  return <div className="tab-list">{children}</div>;
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === id;

  return (
    <button
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

export function TabPanels({ children }: { children: ReactNode }) {
  return <div className="tab-panels">{children}</div>;
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  const { activeTab } = context;
  if (activeTab !== id) return null;

  return <div className="tab-panel">{children}</div>;
}

// 사용
<Tabs defaultTab="profile">
  <TabList>
    <Tab id="profile">Profile</Tab>
    <Tab id="settings">Settings</Tab>
    <Tab id="notifications">Notifications</Tab>
  </TabList>
  <TabPanels>
    <TabPanel id="profile">
      <h2>Profile Content</h2>
    </TabPanel>
    <TabPanel id="settings">
      <h2>Settings Content</h2>
    </TabPanel>
    <TabPanel id="notifications">
      <h2>Notifications Content</h2>
    </TabPanel>
  </TabPanels>
</Tabs>
```

### 6.3 Render Props

```tsx
// src/components/MouseTracker.tsx
interface MousePosition {
  x: number;
  y: number;
}

interface MouseTrackerProps {
  render: (position: MousePosition) => React.ReactNode;
}

export function MouseTracker({ render }: MouseTrackerProps) {
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return <>{render(position)}</>;
}

// 사용
<MouseTracker
  render={({ x, y }) => (
    <div>
      Mouse position: {x}, {y}
    </div>
  )}
/>
```

---

## 7. 성능 최적화

### 7.1 React.memo

컴포넌트를 메모이제이션하여 불필요한 리렌더링을 방지합니다.

```tsx
import { memo } from 'react';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
}

// props가 변경되지 않으면 리렌더링하지 않음
export const TodoItem = memo(function TodoItem({ todo, onToggle }: TodoItemProps) {
  console.log('Rendering TodoItem:', todo.id);

  return (
    <li onClick={() => onToggle(todo.id)}>
      {todo.text} {todo.completed ? '✓' : ''}
    </li>
  );
});
```

### 7.2 Code Splitting (Lazy Loading)

```tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// 동적 import로 코드 스플리팅
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### 7.3 Error Boundaries

React 18에서는 아직 함수형 컴포넌트로 Error Boundary를 만들 수 없습니다. 클래스 컴포넌트를 사용하세요.

```tsx
// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div>
            <h1>Something went wrong</h1>
            <p>{this.state.error?.message}</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// 사용
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

---

## 8. Best Practices

### 8.1 파일 구조

```
src/
├── components/          # 재사용 가능한 컴포넌트
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.css
│   │   └── index.ts
│   └── Card/
├── pages/               # 페이지 컴포넌트
│   ├── Home.tsx
│   ├── Dashboard.tsx
│   └── UserProfile.tsx
├── hooks/               # Custom hooks
│   ├── useFetch.ts
│   └── useLocalStorage.ts
├── contexts/            # Context providers
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── utils/               # 유틸리티 함수
│   ├── formatDate.ts
│   └── validateEmail.ts
├── types/               # TypeScript 타입 정의
│   ├── user.ts
│   └── api.ts
├── App.tsx
├── main.tsx
└── index.css
```

### 8.2 Props Drilling 회피

Props를 3단계 이상 전달해야 한다면 Context API를 고려하세요.

```tsx
// ❌ Props Drilling
<App>
  <Dashboard user={user}>
    <Sidebar user={user}>
      <UserMenu user={user} />
    </Sidebar>
  </Dashboard>
</App>

// ✅ Context 사용
<AuthProvider>
  <App>
    <Dashboard>
      <Sidebar>
        <UserMenu /> {/* useAuth()로 user 접근 */}
      </Sidebar>
    </Dashboard>
  </App>
</AuthProvider>
```

### 8.3 이벤트 핸들러 명명 규칙

- 핸들러 함수: `handleXxx`
- 핸들러 prop: `onXxx`

```tsx
interface ButtonProps {
  onClick: () => void; // prop
}

function LoginForm() {
  const handleSubmit = (e: React.FormEvent) => { // 핸들러
    e.preventDefault();
    // ...
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 8.4 TypeScript 타입 활용

```tsx
// src/types/api.ts
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

// 사용
const response: PaginatedResponse<User> = await fetchUsers(page);
```

---

## 9. 실전 프로젝트: Todo App

### 9.1 완전한 구현

```tsx
// src/App.tsx
import { TodoProvider } from './contexts/TodoContext';
import { TodoList } from './components/TodoList';
import { AddTodoForm } from './components/AddTodoForm';
import { TodoStats } from './components/TodoStats';

function App() {
  return (
    <TodoProvider>
      <div className="app">
        <h1>Todo App</h1>
        <TodoStats />
        <AddTodoForm />
        <TodoList />
      </div>
    </TodoProvider>
  );
}

export default App;
```

```tsx
// src/components/AddTodoForm.tsx
import { useState } from 'react';
import { useTodos } from '@/contexts/TodoContext';

export function AddTodoForm() {
  const [text, setText] = useState('');
  const { addTodo } = useTodos();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      addTodo(text.trim());
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a new todo..."
      />
      <button type="submit">Add</button>
    </form>
  );
}
```

```tsx
// src/components/TodoList.tsx
import { useTodos } from '@/contexts/TodoContext';
import { TodoItem } from './TodoItem';

export function TodoList() {
  const { todos } = useTodos();

  if (todos.length === 0) {
    return <p>No todos yet. Add one above!</p>;
  }

  return (
    <ul className="todo-list">
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

```tsx
// src/components/TodoItem.tsx
import { memo } from 'react';
import { useTodos } from '@/contexts/TodoContext';
import type { Todo } from '@/contexts/TodoContext';

interface TodoItemProps {
  todo: Todo;
}

export const TodoItem = memo(function TodoItem({ todo }: TodoItemProps) {
  const { toggleTodo, deleteTodo } = useTodos();

  return (
    <li className={todo.completed ? 'completed' : ''}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => toggleTodo(todo.id)}
      />
      <span>{todo.text}</span>
      <button onClick={() => deleteTodo(todo.id)}>Delete</button>
    </li>
  );
});
```

```tsx
// src/components/TodoStats.tsx
import { useTodos } from '@/contexts/TodoContext';

export function TodoStats() {
  const { todos } = useTodos();
  const completed = todos.filter(t => t.completed).length;
  const total = todos.length;

  return (
    <div className="stats">
      <span>Completed: {completed} / {total}</span>
    </div>
  );
}
```

---

## 10. 트러블슈팅

### 10.1 "Cannot read property 'xxx' of undefined"

**원인**: 데이터가 로드되기 전에 접근

```tsx
// ❌ 잘못된 코드
function UserProfile({ userId }: { userId: number }) {
  const { data } = useFetch<User>(`/api/users/${userId}`);
  return <div>{data.name}</div>; // data가 null일 때 에러
}

// ✅ 올바른 코드
function UserProfile({ userId }: { userId: number }) {
  const { data, loading } = useFetch<User>(`/api/users/${userId}`);

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>User not found</div>;

  return <div>{data.name}</div>;
}
```

### 10.2 무한 루프 (useEffect)

**원인**: 의존성 배열에 객체/배열을 직접 넣음

```tsx
// ❌ 무한 루프
function Component() {
  const [data, setData] = useState([]);
  const options = { limit: 10 }; // 매 렌더링마다 새 객체

  useEffect(() => {
    fetchData(options).then(setData);
  }, [options]); // options이 매번 다른 참조 → 무한 루프
}

// ✅ 해결 방법 1: 원시값으로 추출
function Component() {
  const [data, setData] = useState([]);
  const limit = 10;

  useEffect(() => {
    fetchData({ limit }).then(setData);
  }, [limit]);
}

// ✅ 해결 방법 2: useMemo 사용
function Component() {
  const [data, setData] = useState([]);
  const options = useMemo(() => ({ limit: 10 }), []);

  useEffect(() => {
    fetchData(options).then(setData);
  }, [options]);
}
```

### 10.3 상태 업데이트가 반영되지 않음

**원인**: 비동기적인 setState

```tsx
// ❌ 잘못된 코드
function Counter() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
    console.log(count); // 여전히 이전 값 출력
  };
}

// ✅ 올바른 코드
function Counter() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(prev => {
      const newCount = prev + 1;
      console.log(newCount); // 새 값 출력
      return newCount;
    });
  };

  // 또는 useEffect 사용
  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);
}
```

### 10.4 메모리 누수 (Memory Leak)

**원인**: cleanup 함수 누락

```tsx
// ❌ 메모리 누수
function Timer() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
    // cleanup 없음 → 컴포넌트 언마운트 후에도 interval 실행
  }, []);
}

// ✅ 올바른 코드
function Timer() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);

    return () => clearInterval(interval); // cleanup
  }, []);
}
```

---

## 11. 면접 대비 질문

### Q1: Virtual DOM이란 무엇이며, 왜 사용하나요?

**답변**: Virtual DOM은 실제 DOM의 경량 복사본입니다. React는 상태가 변경될 때:
1. 새로운 Virtual DOM 트리 생성
2. 이전 Virtual DOM과 비교 (Diffing)
3. 변경된 부분만 실제 DOM에 반영 (Reconciliation)

이를 통해 DOM 조작을 최소화하여 성능을 향상시킵니다.

### Q2: useEffect와 useLayoutEffect의 차이는?

**답변**:
- `useEffect`: 브라우저가 화면을 그린 **후** 비동기적으로 실행
- `useLayoutEffect`: 브라우저가 화면을 그리기 **전** 동기적으로 실행

DOM 측정이나 레이아웃 변경이 필요할 때 `useLayoutEffect`를 사용하세요.

```tsx
useLayoutEffect(() => {
  const height = ref.current?.offsetHeight;
  // DOM 측정 결과를 즉시 사용
}, []);
```

### Q3: React.memo, useMemo, useCallback의 차이는?

**답변**:
- `React.memo`: **컴포넌트** 메모이제이션 (props가 같으면 리렌더링 skip)
- `useMemo`: **값** 메모이제이션 (비용이 큰 계산 결과 캐싱)
- `useCallback`: **함수** 메모이제이션 (함수 재생성 방지)

```tsx
const MemoizedComponent = React.memo(MyComponent); // 컴포넌트
const expensiveValue = useMemo(() => compute(a, b), [a, b]); // 값
const memoizedCallback = useCallback(() => doSomething(a), [a]); // 함수
```

### Q4: Controlled vs Uncontrolled Components

**답변**:
- **Controlled**: React state로 input 값 관리 (권장)
- **Uncontrolled**: DOM이 직접 input 값 관리 (ref 사용)

```tsx
// Controlled
function ControlledInput() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}

// Uncontrolled
function UncontrolledInput() {
  const ref = useRef<HTMLInputElement>(null);
  const handleSubmit = () => {
    console.log(ref.current?.value);
  };
  return <input ref={ref} />;
}
```

### Q5: key prop의 역할은?

**답변**: React가 리스트의 어떤 항목이 변경/추가/제거되었는지 식별하는 데 사용됩니다. 올바른 key를 사용하면:
- 불필요한 리렌더링 방지
- 컴포넌트 상태 유지
- 애니메이션 최적화

```tsx
// ❌ 나쁨: 인덱스 사용
{items.map((item, index) => <Item key={index} {...item} />)}

// ✅ 좋음: 고유 ID 사용
{items.map(item => <Item key={item.id} {...item} />)}
```

---

## 12. 다음 단계

### T06 완료 후 학습 경로:
1. **T07 (React Query + Forms)**: 서버 상태 관리, 폼 라이브러리
2. **T08 (통계 + 검색 최적화)**: 고급 UI 패턴
3. **T09 (테스팅 + 접근성)**: Jest, React Testing Library, a11y

### 추가 학습 자료:
- React 공식 문서: https://react.dev
- Vite 공식 문서: https://vitejs.dev
- React Router: https://reactrouter.com

---

**마지막 업데이트**: 2025년 1월
**다음 튜토리얼**: [T07 - React Query + Forms →](./T07-react-query-forms.md)
