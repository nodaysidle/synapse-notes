import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'

export default function Layout() {
  const location = useLocation()
  const { workspace, loading } = useWorkspace()

  // Hide nav during loading to prevent flicker
  const showNav = !loading && !!workspace
  // Graph keeps aurora-bg + body wash; all other Layout routes use void black.
  const isGraph = location.pathname === '/graph'

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-all ${
      isActive ? 'bg-accent/10 text-accent' : 'text-slate-400 hover:text-white'
    }`

  return (
    <div className={`layout-shell min-h-screen${isGraph ? ' aurora-bg' : ' layout-home'}`}>
      {/* Main content */}
      <main className={`min-w-0 max-w-full overflow-x-hidden ${showNav ? 'pb-24' : ''}`}>
        <Outlet />
      </main>

      {/* Bottom navigation — replace keeps tab switches from stacking a back trap */}
      {showNav && (
        <nav className="bottom-nav px-3 pt-3 safe-area-pb">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-1">
            <NavLink to="/" end replace className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="text-[11px] font-medium">Capture</span>
            </NavLink>

            <NavLink to="/notes" replace className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-[11px] font-medium">Notes</span>
            </NavLink>

            <NavLink to="/gallery" replace className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14m-14 6h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px] font-medium">Gallery</span>
            </NavLink>

            <NavLink to="/graph" replace className={navLinkClass}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" strokeWidth={2} />
                <circle cx="19" cy="5" r="2" strokeWidth={2} />
                <circle cx="19" cy="19" r="2" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l10-5M7 13l10 5" />
              </svg>
              <span className="text-[11px] font-medium">Graph</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  )
}
