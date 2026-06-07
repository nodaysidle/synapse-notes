import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import { Card, Button, Input } from '../components/ui'

export default function CreateWorkspace() {
  const navigate = useNavigate()
  const { createWorkspace } = useWorkspace()
  const { user, loading: authLoading, signInAnonymously } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const signingInRef = useRef(false)

  // Ensure user is signed in
  useEffect(() => {
    if (!authLoading && !user && !signingInRef.current) {
      signingInRef.current = true
      signInAnonymously().catch((err) => {
        console.error('Failed to sign in:', err)
        setError('Failed to authenticate. Please refresh and try again.')
      })
    }
  }, [authLoading, user, signInAnonymously])

  const handleCreate = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Please enter a workspace name')
      return
    }

    if (!user) {
      setError('Still authenticating... please wait and try again')
      return
    }

    setLoading(true)
    try {
      const workspace = await createWorkspace(name.trim())
      setInviteCode(workspace.invite_code)
    } catch (err: any) {
      console.error('Failed to create workspace:', err)
      setError(err?.message || 'Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    navigate('/')
  }

  // Show loading while auth is in progress
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Show invite code after creation
  if (inviteCode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <Card className="w-full max-w-sm p-6 text-center">
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Workspace Created!</h2>
          <p className="text-sm text-muted mb-6">Share this code with your teammate:</p>
          <div className="bg-black/30 rounded-xl p-4 mb-6">
            <p className="text-2xl font-mono font-bold text-accent tracking-wider">{inviteCode}</p>
          </div>
          <Button onClick={handleContinue} className="w-full">Continue to App</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <button
        onClick={() => navigate('/setup')}
        aria-label="Go back"
        className="absolute top-6 left-6 text-muted hover:text-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <Card className="w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-white mb-6">Create Workspace</h2>

        {error && (
          <div className="bg-rose-500/20 text-rose-400 text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <Input
          label="Workspace Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Notes"
        />

        <Button onClick={handleCreate} loading={loading} className="w-full mt-6">
          Create Workspace
        </Button>
      </Card>
    </div>
  )
}
