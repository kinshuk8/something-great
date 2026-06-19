import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { getAvatar } from '#/lib/avatar'
import { useUploadThing } from '#/lib/uploadthing'
import { Skeleton } from '#/components/ui/skeleton'
import { Progress } from '#/components/ui/progress'
import {
  Globe,
  Lock,
  Plus,
  Search,
  MessageSquare,
  Send,
  UserPlus,
  Settings,
  LogOut,
  ChevronLeft,
  UserX,
  MessageCircle,
  CornerUpLeft,
  X,
  Check,
  User,
  Users,
} from 'lucide-react'

export const Route = createFileRoute('/chat')({
  component: RouteComponent,
})

const playPingSound = () => {
  try {
    const audioCtx = new window.AudioContext()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(650, audioCtx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      1300,
      audioCtx.currentTime + 0.12,
    )

    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.15,
    )

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
          <div
            key={i}
            className={`flex items-start gap-3 ${isRight ? 'flex-row-reverse' : ''}`}
          >
            <Skeleton className="w-8 h-8 rounded-full shrink-0 animate-pulse bg-accent" />
            <div
              className={`flex flex-col gap-2 max-w-[70%] w-full ${isRight ? 'items-end' : 'items-start'}`}
            >
              <Skeleton className="h-4 w-20 rounded animate-pulse bg-accent" />
              <Skeleton
                className={`h-6 rounded-2xl animate-pulse bg-accent ${isRight ? 'w-full rounded-tr-none' : 'w-full rounded-tl-none'}`}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ----------------------------------------------------------------------------
// CROPPING MODAL COMPONENT (Canvas-based)
// ----------------------------------------------------------------------------
interface CropperModalProps {
  isOpen: boolean
  imageSrc: string
  onClose: () => void
  onSave: (croppedBlob: Blob) => void
  isSaving: boolean
}

function CropperModal({
  isOpen,
  imageSrc,
  onClose,
  onSave,
  isSaving,
}: CropperModalProps) {
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [aspect, setAspect] = useState(1.0)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imageSrc) {
      const img = new Image()
      img.src = imageSrc
      img.onload = () => {
        setAspect(img.width / img.height)
      }
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
    }
  }, [imageSrc])

  if (!isOpen) return null

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    setIsDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  const handleSave = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 300
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.src = imageSrc
    img.onload = () => {
      ctx.clearRect(0, 0, 300, 300)

      // Mirror the CSS transforms on the 300x300 canvas
      ctx.translate(150, 150)
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)

      let displayedWidth = 300
      let displayedHeight = 300
      if (aspect > 1) {
        displayedWidth = 300 * aspect
      } else {
        displayedHeight = 300 / aspect
      }

      ctx.drawImage(
        img,
        -displayedWidth / 2,
        -displayedHeight / 2,
        displayedWidth,
        displayedHeight,
      )

      canvas.toBlob(
        (blob) => {
          if (blob) {
            onSave(blob)
          }
        },
        'image/jpeg',
        0.95,
      )
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 font-mono">
      <div className="bg-card border border-border p-6 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Crop Profile Photo</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Box */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-[300px] h-[300px] mx-auto overflow-hidden bg-black rounded-xl select-none cursor-move flex items-center justify-center"
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="To crop"
            style={{
              width: aspect > 1 ? `${300 * aspect}px` : '300px',
              height: aspect > 1 ? '300px' : `${300 / aspect}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: 'none',
              maxHeight: 'none',
            }}
            className="pointer-events-none"
          />
          {/* Radial Gradient overlay to form circle mask */}
          <div
            className="absolute inset-0 pointer-events-none rounded-xl"
            style={{
              background:
                'radial-gradient(circle 125px at center, transparent 99%, rgba(12, 12, 12, 0.75) 100%)',
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Zoom</span>
            <span>{zoom.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-foreground"
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 cursor-pointer bg-foreground text-background"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Uploading...' : 'Save & Upload'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// PROFILE SETTINGS MODAL
// ----------------------------------------------------------------------------
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
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { startUpload: startProfileUpload, isUploading: isUploadingProfile } =
    useUploadThing('imageUploader', {
      onClientUploadComplete: async (res) => {
        if (res[0]) {
          const url = res[0].ufsUrl || res[0].url
          await updateProfile({ image: url })
          setIsCropperOpen(false)
          setCropImageUrl(null)
        }
      },
      onUploadError: (err) => {
        alert(`Upload error: ${err.message}`)
      },
    })

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '')
      setAvatarSeed(currentUser.avatarSeed || '')
    }
  }, [currentUser, isOpen])

  if (!isOpen) return null

  const randomizeAvatar = async () => {
    const randomSeed = Math.random().toString(36).substring(2, 12)
    setAvatarSeed(randomSeed)
    // Clear custom uploaded photo to fall back to dicebear
    await updateProfile({ image: '' })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('Avatar image size must be less than 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCropImageUrl(reader.result as string)
      setIsCropperOpen(true)
    }
    reader.readAsDataURL(file)
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
      alert(
        err instanceof Error ? err.message : 'Failed to save profile settings',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCropSave = (blob: Blob) => {
    const file = new File([blob], 'cropped-profile.jpg', { type: 'image/jpeg' })
    startProfileUpload([file])
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-md z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Profile Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors cursor-pointer"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center p-1">
              <img
                src={
                  currentUser?.image ||
                  (avatarSeed ? getAvatar(avatarSeed) : getAvatar('default'))
                }
                alt="profile preview"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="flex gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={randomizeAvatar}
                className="flex-1 text-xs py-1 h-8 cursor-pointer gap-1"
              >
                Randomise Seed
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 text-xs py-1 h-8 cursor-pointer gap-1"
              >
                Upload Photo
              </Button>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Photos are cropped automatically (&lt; 5MB limit)
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="modalDisplayName"
                className="text-xs text-muted-foreground"
              >
                Display Name
              </Label>
              <Input
                id="modalDisplayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name..."
                required
                className="text-sm rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Username (cannot be changed)
              </Label>
              <Input
                value={currentUser?.username || ''}
                disabled
                className="text-sm rounded-lg bg-muted/50 text-muted-foreground opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

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
              className="flex-1 text-sm bg-foreground text-background hover:opacity-95 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      <CropperModal
        isOpen={isCropperOpen}
        imageSrc={cropImageUrl || ''}
        onClose={() => {
          setIsCropperOpen(false)
          setCropImageUrl(null)
        }}
        onSave={handleCropSave}
        isSaving={isUploadingProfile}
      />
    </>
  )
}

// ----------------------------------------------------------------------------
// IMAGE VIEWER MODAL
// ----------------------------------------------------------------------------
interface ImageModalProps {
  imageUrl: string | null
  onClose: () => void
}

function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  if (!imageUrl) return null
  return (
    <>
      <div
        className="fixed inset-0 bg-background/85 backdrop-blur-md z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] max-w-[90vw] max-h-[85vh] flex flex-col items-center justify-center animate-in zoom-in-95 fade-in duration-200"
        onClick={onClose}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black/60 hover:bg-black/80 rounded-full p-2.5 cursor-pointer shadow-lg z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <img
          src={imageUrl}
          alt="Expanded chat preview"
          className="max-w-full max-h-[85vh] rounded-xl object-contain border border-border shadow-2xl select-none"
        />
      </div>
    </>
  )
}

// ----------------------------------------------------------------------------
// FRIENDS & INVITES DIALOG
// ----------------------------------------------------------------------------
interface FriendsModalProps {
  isOpen: boolean
  onClose: () => void
  friends: any[]
  receivedRequests: any[]
  sentRequests: any[]
  allUsers: any[]
  currentUser: any
  onUserClick: (user: any) => void
}

function FriendsModal({
  isOpen,
  onClose,
  friends,
  receivedRequests,
  sentRequests,
  allUsers,
  currentUser,
  onUserClick,
}: FriendsModalProps) {
  const [activeTab, setActiveTab] = useState<'invites' | 'sent' | 'add'>(
    'invites',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const sendRequest = useMutation(api.friends.sendFriendRequest)
  const respondRequest = useMutation(api.friends.respondToFriendRequest)
  const cancelRequest = useMutation(api.friends.cancelFriendRequest)

  if (!isOpen) return null

  // Filter users that are not already friends/self/pending requests
  const getStrangerUsers = () => {
    return allUsers.filter((u) => {
      if (u._id === currentUser._id) return false

      const isFriend = friends.some((f) => f.friend._id === u._id)
      const hasReceived = receivedRequests.some((r) => r.senderId === u._id)
      const hasSent = sentRequests.some((r) => r.receiverId === u._id)

      return (
        !isFriend &&
        !hasReceived &&
        !hasSent &&
        (u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    })
  }

  const handleSend = async (receiverId: Id<'users'>) => {
    try {
      await sendRequest({ receiverId })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error sending request')
    }
  }

  const handleRespond = async (
    requestId: Id<'friendRequests'>,
    status: 'accepted' | 'declined',
  ) => {
    try {
      await respondRequest({ requestId, status })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error responding')
    }
  }

  const handleCancel = async (requestId: Id<'friendRequests'>) => {
    try {
      await cancelRequest({ requestId })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error cancelling request')
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-md z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono flex flex-col h-[480px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" /> Friends &
            Invites
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-border text-xs mb-4">
          <button
            onClick={() => setActiveTab('invites')}
            className={`flex-1 pb-2 font-semibold border-b-2 cursor-pointer ${activeTab === 'invites' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
          >
            Invites ({receivedRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex-1 pb-2 font-semibold border-b-2 cursor-pointer ${activeTab === 'sent' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
          >
            Sent ({sentRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 pb-2 font-semibold border-b-2 cursor-pointer ${activeTab === 'add' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
          >
            Add Friend
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
          {activeTab === 'invites' &&
            (receivedRequests.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-10">
                No pending invites.
              </p>
            ) : (
              receivedRequests.map((req) => (
                <div
                  key={req._id}
                  className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/40"
                >
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => onUserClick(req.sender)}
                  >
                    <img
                      src={
                        req.sender?.image || getAvatar(req.sender?.avatarSeed)
                      }
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <p className="font-semibold text-xs leading-none">
                        {req.sender?.displayName}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        @{req.sender?.username}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      onClick={() => handleRespond(req._id, 'accepted')}
                      className="px-2 h-7 text-[10px] bg-foreground text-background cursor-pointer"
                    >
                      Accept
                    </Button>
                    <Button
                      onClick={() => handleRespond(req._id, 'declined')}
                      variant="outline"
                      className="px-2 h-7 text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            ))}

          {activeTab === 'sent' &&
            (sentRequests.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-10">
                No sent requests.
              </p>
            ) : (
              sentRequests.map((req) => (
                <div
                  key={req._id}
                  className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/40"
                >
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => onUserClick(req.receiver)}
                  >
                    <img
                      src={
                        req.receiver?.image ||
                        getAvatar(req.receiver?.avatarSeed)
                      }
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <p className="font-semibold text-xs leading-none">
                        {req.receiver?.displayName}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        @{req.receiver?.username}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleCancel(req._id)}
                    variant="outline"
                    className="px-2 h-7 text-[10px] text-muted-foreground cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              ))
            ))}

          {activeTab === 'add' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search usernames..."
                  className="pl-8 text-xs rounded-xl h-8 bg-muted/30 border-border"
                />
              </div>
              <div className="space-y-2">
                {getStrangerUsers().length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-10">
                    No users found.
                  </p>
                ) : (
                  getStrangerUsers().map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/40"
                    >
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => onUserClick(user)}
                      >
                        <img
                          src={user.image || getAvatar(user.avatarSeed)}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-semibold text-xs leading-none">
                            {user.displayName}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            @{user.username}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleSend(user._id)}
                        className="px-2.5 h-7 text-[10px] bg-foreground text-background cursor-pointer flex items-center gap-1"
                      >
                        <UserPlus className="w-3 h-3" /> Add
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ----------------------------------------------------------------------------
// CREATE ROOM MODAL
// ----------------------------------------------------------------------------
interface CreateRoomProps {
  isOpen: boolean
  onClose: () => void
  friends: any[]
  onCreate: (
    name: string,
    password?: string,
    isPrivate?: boolean,
    members?: Id<'users'>[],
  ) => void
}

function CreateRoomModal({
  isOpen,
  onClose,
  friends,
  onCreate,
}: CreateRoomProps) {
  const [name, setName] = useState('')
  const [isSecure, setIsSecure] = useState(false)
  const [password, setPassword] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedFriends, setSelectedFriends] = useState<Set<Id<'users'>>>(
    new Set(),
  )

  if (!isOpen) return null

  const toggleFriend = (id: Id<'users'>) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(
      name.trim(),
      isSecure ? password : undefined,
      isPrivate,
      Array.from(selectedFriends),
    )
    setName('')
    setIsSecure(false)
    setPassword('')
    setIsPrivate(false)
    setSelectedFriends(new Set())
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-md z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 text-muted-foreground" /> Create Chatroom
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="roomName">Room Name</Label>
            <Input
              id="roomName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Secret Hideout"
              required
              className="h-8.5 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/40">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-foreground">
                Password Lock
              </span>
              <span className="text-[10px] text-muted-foreground">
                Require password to join
              </span>
            </div>
            <input
              type="checkbox"
              checked={isSecure}
              onChange={(e) => setIsSecure(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          {isSecure && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-150">
              <Label htmlFor="roomPass">Room Password</Label>
              <Input
                id="roomPass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter room entry password"
                required
                className="h-8.5 rounded-lg font-sans"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/40">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-foreground">
                Private Room
              </span>
              <span className="text-[10px] text-muted-foreground">
                Only invited friends can view/access
              </span>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label>Invite Friends (Optional)</Label>
            {friends.length === 0 ? (
              <p className="text-muted-foreground text-[10px] italic">
                You have no friends to add yet. Send requests first!
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-2 space-y-1 bg-muted/10">
                {friends.map((f) => (
                  <div
                    key={f.friend._id}
                    onClick={() => toggleFriend(f.friend._id)}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-muted/40 cursor-pointer text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={f.friend.image || getAvatar(f.friend.avatarSeed)}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="font-medium">
                        {f.friend.displayName}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedFriends.has(f.friend._id)}
                      onChange={() => {}} // handled by outer click
                      className="w-3.5 h-3.5 pointer-events-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-foreground text-background cursor-pointer"
            >
              Create Room
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

// ----------------------------------------------------------------------------
// JOIN ROOM MODAL
// ----------------------------------------------------------------------------
interface JoinRoomProps {
  isOpen: boolean
  onClose: () => void
  discoverableRooms: any[]
  onJoin: (id: Id<'chatrooms'>, password?: string) => void
}

function JoinRoomModal({
  isOpen,
  onClose,
  discoverableRooms,
  onJoin,
}: JoinRoomProps) {
  const [promptRoom, setPromptRoom] = useState<any | null>(null)
  const [password, setPassword] = useState('')

  if (!isOpen) return null

  const handleRoomClick = (room: any) => {
    if (room.hasPassword) {
      setPromptRoom(room)
      setPassword('')
    } else {
      onJoin(room._id)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!promptRoom) return
    onJoin(promptRoom._id, password)
    setPromptRoom(null)
    setPassword('')
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-md z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono h-[420px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Search className="w-5 h-5 text-muted-foreground" /> Discover & Join
            Rooms
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {promptRoom ? (
          <form
            onSubmit={handlePasswordSubmit}
            className="flex-1 flex flex-col justify-center space-y-4 text-xs animate-in zoom-in-95 duration-150"
          >
            <div className="text-center space-y-1">
              <Lock className="w-8 h-8 text-primary mx-auto" />
              <p className="font-bold text-sm text-foreground">
                Password Required
              </p>
              <p className="text-[10px] text-muted-foreground">
                Enter password to join{' '}
                <span className="font-semibold text-foreground">
                  "{promptRoom.name}"
                </span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="joinRoomPass">Room Password</Label>
              <Input
                id="joinRoomPass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="h-8.5 rounded-lg font-sans"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={() => setPromptRoom(null)}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-foreground text-background cursor-pointer"
              >
                Join Room
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-sm">
            {discoverableRooms.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-16">
                No joinable public rooms available.
              </p>
            ) : (
              discoverableRooms.map((room) => (
                <div
                  key={room._id}
                  onClick={() => handleRoomClick(room)}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-primary/40 cursor-pointer transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground text-xs leading-none flex items-center gap-1.5">
                      {room.name}{' '}
                      {room.hasPassword && (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {room.memberIds.length} member
                      {room.memberIds.length !== 1 && 's'}
                    </span>
                  </div>
                  <Button className="h-6.5 text-[9px] bg-foreground text-background font-bold pointer-events-none">
                    Join
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ----------------------------------------------------------------------------
// USER DETAILS OVERLAY / PROFILE DIALOG
// ----------------------------------------------------------------------------
interface UserDetailsProps {
  user: any | null
  isOpen: boolean
  onClose: () => void
  friends: any[]
  receivedRequests: any[]
  sentRequests: any[]
  currentUser: any
}

function UserDetailsModal({
  user,
  isOpen,
  onClose,
  friends,
  receivedRequests,
  sentRequests,
  currentUser,
}: UserDetailsProps) {
  const sendRequest = useMutation(api.friends.sendFriendRequest)
  const respondRequest = useMutation(api.friends.respondToFriendRequest)
  const cancelRequest = useMutation(api.friends.cancelFriendRequest)
  const unfriend = useMutation(api.friends.unfriend)

  if (!isOpen || !user || !currentUser) return null

  const isMe = user._id === currentUser._id
  const isFriend = friends.some((f) => f.friend._id === user._id)
  const pendingReceived = receivedRequests.find((r) => r.senderId === user._id)
  const pendingSent = sentRequests.find((r) => r.receiverId === user._id)

  const handleAction = async () => {
    try {
      if (isFriend) {
        if (confirm(`Are you sure you want to unfriend ${user.displayName}?`)) {
          await unfriend({ friendId: user._id })
        }
      } else if (pendingReceived) {
        await respondRequest({
          requestId: pendingReceived._id,
          status: 'accepted',
        })
      } else if (pendingSent) {
        await cancelRequest({ requestId: pendingSent._id })
      } else {
        await sendRequest({ receiverId: user._id })
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed')
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-full max-w-xs shadow-2xl z-[60] animate-in zoom-in-95 fade-in duration-200 font-mono text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-3 mt-2">
          <img
            src={user.image || getAvatar(user.avatarSeed)}
            alt="avatar"
            className="w-16 h-16 rounded-full border border-border/80 object-cover"
          />
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm text-foreground leading-none">
              {user.displayName}
            </h4>
            <p className="text-[10px] text-muted-foreground">
              @{user.username}
            </p>
          </div>

          <div className="pt-2 w-full">
            {isMe ? (
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-semibold">
                This is you
              </span>
            ) : (
              <Button
                onClick={handleAction}
                className={`w-full py-1.5 h-8 text-xs cursor-pointer ${
                  isFriend
                    ? 'bg-muted border border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                    : 'bg-foreground text-background'
                }`}
              >
                {isFriend && 'Unfriend'}
                {pendingReceived && 'Accept Request'}
                {pendingSent && 'Cancel Sent Request'}
                {!isFriend &&
                  !pendingReceived &&
                  !pendingSent &&
                  'Send Friend Request'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ----------------------------------------------------------------------------
// MAIN CHAT PAGE ROUTE COMPONENT
// ----------------------------------------------------------------------------
function RouteComponent() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()
  const router = useRouter()

  // State for rooms, active room, replies, mentions
  const [activeRoomId, setActiveRoomId] = useState<Id<'chatrooms'> | null>(null)
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [showDropdown, setShowDropdown] = useState(false)

  // Modal toggle states
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isFriendsOpen, setIsFriendsOpen] = useState(false)
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false)
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false)

  // Zoom crop and details modals state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<
    any | null
  >(null)
  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(
    new Set(),
  )
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null)

  // Mobile UI state
  const [mobileShowChat, setMobileShowChat] = useState(false)

  // Refs for tracking drag swipe and scroll
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null)
  const [swipeDistance, setSwipeDistance] = useState<number>(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // DB queries and mutations
  const currentUser = useQuery(api.users.getCurrentUser)
  const messages = useQuery(api.messages.getMessages, {
    chatroomId: activeRoomId,
  })
  const chatrooms = useQuery(api.chatrooms.getChatrooms)
  const discoverableRooms = useQuery(api.chatrooms.getDiscoverableChatrooms)
  const friends = useQuery(api.friends.getFriends)
  const receivedRequests = useQuery(api.friends.getFriendRequests)
  const sentRequests = useQuery(api.friends.getSentRequests)
  const allUsers = useQuery(api.users.listAllUsers)

  const sendMessage = useMutation(api.messages.sendMessage)
  const createRoom = useMutation(api.chatrooms.createChatroom)
  const joinRoom = useMutation(api.chatrooms.joinChatroom)
  const checkOrCreateDM = useMutation(api.chatrooms.checkOrCreateDM)
  const deleteImageAction = useAction(api.cleanup.deleteImage)

  useEffect(() => {
    if (messages !== undefined) {
      const isInitial = prevMessageCountRef.current === null
      if (messages.length > 0) {
        messagesEndRef.current?.scrollIntoView({
          behavior: isInitial ? 'auto' : 'smooth',
        })
      }
      if (!isInitial && messages.length > prevMessageCountRef.current!) {
        playPingSound()
      }
      prevMessageCountRef.current = messages.length
    }
  }, [messages])

  // Active chat metadata
  const activeRoom = chatrooms?.find((r: any) => r._id === activeRoomId)
  const chatTitle =
    activeRoomId === null
      ? 'Global Chat'
      : activeRoom?.name || 'Loading Chat...'
  const chatDescription =
    activeRoomId === null
      ? 'Public room for everyone'
      : activeRoom?.isDM
        ? 'Direct Message'
        : 'Private Room'

  const handleDeleteImage = async (messageId: any) => {
    if (
      !confirm(
        'Are you sure you want to delete this image forever? This cannot be undone.',
      )
    )
      return

    setDeletingMessageIds((prev) => {
      const next = new Set(prev)
      next.add(messageId)
      return next
    })

    try {
      await deleteImageAction({ messageId })
    } catch (err) {
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
      if (res[0]) {
        setImageUrl(res[0].ufsUrl || res[0].url)
      }
    },
    onUploadError: (err) => {
      alert(`Error uploading file: ${err.message}`)
      setLocalPreview(null)
    },
    onUploadProgress: (p: number) => {
      setUploadProgress(p)
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="border-b border-border px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Skeleton className="h-6 w-32 bg-accent animate-pulse" />
            <Skeleton className="h-4 w-24 bg-accent animate-pulse" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <ChatLoadingSkeleton />
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
      await startUpload([file])
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearImage = () => {
    setImageUrl(null)
    setLocalPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ----------------------------------------------------------------------------
  // SWIPE-TO-REPLY TOUCH HANDLERS
  // ----------------------------------------------------------------------------
  const handleTouchStart = (e: React.TouchEvent, msgId: string) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    setSwipingMessageId(msgId)
    setSwipeDistance(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !swipingMessageId) return
    const t = e.touches[0]
    const deltaX = t.clientX - touchStartRef.current.x
    const deltaY = t.clientY - touchStartRef.current.y

    // Only register right swipe if it is mostly horizontal
    if (deltaX > 0 && Math.abs(deltaY) < 30) {
      setSwipeDistance(Math.min(deltaX, 70))
    }
  }

  const handleTouchEnd = (msg: any) => {
    if (swipeDistance > 55) {
      setReplyingToMessage(msg)
      playPingSound()
    }
    touchStartRef.current = null
    setSwipingMessageId(null)
    setSwipeDistance(0)
  }

  // ----------------------------------------------------------------------------
  // USER MENTIONS AUTOCOMPLETE LOGIC
  // ----------------------------------------------------------------------------
  const getMentionQuery = (text: string) => {
    const lastIndex = text.lastIndexOf('@')
    if (lastIndex === -1) return null

    const charBefore = lastIndex > 0 ? text[lastIndex - 1] : ' '
    if (charBefore !== ' ' && charBefore !== '\n') return null

    const queryText = text.substring(lastIndex + 1)
    if (queryText.includes(' ')) return null

    return queryText
  }

  const mentionQuery = getMentionQuery(body)
  const filteredUsers =
    mentionQuery !== null && allUsers
      ? allUsers
          .filter(
            (u) =>
              u._id !== currentUser?._id &&
              (u.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
                u.displayName
                  .toLowerCase()
                  .includes(mentionQuery.toLowerCase())),
          )
          .slice(0, 5)
      : []

  const selectMention = (username: string) => {
    const lastIndex = body.lastIndexOf('@')
    const prefix = body.substring(0, lastIndex)
    setBody(prefix + '@' + username + ' ')
    inputRef.current?.focus()
  }

  // ----------------------------------------------------------------------------
  // RENDER BODY WITH INTERACTIVE MENTION BADGES
  // ----------------------------------------------------------------------------
  const renderBodyWithMentions = (text: string | undefined) => {
    if (!text) return null
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1)
        const matched = allUsers?.find((u) => u.username === username)
        if (matched) {
          return (
            <span
              key={index}
              onClick={() => setSelectedUserForDetails(matched)}
              className="bg-primary/20 text-foreground font-semibold px-1 py-0.5 rounded cursor-pointer hover:bg-primary/45 border border-primary/25 transition-all text-xs"
            >
              {part}
            </span>
          )
        }
      }
      return part
    })
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() && !imageUrl) return

    // Collect mention IDs
    const mentions: Id<'users'>[] = []
    if (allUsers) {
      allUsers.forEach((user) => {
        if (
          body.includes(`@${user.username}`) &&
          !mentions.includes(user._id)
        ) {
          mentions.push(user._id)
        }
      })
    }

    await sendMessage({
      body: body.trim() || undefined,
      imageUrl: imageUrl || undefined,
      chatroomId: activeRoomId,
      replyToId: replyingToMessage?._id,
      mentions: mentions.length > 0 ? mentions : undefined,
    })

    setBody('')
    setImageUrl(null)
    setLocalPreview(null)
    setReplyingToMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCreateRoom = async (
    name: string,
    password?: string,
    isPrivate?: boolean,
    members?: Id<'users'>[],
  ) => {
    try {
      const id = await createRoom({
        name,
        password,
        isPrivate: isPrivate || false,
        initialMembers: members,
      })
      setActiveRoomId(id)
      setIsCreateRoomOpen(false)
      setMobileShowChat(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error creating room')
    }
  }

  const handleJoinRoom = async (id: Id<'chatrooms'>, password?: string) => {
    try {
      await joinRoom({ chatroomId: id, password })
      setActiveRoomId(id)
      setIsJoinRoomOpen(false)
      setMobileShowChat(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to join room')
    }
  }

  const handleFriendClick = async (friendId: Id<'users'>) => {
    try {
      const dmId = await checkOrCreateDM({ friendId })
      setActiveRoomId(dmId)
      setMobileShowChat(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error opening DM')
    }
  }

  return (
    <div className="h-[100dvh] bg-background text-foreground flex overflow-hidden font-mono">
      {/* ----------------------------------------------------------------------
          SIDEBAR UI
          ---------------------------------------------------------------------- */}
      <aside
        className={`w-full md:w-[280px] shrink-0 border-r border-border bg-card/45 flex flex-col h-full z-30 transition-all duration-300 ${
          mobileShowChat
            ? 'max-md:-translate-x-full absolute md:relative'
            : 'relative'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/80 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">
            Something Great
          </h2>

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-8 h-8 rounded-full overflow-hidden border border-border hover:border-foreground transition-colors cursor-pointer"
            >
              <img
                src={
                  currentUser?.image ||
                  (currentUser
                    ? getAvatar(currentUser.avatarSeed)
                    : getAvatar('default'))
                }
                alt="profile"
                className="w-full h-full object-cover"
              />
            </button>
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl py-1.5 z-20 text-xs animate-in fade-in duration-100">
                  <div className="px-3 py-2 border-b border-border text-[10px] text-muted-foreground font-semibold truncate flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />{' '}
                    {currentUser?.displayName || 'User'}
                  </div>
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      setIsProfileOpen(true)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent cursor-pointer flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" /> Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      signOut()
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-destructive cursor-pointer flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sidebar Nav (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Main Chats list */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setActiveRoomId(null)
                setMobileShowChat(true)
              }}
              className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs transition-colors cursor-pointer ${
                activeRoomId === null
                  ? 'bg-primary/20 font-bold border border-primary/20'
                  : 'hover:bg-muted/40 border border-transparent'
              }`}
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span>Global Chat</span>
            </button>

            {/* Friends Invites & Requests panel */}
            <button
              onClick={() => setIsFriendsOpen(true)}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-muted/40 flex items-center justify-between text-xs transition-colors cursor-pointer border border-transparent relative"
            >
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                <span>Friends & Requests</span>
              </div>
              {receivedRequests && receivedRequests.length > 0 && (
                <span className="bg-red-500 text-white font-sans text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full animate-pulse font-bold">
                  {receivedRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Chatrooms Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              <span>Rooms</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsJoinRoomOpen(true)}
                  className="hover:text-foreground cursor-pointer"
                  title="Find Room"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsCreateRoomOpen(true)}
                  className="hover:text-foreground cursor-pointer"
                  title="Create Room"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              {chatrooms === undefined ? (
                <Skeleton className="h-6 w-full rounded bg-accent/20" />
              ) : (chatrooms as any[]).filter((r: any) => !r.isDM).length ===
                0 ? (
                <p className="text-[10px] text-muted-foreground italic px-2 py-1">
                  No rooms joined yet.
                </p>
              ) : (
                (chatrooms as any[])
                  .filter((r: any) => !r.isDM)
                  .sort(
                    (a: any, b: any) =>
                      (b.lastMessageAt || 0) - (a.lastMessageAt || 0),
                  )
                  .map((room: any) => (
                    <button
                      key={room._id}
                      onClick={() => {
                        setActiveRoomId(room._id)
                        setMobileShowChat(true)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        activeRoomId === room._id
                          ? 'bg-primary/20 font-bold border border-primary/20'
                          : 'hover:bg-muted/40 border border-transparent'
                      }`}
                    >
                      <span className="truncate flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />{' '}
                        {room.name}
                      </span>
                      {room.hasPassword && (
                        <Lock className="w-3 h-3 text-muted-foreground/60" />
                      )}
                    </button>
                  ))
              )}
            </div>
          </div>

          {/* Recently Texted / Friends DM Section */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Recently Texted
            </div>

            <div className="space-y-0.5">
              {chatrooms === undefined ? (
                <Skeleton className="h-6 w-full rounded bg-accent/20" />
              ) : (chatrooms as any[]).filter((r: any) => r.isDM).length ===
                0 ? (
                <p className="text-[10px] text-muted-foreground italic px-2 py-1">
                  No recent messages.
                </p>
              ) : (
                (chatrooms as any[])
                  .filter((r: any) => r.isDM)
                  .sort(
                    (a: any, b: any) =>
                      (b.lastMessageAt || 0) - (a.lastMessageAt || 0),
                  )
                  .map((room: any) => (
                    <button
                      key={room._id}
                      onClick={() => {
                        setActiveRoomId(room._id)
                        setMobileShowChat(true)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs transition-colors cursor-pointer ${
                        activeRoomId === room._id
                          ? 'bg-primary/20 font-bold border border-primary/20'
                          : 'hover:bg-muted/40 border border-transparent'
                      }`}
                    >
                      <img
                        src={
                          room.otherUser?.image ||
                          getAvatar(room.otherUser?.avatarSeed || 'default')
                        }
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                      <span className="truncate">{room.name}</span>
                    </button>
                  ))
              )}
            </div>
          </div>

          {/* Direct Friends List */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Friends List
            </div>
            <div className="space-y-0.5">
              {friends === undefined ? (
                <Skeleton className="h-6 w-full rounded bg-accent/20" />
              ) : friends.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic px-2 py-1">
                  No friends added.
                </p>
              ) : (
                (friends as any[]).map((f: any) => (
                  <button
                    key={f.friend._id}
                    onClick={() => handleFriendClick(f.friend._id)}
                    className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-muted/40 flex items-center gap-2.5 text-xs transition-colors cursor-pointer"
                  >
                    <img
                      src={f.friend.image || getAvatar(f.friend.avatarSeed)}
                      className="w-5 h-5 rounded-full object-cover shrink-0"
                    />
                    <div className="truncate flex-1">
                      <p className="font-semibold leading-none">
                        {f.friend.displayName}
                      </p>
                      <span className="text-[9px] text-muted-foreground">
                        @{f.friend.username}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ----------------------------------------------------------------------
          ACTIVE CHAT CONTAINER
          ---------------------------------------------------------------------- */}
      <main
        className={`flex-1 flex flex-col h-full bg-background transition-all duration-300 relative ${
          !mobileShowChat
            ? 'max-md:translate-x-full absolute md:relative'
            : 'relative w-full'
        }`}
      >
        {/* Chat Header */}
        <header className="border-b border-border/80 px-6 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileShowChat(false)}
              className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-bold flex items-center gap-1.5">
                {activeRoomId === null ? (
                  <Globe className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                )}
                {chatTitle}
              </h1>
              <p className="text-[10px] text-muted-foreground leading-none">
                {chatDescription}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            {activeRoomId === null
              ? 'Public Channel'
              : activeRoom?.isPrivate
                ? 'Private Room'
                : 'Public Room'}
          </div>
        </header>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4 relative">
            {messages === undefined ? (
              <ChatLoadingSkeleton />
            ) : messages.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-16">
                No messages yet. Be the first to say hello!
              </p>
            ) : (
              messages.map((msg) => {
                const isMe = currentUser && msg.userId === currentUser._id
                const isDeleting = deletingMessageIds.has(msg._id)
                const isDeletingMessage = isDeleting && !msg.body
                const isDeletingImage = isDeleting

                return (
                  <div
                    key={msg._id}
                    id={`msg-${msg._id}`}
                    onTouchStart={(e) => handleTouchStart(e, msg._id)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={() => handleTouchEnd(msg)}
                    className={`flex items-start gap-2.5 relative group transition-all duration-300 ${isMe ? 'flex-row-reverse' : ''} ${
                      isDeletingMessage
                        ? 'opacity-0 scale-95 max-h-0 py-0 overflow-hidden pointer-events-none'
                        : 'animate-in fade-in slide-in-from-bottom-2'
                    }`}
                  >
                    {/* Swipe Reply Icon Indicator (revealed behind swipe) */}
                    {swipingMessageId === msg._id && swipeDistance > 15 && (
                      <div
                        className={`absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 rounded-full transition-all duration-150 ${
                          swipeDistance > 55
                            ? 'bg-primary text-primary-foreground scale-110'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </div>
                    )}

                    {/* Sender Avatar */}
                    <img
                      src={
                        msg.user?.image ||
                        getAvatar(msg.user?.avatarSeed || 'default')
                      }
                      alt="avatar"
                      onClick={() =>
                        msg.user && setSelectedUserForDetails(msg.user)
                      }
                      className="w-8 h-8 rounded-full mt-0.5 shrink-0 cursor-pointer object-cover border border-border/60 hover:scale-105 transition-transform"
                    />

                    {/* Message Bubble Column */}
                    <div
                      style={{
                        transform:
                          swipingMessageId === msg._id
                            ? `translateX(${swipeDistance}px)`
                            : 'none',
                        transition:
                          swipingMessageId === msg._id
                            ? 'none'
                            : 'transform 200ms ease-out',
                      }}
                      className={`flex flex-col gap-0.5 max-w-[70%] relative ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      {/* Replied-to Reference Line */}
                      {msg.repliedTo && (
                        <div
                          onClick={() => {
                            const el = document.getElementById(
                              `msg-${msg.replyToId}`,
                            )
                            el?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            })
                            el?.classList.add('bg-primary/10')
                            setTimeout(
                              () => el?.classList.remove('bg-primary/10'),
                              1500,
                            )
                          }}
                          className="text-[10px] text-muted-foreground bg-muted/30 hover:bg-muted/50 px-2 py-0.5 rounded-t-xl rounded-br-xl border-l-2 border-primary/50 cursor-pointer truncate max-w-full select-none"
                        >
                          <span className="font-semibold">
                            @{msg.repliedTo.user?.username || 'user'}:
                          </span>{' '}
                          {msg.repliedTo.body || 'Image'}
                        </div>
                      )}

                      {/* Bubble Text */}
                      {msg.body && (
                        <p
                          className={`text-xs leading-relaxed break-words px-3 py-2 rounded-2xl ${
                            isMe
                              ? 'bg-foreground text-background rounded-tr-none'
                              : 'bg-card text-foreground border border-border/80 rounded-tl-none'
                          }`}
                        >
                          {renderBodyWithMentions(msg.body)}
                        </p>
                      )}

                      {/* Bubble Image */}
                      {msg.imageUrl && (
                        <div
                          className={`relative group mt-1 max-w-xs rounded-xl overflow-hidden border border-border bg-card transition-all duration-300 ${
                            isDeletingImage ? 'opacity-0 scale-95' : ''
                          }`}
                        >
                          <div
                            onClick={() =>
                              setSelectedImage(msg.imageUrl || null)
                            }
                            className="cursor-zoom-in hover:opacity-95 transition-opacity"
                          >
                            <img
                              src={msg.imageUrl}
                              alt="Uploaded chat image"
                              className="w-full h-auto max-h-56 object-cover"
                            />
                          </div>
                          {isMe && !isDeletingImage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteImage(msg._id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 hover:bg-destructive text-white rounded-lg p-1.5 transition-all cursor-pointer shadow-md"
                              title="Delete image forever"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Meta/Sender Label */}
                      <span className="text-[9px] font-semibold text-muted-foreground mt-0.5 px-1">
                        {isMe ? 'You' : msg.user?.displayName || 'Anonymous'}
                      </span>
                    </div>

                    {/* Hover Reply Button (Desktop) */}
                    <button
                      onClick={() => setReplyingToMessage(msg)}
                      className={`hidden md:block opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground cursor-pointer shadow-sm ${
                        isMe ? '-left-8' : '-right-8'
                      }`}
                      title="Reply"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Form Area */}
        <div className="border-t border-border/80 p-4">
          {/* File Upload Preview Panel */}
          {localPreview && (
            <div className="max-w-3xl mx-auto mb-3 flex items-center gap-3 p-3 rounded-xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                <p className="text-xs font-semibold truncate">
                  {fileInputRef.current?.files?.[0]?.name || 'Selected Image'}
                </p>
                {isUploading && (
                  <div className="flex items-center gap-2 mt-2">
                    <Progress
                      value={uploadProgress}
                      className="h-1 flex-1 animate-pulse"
                    />
                    <span className="text-[9px] text-muted-foreground font-bold shrink-0">
                      {uploadProgress}%
                    </span>
                  </div>
                )}
                {!isUploading && imageUrl && (
                  <p className="text-[10px] text-green-500 font-bold mt-1 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Ready to send
                  </p>
                )}
              </div>
              <button
                onClick={handleClearImage}
                className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Replying Preview Line */}
          {replyingToMessage && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-[10px] text-muted-foreground animate-in slide-in-from-bottom-1 duration-150">
              <div className="flex items-center gap-2 truncate">
                <CornerUpLeft className="w-3 h-3 text-primary" />
                <span>
                  Replying to{' '}
                  <span className="text-foreground font-bold">
                    @{replyingToMessage.user?.username}
                  </span>
                </span>
                <span className="truncate italic">
                  "{replyingToMessage.body || 'Image'}"
                </span>
              </div>
              <button
                onClick={() => setReplyingToMessage(null)}
                className="hover:text-destructive cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Core Send Form */}
          <form
            onSubmit={handleSend}
            className="max-w-3xl mx-auto flex items-center gap-2 relative"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Mention Suggestions Popover */}
            {filteredUsers.length > 0 && (
              <div className="absolute bottom-full left-10 mb-2 w-60 rounded-xl border border-border bg-card shadow-2xl p-1 z-30 font-mono text-xs max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-150">
                <div className="px-2 py-1 text-[9px] text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/60 mb-1">
                  Tag User
                </div>
                {filteredUsers.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => selectMention(user.username)}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <img
                      src={user.image || getAvatar(user.avatarSeed)}
                      className="w-5 h-5 rounded-full object-cover shrink-0"
                    />
                    <div className="truncate flex-1">
                      <span className="font-semibold text-foreground">
                        {user.displayName}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        @{user.username}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="outline"
              className="shrink-0 rounded-xl bg-card border-border/80 text-muted-foreground hover:text-foreground cursor-pointer h-9 w-9 flex items-center justify-center p-0"
              title="Upload image"
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>

            <Input
              ref={inputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type message (@username to tag)..."
              className="flex-1 rounded-xl bg-card border-border/80 h-9 px-4 py-2 font-mono text-xs focus:ring-1 focus:ring-ring"
            />

            <Button
              type="submit"
              disabled={isUploading || (!body.trim() && !imageUrl)}
              className="shrink-0 rounded-xl bg-foreground text-background px-4 py-2 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5 h-9"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </Button>
          </form>
        </div>
      </main>

      {/* ----------------------------------------------------------------------
          MODALS & OVERLAYS
          ---------------------------------------------------------------------- */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
      />
      <ImageModal
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
      <FriendsModal
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        friends={friends || []}
        receivedRequests={receivedRequests || []}
        sentRequests={sentRequests || []}
        allUsers={allUsers || []}
        currentUser={currentUser}
        onUserClick={(user) => {
          setIsFriendsOpen(false)
          setSelectedUserForDetails(user)
        }}
      />
      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
        friends={friends || []}
        onCreate={handleCreateRoom}
      />
      <JoinRoomModal
        isOpen={isJoinRoomOpen}
        onClose={() => setIsJoinRoomOpen(false)}
        discoverableRooms={discoverableRooms || []}
        onJoin={handleJoinRoom}
      />
      <UserDetailsModal
        user={selectedUserForDetails}
        isOpen={selectedUserForDetails !== null}
        onClose={() => setSelectedUserForDetails(null)}
        friends={friends || []}
        receivedRequests={receivedRequests || []}
        sentRequests={sentRequests || []}
        currentUser={currentUser}
      />
    </div>
  )
}
