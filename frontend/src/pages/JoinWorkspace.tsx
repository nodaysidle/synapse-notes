import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { Card, Button, Input } from '../components/ui'

export default function JoinWorkspace() {
  const navigate = useNavigate()
  const { joinWorkspace } = useWorkspace()
  const [inviteCode, setInviteCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async () => {
    setError(null)
    if (!inviteCode.trim()) {
      setError('Please enter an invite code')
      return
    }
    if (!displayName.trim()) {
      setError('Please enter your display name')
      return
    }

    setLoading(true)
    try {
      await joinWorkspace(inviteCode.trim(), displayName.trim())
      navigate('/')
    } catch (err) {
      console.error('Failed to join workspace:', err)
      setError('Invalid invite code or already a member')
    } finally {
      setLoading(false)
    }
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
        <h2 className="text-xl font-bold text-white mb-6">Join Workspace</h2>

        {error && (
          <div className="bg-rose-500/20 text-rose-400 text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Invite Code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="SYNAPSE-XXXX"
          />

          <Input
            label="Your Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alex"
          />
        </div>

        <Button onClick={handleJoin} loading={loading} className="w-full mt-6">
          Join Workspace
        </Button>
      </Card>
    </div>
  )
}
