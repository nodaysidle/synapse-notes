import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Card, Button } from '../components/ui'
import { useEffect, useRef } from 'react'

export default function WorkspaceSetup() {
  const navigate = useNavigate()
  const { user, loading: authLoading, signInAnonymously } = useAuth()
  const signingInRef = useRef(false)

  // Auto sign-in anonymously if not authenticated
  useEffect(() => {
    if (!authLoading && !user && !signingInRef.current) {
      signingInRef.current = true
      signInAnonymously()
    }
  }, [authLoading, user, signInAnonymously])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-heading mb-3">Synapse</h1>
        <p className="text-muted">Voice-first note taking</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <Card className="p-6">
          <h2 className="text-lg font-medium text-white mb-2">Create Workspace</h2>
          <p className="text-sm text-muted mb-4">Start a new workspace and invite your teammate</p>
          <Button onClick={() => navigate('/setup/create')} className="w-full">
            Create New
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-medium text-white mb-2">Join Workspace</h2>
          <p className="text-sm text-muted mb-4">Enter an invite code to join an existing workspace</p>
          <Button variant="secondary" onClick={() => navigate('/setup/join')} className="w-full">
            Join Existing
          </Button>
        </Card>
      </div>
    </div>
  )
}
