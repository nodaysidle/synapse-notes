import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import NotesList from './pages/NotesList'
import NoteDetail from './pages/NoteDetail'
import Gallery from './pages/Gallery'
import GraphView from './pages/GraphView'
import Record from './pages/Record'
import { Spinner } from './components/ui/Spinner'
import { useAndroidBackButton } from './hooks/useAndroidBackButton'

// Show spinner while auth + workspace auto-bootstrap
function RequireReady({ children }: { children: React.ReactNode }) {
    const { loading: authLoading } = useAuth()
    const { loading: wsLoading } = useWorkspace()

    if (authLoading || wsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner label="Starting Synapse..." />
            </div>
        )
    }

    return <>{children}</>
}

function AppRoutes() {
    useAndroidBackButton()

    return (
        <Routes>
            {/* Main app routes */}
            <Route path="/" element={<RequireReady><Layout /></RequireReady>}>
                <Route index element={<Home />} />
                <Route path="notes" element={<NotesList />} />
                <Route path="notes/:id" element={<NoteDetail />} />
                <Route path="gallery" element={<Gallery />} />
                <Route path="graph" element={<GraphView />} />
            </Route>

            {/* Record page - full screen, no Layout */}
            <Route path="/record" element={<RequireReady><Record /></RequireReady>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <WorkspaceProvider>
                    <AppRoutes />
                </WorkspaceProvider>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
