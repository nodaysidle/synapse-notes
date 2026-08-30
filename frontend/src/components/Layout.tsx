import { Outlet, NavLink } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'

export default function Layout() {
  const { workspace, loading } = useWorkspace()

  // Hide nav during loading to prevent flicker
  const showNav = !loading && !!workspace

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-w-[64px] flex-col items-center gap-1 rounded-2xl px-2 py-1.5 transition-all ${
      isActive ? 'bg-accent/10 text-accent shadow-[0_0_24px_rgba(200,255,0,0.12)]' : 'text-slate-400 hover:text-white'
    }`

  return (
    <div className="min-h-screen aurora-bg">
      {/* Main content */}
      <main className={`${showNav ? 'pb-24' : ''}`}>
        <Outlet />
      </main>

      {/* Bottom navigation */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bottom-nav px-6 py-4 safe-area-pb">
          <div className="max-w-md mx-auto flex justify-around items-center">
            <NavLink to="/" className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="text-xs font-medium">Capture</span>
            </NavLink>

            <NavLink to="/notes" className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-xs font-medium">Notes</span>
            </NavLink>

            <NavLink to="/gallery" className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14m-14 6h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium">Gallery</span>
            </NavLink>

            <NavLink to="/graph" className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" strokeWidth={2} />
                <circle cx="19" cy="5" r="2" strokeWidth={2} />
                <circle cx="19" cy="19" r="2" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l10-5M7 13l10 5" />
              </svg>
              <span className="text-xs font-medium">Graph</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  )
}
