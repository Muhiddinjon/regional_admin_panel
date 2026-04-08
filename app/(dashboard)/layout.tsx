import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/elite', label: 'Elite-50', icon: '⭐' },
  { href: '/elite/analysis', label: 'Kandidatlar', icon: '🎯' },
  { href: '/cc-log', label: 'CC Log', icon: '📞' },
  { href: '/reports', label: 'Hisobotlar', icon: '📋' },
  { href: '/price-research', label: "Narx O'rganish", icon: '🔍' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  const VALID_ROLES = ['rm', 'ops', 'pm', 'checker']
  if (!token || !VALID_ROLES.includes(token)) {
    redirect('/login')
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">Andijon Admin</p>
          <p className="text-xs text-gray-400 mt-0.5">Andijon · Elite-50</p>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Rol: <span className="font-medium text-gray-600">{token}</span></p>
          <form action="/api/auth/logout" method="POST">
            <button
              formAction="/api/auth/logout"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Chiqish
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
