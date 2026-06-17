import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { api } from '../../convex/_generated/api'
import { getAvatar } from '#/lib/avatar'
import { useUploadThing } from '#/lib/uploadthing'
import { Skeleton } from '#/components/ui/skeleton'
import { Progress } from '#/components/ui/progress'

export const Route = createFileRoute('/chat')({
  component: RouteComponent,
})

const playPingSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    
    // Soft, high-pitched modern bubble pop / ping sound
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(650, audioCtx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(1300, audioCtx.currentTime + 0.12)
    
    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15)
    
    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.15)
  } catch (e) {
    console.warn('Web Audio API not supported or blocked by autoplay:', e)
  }
}

function ChatLoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {Array.from({ length: 5 }).map((_, i) => {
        const isRight = i % 2 === 1
        return (
          <div key={i} className={`flex items-start gap-3 ${isRight ? 'flex-row-reverse' : ''}`}>
            <Skeleton className="w-8 h-8 rounded-full shrink-0 animate-pulse bg-accent" />
            <div className={`flex flex-col gap-2 max-w-[70%] w-full ${isRight ? 'items-end' : 'items-start'}`}>
              <Skeleton className="h-4 w-20 rounded animate-pulse bg-accent" />
              <Skeleton className={`h-6 rounded-2xl animate-pulse bg-accent ${isRight ? 'w-full rounded-tr-none' : 'w-full rounded-tl-none'}`} />
              {i % 3 === 0 && <Skeleton className="h-6 w-2/3 rounded-2xl animate-pulse bg-accent" />}
              {i % 3 === 2 && <Skeleton className="h-32 w-48 rounded-lg mt-1 animate-pulse bg-accent" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: any
}

function ProfileModal({ isOpen, onClose, currentUser }: ProfileModalProps) {
  const updateProfile = useMutation(api.users.updateProfile)
  const [displayName, setDisplayName] = useState('')
  const [avatarSeed, setAvatarSeed] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '')
      setAvatarSeed(currentUser.avatarSeed || '')
    }
  }, [currentUser, isOpen])

  if (!isOpen) return null

  const randomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 12)
    setAvatarSeed(randomSeed)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return

    setSaving(true)
    try {
      await updateProfile({
        displayName: displayName.trim(),
        avatarSeed,
      })
      onClose()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to save profile settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/60 backdrop-blur-md z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal Dialog */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Profile Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors cursor-pointer"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-3">
            <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center p-1">
              <img
                src={avatarSeed ? getAvatar(avatarSeed) : getAvatar('default')}
                alt="profile preview"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={randomizeAvatar}
              className="text-xs py-1 h-8 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              Randomise Avatar
            </Button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modalDisplayName" className="text-xs text-muted-foreground">
                Display Name
              </Label>
              <Input
                id="modalDisplayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name..."
                required
                className="text-sm rounded-lg bg-background border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Username (cannot be changed)
              </Label>
              <Input
                value={currentUser?.username || ''}
                disabled
                className="text-sm rounded-lg bg-muted border-border text-muted-foreground opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 text-sm cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !displayName.trim()}
              className="flex-1 text-sm bg-foreground text-background hover:opacity-90 cursor-pointer transition-opacity"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

interface ImageModalProps {
  imageUrl: string | null
  onClose: () => void
}

function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  if (!imageUrl) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/85 backdrop-blur-md z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Image Container */}
      <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] max-w-[90vw] max-h-[85vh] flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-200"
        onClick={onClose}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black/60 hover:bg-black/80 rounded-full p-2.5 transition-colors cursor-pointer shadow-lg hover:scale-105 z-10"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <img
          src={imageUrl}
          alt="Expanded chat preview"
          className="max-w-full max-h-[85vh] rounded-xl object-contain border border-border/40 shadow-2xl select-none"
        />
      </div>
    </>
  )
}

function RouteComponent() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()
  const router = useRouter()
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef<number | null>(null)

  const currentUser = useQuery(api.users.getCurrentUser)
  const messages = useQuery(api.messages.getMessages)
  const sendMessage = useMutation(api.messages.sendMessage)
  const deleteImageAction = useAction(api.cleanup.deleteImage)

  useEffect(() => {
    if (messages !== undefined) {
      const isInitial = prevMessageCountRef.current === null
      
      // Scroll to bottom immediately on initial load, and smoothly on updates
      if (messages.length > 0) {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: isInitial ? 'auto' : 'smooth' 
        })
      }
      
      // Play ping sound if a new message was added after initial load
      if (!isInitial && messages.length > prevMessageCountRef.current!) {
        playPingSound()
      }
      
      prevMessageCountRef.current = messages.length
    }
  }, [messages])

  const handleDeleteImage = async (messageId: any) => {
    if (!confirm('Are you sure you want to delete this image forever? This cannot be undone.')) return
    
    // Optimistically add to deleting list
    setDeletingMessageIds((prev) => {
      const next = new Set(prev)
      next.add(messageId)
      return next
    })

    try {
      await deleteImageAction({ messageId })
    } catch (err) {
      // Rollback on error
      setDeletingMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to delete image')
    }
  }

  const { startUpload, isUploading } = useUploadThing('imageUploader', {
    onClientUploadComplete: (res) => {
      if (res && res[0]) {
        setImageUrl(res[0].ufsUrl || res[0].url)
      }
    },
    onUploadError: (err) => {
      console.error('Upload error', err)
      alert(`Error uploading file: ${err.message}`)
      setLocalPreview(null)
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Header */}
        <header className="border-b border-border px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Skeleton className="h-6 w-32 animate-pulse bg-accent" />
            <Skeleton className="h-4 w-24 animate-pulse bg-accent" />
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <ChatLoadingSkeleton />
        </div>

        {/* Input Bar */}
        <div className="border-t border-border px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-lg animate-pulse bg-accent" />
            <Skeleton className="h-9 flex-1 rounded-lg animate-pulse bg-accent" />
            <Skeleton className="h-9 w-16 rounded-lg animate-pulse bg-accent" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        <p className="font-mono">You need to sign in to access the chat.</p>
        <Button onClick={() => router.navigate({ to: '/signin' })}>
          Sign In
        </Button>
      </div>
    )
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLocalPreview(URL.createObjectURL(file))
    setUploadProgress(0)
    try {
      await startUpload([file], {
        onUploadProgress: (p) => {
          setUploadProgress(p)
        },
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearImage = () => {
    setImageUrl(null)
    setLocalPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() && !imageUrl) return
    await sendMessage({
      body: body.trim() || undefined,
      imageUrl: imageUrl || undefined,
    })
    setBody('')
    setImageUrl(null)
    setLocalPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 relative z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="font-mono text-xl font-bold">Global Chat</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground font-mono">Public Room</span>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-8 h-8 rounded-full overflow-hidden border border-border hover:border-foreground transition-colors cursor-pointer focus:outline-none"
              >
                <img
                  src={currentUser ? getAvatar(currentUser.avatarSeed) : getAvatar('default')}
                  alt="profile"
                  className="w-full h-full object-cover"
                />
              </button>

              {showDropdown && (
                <>
                  {/* Click-outside backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowDropdown(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-popover text-popover-foreground shadow-md py-1 z-20 font-mono text-sm animate-in fade-in slide-in-from-top-1 duration-100">
                    <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground font-semibold truncate">
                      {currentUser?.displayName || currentUser?.name || 'User'}
                    </div>
                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        setIsProfileOpen(true)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      Profile Settings
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        signOut()
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-destructive hover:text-destructive transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages === undefined ? (
            <ChatLoadingSkeleton />
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground font-mono mt-16">No messages yet. Be the first to say something!</p>
          ) : (
            messages.map((msg) => {
              const isMe = currentUser && msg.userId === currentUser._id
              const isDeleting = deletingMessageIds.has(msg._id)
              const isDeletingMessage = isDeleting && !msg.body
              const isDeletingImage = isDeleting

              return (
                <div 
                  key={msg._id} 
                  className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''} ${
                    isDeletingMessage 
                      ? 'opacity-0 scale-95 max-h-0 py-0 my-0 overflow-hidden pointer-events-none transition-all duration-700 ease-in-out' 
                      : 'animate-in fade-in slide-in-from-bottom-2 duration-300 transition-all duration-500'
                  }`}
                  style={{
                    maxHeight: isDeletingMessage ? '0px' : '500px',
                  }}
                >
                  <img
                    src={msg.user ? getAvatar(msg.user.avatarSeed) : getAvatar('default')}
                    alt="avatar"
                    className="w-8 h-8 rounded-full mt-0.5 shrink-0"
                  />
                  <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-sm font-mono font-semibold text-muted-foreground">
                      {isMe ? 'You' : (msg.user?.displayName || msg.user?.name || 'Anonymous')}
                    </span>
                    {msg.body && (
                      <p className={`font-mono text-sm leading-relaxed break-words px-3 py-1.5 rounded-2xl ${
                        isMe 
                          ? 'bg-foreground text-background rounded-tr-none' 
                          : 'bg-card text-foreground border border-border rounded-tl-none'
                      }`}>
                        {msg.body}
                      </p>
                    )}
                    {msg.imageUrl && (
                      <div 
                        className={`relative group mt-1 max-w-sm rounded-lg overflow-hidden border border-border bg-card transition-all duration-500 ease-in-out ${
                          isDeletingImage 
                            ? 'opacity-0 scale-95 max-h-0 my-0 border-0 pointer-events-none' 
                            : ''
                        }`}
                        style={{
                          maxHeight: isDeletingImage ? '0px' : '300px',
                        }}
                      >
                        <div 
                          onClick={() => setSelectedImage(msg.imageUrl)}
                          className="cursor-zoom-in hover:opacity-95 transition-opacity"
                        >
                          <img
                            src={msg.imageUrl}
                            alt="Uploaded chat image"
                            className="w-full h-auto max-h-60 object-cover"
                          />
                        </div>
                        {isMe && !isDeletingImage && (
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(msg._id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 hover:bg-destructive text-white hover:text-white rounded-lg p-1.5 transition-all duration-200 cursor-pointer shadow-md"
                            title="Delete image forever"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              <line x1="10" y1="11" x2="10" y2="17"/>
                              <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="border-t border-border px-4 py-4">
        {localPreview && (
          <div className="max-w-3xl mx-auto mb-3 flex items-center gap-4 p-3 rounded-xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
              <img
                src={localPreview}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                  <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold font-mono text-foreground truncate">
                {fileInputRef.current?.files?.[0]?.name || 'Selected Image'}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {fileInputRef.current?.files?.[0] 
                  ? `${(fileInputRef.current.files[0].size / (1024 * 1024)).toFixed(2)} MB`
                  : ''}
              </p>
              {isUploading && (
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={uploadProgress} className="h-1 flex-1" />
                  <span className="text-[10px] font-mono text-muted-foreground font-semibold shrink-0">
                    {uploadProgress}%
                  </span>
                </div>
              )}
              {!isUploading && imageUrl && (
                <p className="text-[10px] font-mono text-green-500 font-medium mt-1 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Ready to send
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearImage}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg p-1.5 transition-colors cursor-pointer shrink-0"
              title="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="shrink-0 rounded-lg bg-muted text-muted-foreground hover:bg-muted-foreground hover:text-background transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload image"
          >
            {isUploading ? (
              <div className="w-[18px] h-[18px] border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            )}
          </Button>
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg bg-card border-border px-4 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            type="submit"
            disabled={isUploading || (!body.trim() && !imageUrl)}
            className="shrink-0 rounded-lg bg-foreground text-background px-4 py-2 font-mono text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Send
          </Button>
        </form>
      </div>
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
      />
      <ImageModal
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  )
}