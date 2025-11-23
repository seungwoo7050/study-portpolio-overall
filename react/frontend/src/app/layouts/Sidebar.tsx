import { Link, useLocation } from 'react-router-dom';

interface SidebarLink {
  to: string;
  label: string;
}

const links: SidebarLink[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/issues', label: 'Issues' },
  { to: '/teams', label: 'Teams' },
  { to: '/stats', label: 'Statistics' },
  { to: '/popular', label: 'Popular Issues' },
  { to: '/external', label: 'External API' },
  { to: '/products', label: 'Product Search' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 min-h-screen">
      <nav className="p-4 space-y-2">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
