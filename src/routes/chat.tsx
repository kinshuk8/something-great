import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useAction, useConvex } from 'convex/react'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import {
  generateIdentityKeyPair,
  exportKey,
  importPublicKey,
  importPrivateKey,
  importRawRoomKey,
  exportRawRoomKey,
  generateRoomKey,
  deriveSharedSecret,
  encryptText,
  decryptText,
  encryptFile,
  encryptPrivateKeyBackup,
  decryptPrivateKeyBackup,
  base64ToArrayBuffer,
  arrayBufferToBase64,
  decryptFile,
} from '../lib/crypto'
import { EncryptedImage } from '#/components/EncryptedImage'
import { DecryptedText, DecryptedTextInline } from '#/components/DecryptedText'
import { VoiceMessagePlayer } from '#/components/VoiceMessagePlayer'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { AlertProvider, useAlert } from '#/components/ui/use-alert'
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
  Camera,
  Search,
  MessageSquare,
  Send,
  UserPlus,
  Settings,
  LogOut,
  ChevronLeft,
  Trash2,
  Clock,
  MessageCircle,
  CornerUpLeft,
  X,
  Check,
  CheckCheck,
  Mic,
  Loader2,
  User,
  Users,
  Share,
  Images,
  Download,
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
    <div className="max-w-4xl mx-auto space-y-3">
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
  const { showAlert } = useAlert()
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
        showAlert({ title: 'Upload Error', description: err.message })
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
      showAlert({ title: 'File Too Large', description: 'Avatar image size must be less than 5MB.' })
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
      showAlert({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save profile settings',
      })
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

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-[92vw] sm:w-full sm:max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono">
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
// IMAGE VIEWER MODAL (Premium Lightbox)
// ----------------------------------------------------------------------------
interface ImageModalProps {
  imageUrl: string | null
  imageIv: string | null
  aesKey: CryptoKey | null
  onClose: () => void
}

function ImageModal({ imageUrl, imageIv, aesKey, onClose }: ImageModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!imageUrl) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imageUrl, onClose])

  if (!imageUrl) return null

  const isGif = !imageIv

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Lightbox container */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8"
        onClick={onClose}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 cursor-pointer shadow-lg z-10 backdrop-blur-sm border border-white/10 transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Download button (plain / GIF images only) */}
        {isGif && (
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-16 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 cursor-pointer shadow-lg z-10 backdrop-blur-sm border border-white/10 transition-all duration-200"
          >
            <Download className="w-5 h-5" />
          </a>
        )}

        {/* Image wrapper — stops click propagation so only backdrop closes */}
        <div
          className="relative max-w-[92vw] max-h-[88vh] animate-in zoom-in-95 fade-in duration-300"
          onClick={(e) => e.stopPropagation()}
          style={{ filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.08))' }}
        >
          {/* Glow ring */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/20 via-white/5 to-white/10 pointer-events-none" />

          {imageIv && aesKey ? (
            <EncryptedImage
              imageUrl={imageUrl}
              imageIv={imageIv}
              aesKey={aesKey}
              alt="Expanded chat image"
              className="max-w-full max-h-[88vh] rounded-2xl object-contain select-none ring-1 ring-white/20 shadow-2xl"
            />
          ) : (
            <img
              src={imageUrl}
              alt="Expanded chat image"
              className="max-w-full max-h-[88vh] rounded-2xl object-contain select-none ring-1 ring-white/20 shadow-2xl"
            />
          )}
        </div>
      </div>
    </>
  )
}

// EXPLORE VIEW — image feed displayed in main area
// ----------------------------------------------------------------------------
interface ExploreImageProps {
  msg: any
  room: any
  currentUser: any
  myKeys: any
  onImageClick: (url: string, iv?: string) => void
}

function ExploreImage({
  msg,
  room,
  currentUser,
  myKeys,
  onImageClick,
}: ExploreImageProps) {
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null)

  // Query room key record if private
  const myRoomKeyRecord = useQuery(
    api.keys.getRoomKey,
    room && room.isPrivate && msg.chatroomId ? { chatroomId: msg.chatroomId } : 'skip',
  )

  // Query target public key if DM or private
  const targetUserPublicKeyJwk = useQuery(
    api.keys.getUserPublicKey,
    room && (room.isDM || room.isPrivate)
      ? {
          userId: room.isDM
            ? room.memberIds.find((id: any) => id !== currentUser?._id)!
            : room.ownerId,
        }
      : 'skip',
  )

  useEffect(() => {
    let active = true
    const deriveKey = async () => {
      if (!room || !myKeys) {
        setAesKey(null)
        return
      }

      try {
        if (room.isDM) {
          if (!targetUserPublicKeyJwk) {
            setAesKey(null)
            return
          }
          const theirPubKey = await importPublicKey(targetUserPublicKeyJwk)
          const sharedSecret = await deriveSharedSecret(
            myKeys.privateKey,
            theirPubKey,
          )
          if (active) {
            setAesKey(sharedSecret)
          }
        } else if (room.isPrivate) {
          if (!myRoomKeyRecord || !targetUserPublicKeyJwk) {
            setAesKey(null)
            return
          }
          const ownerPubKey = await importPublicKey(targetUserPublicKeyJwk)
          const sharedSecretWithCreator = await deriveSharedSecret(
            myKeys.privateKey,
            ownerPubKey,
          )
          const rawKeyBase64 = await decryptText(
            myRoomKeyRecord.encryptedKey,
            myRoomKeyRecord.iv,
            sharedSecretWithCreator,
          )
          const roomAesKey = await importRawRoomKey(
            base64ToArrayBuffer(rawKeyBase64),
          )
          if (active) {
            setAesKey(roomAesKey)
          }
        } else {
          setAesKey(null)
        }
      } catch (err) {
        console.error('Error deriving key for Explore image:', err)
        if (active) {
          setAesKey(null)
        }
      }
    }

    deriveKey()
    return () => {
      active = false
    }
  }, [room, myKeys, targetUserPublicKeyJwk, myRoomKeyRecord])

  const isEncrypted = msg.imageIv && (room?.isDM || room?.isPrivate)

  return (
    <div
      className="relative group rounded-xl overflow-hidden border border-border bg-card cursor-zoom-in hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-md"
      onClick={() => onImageClick(msg.imageUrl, msg.imageIv)}
    >
      {isEncrypted ? (
        aesKey ? (
          <EncryptedImage
            imageUrl={msg.imageUrl}
            imageIv={msg.imageIv}
            aesKey={aesKey}
            alt="Shared image"
            className="w-full h-auto max-h-72 object-contain"
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center bg-muted/40 text-muted-foreground text-xs animate-pulse">
            Decrypting...
          </div>
        )
      ) : (
        <img
          src={msg.imageUrl}
          alt="Shared image"
          className="w-full h-auto max-h-72 object-contain"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
    </div>
  )
}

interface ExploreViewProps {
  exploreMessages: any[] | undefined
  chatrooms: any[] | undefined
  currentUser: any
  myKeys: any
  onImageClick: (url: string, iv?: string) => void
  onGoBack: () => void
}

function ExploreView({
  exploreMessages,
  chatrooms,
  currentUser,
  myKeys,
  onImageClick,
  onGoBack,
}: ExploreViewProps) {
  const imageMessages = (exploreMessages ?? []).filter(
    (m) =>
      m.imageUrl &&
      !m.isDeleted &&
      m.imageDeletedReason !== 'expired' &&
      !m.imageUrl.includes('giphy.com'),
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-border/80 px-4 py-2 md:py-2.5 flex items-center gap-3 z-20 shrink-0">
        <button
          type="button"
          onClick={onGoBack}
          className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold flex items-center gap-1.5">
            <Images className="w-4 h-4 text-muted-foreground shrink-0" />
            Explore
          </h1>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            {imageMessages.length > 0
              ? `${imageMessages.length} photo${imageMessages.length !== 1 ? 's' : ''} shared`
              : 'All shared images'}
          </p>
        </div>
      </header>

      {/* Image feed — styled just like the message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-4xl mx-auto space-y-2">
          {imageMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 rounded-3xl bg-muted/60 border border-border/50 flex items-center justify-center">
                <Images className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">No photos yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Images shared will appear here</p>
              </div>
            </div>
          ) : (
            imageMessages.map((msg) => {
              const room = chatrooms?.find((r: any) => r._id === msg.chatroomId)
              return (
                <div
                  key={msg._id}
                  className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2"
                >
                  {/* Avatar */}
                  <img
                    src={msg.user?.image || getAvatar(msg.user?.avatarSeed || 'default')}
                    alt="avatar"
                    className="w-8 h-8 rounded-full mt-0.5 shrink-0 object-cover border border-border/60"
                  />

                  {/* Image bubble */}
                  <div className="flex flex-col gap-0.5 max-w-xs md:max-w-sm">
                    {/* Sender + room chip */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{msg.user?.displayName || 'Unknown'}</span>
                      {room ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/15 font-mono">
                          {room.name}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted border border-border/50 text-muted-foreground font-mono">
                          Global
                        </span>
                      )}
                    </div>

                    <ExploreImage
                      msg={msg}
                      room={room}
                      currentUser={currentUser}
                      myKeys={myKeys}
                      onImageClick={onImageClick}
                    />

                    {/* Timestamp */}
                    <span className="text-[9px] text-muted-foreground px-1">
                      {new Date(msg.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

interface BackupSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSetup: (passphrase: string) => Promise<void>
  loading: boolean
  error: string | null
}

function BackupSetupModal({
  isOpen,
  onClose,
  onSetup,
  loading,
  error,
}: BackupSetupModalProps) {
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (!passphrase.trim()) {
      setLocalError('Passphrase cannot be empty')
      return
    }
    if (passphrase !== confirmPassphrase) {
      setLocalError('Passphrases do not match')
      return
    }
    try {
      await onSetup(passphrase)
      setPassphrase('')
      setConfirmPassphrase('')
    } catch (err) {
      // handled by parent
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-md z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-[92vw] sm:w-full sm:max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Setup Key Backup
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors cursor-pointer"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground mb-4 leading-normal">
          Your chat messages and images are end-to-end encrypted. Create a
          backup passphrase to secure your private keys. This allows you to
          restore your chat history when logging in from other devices.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px]">Passphrase</Label>
            <Input
              type="password"
              placeholder="Enter secure passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="text-xs h-9 bg-card border-border rounded-xl focus:border-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px]">Confirm Passphrase</Label>
            <Input
              type="password"
              placeholder="Confirm passphrase"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              className="text-xs h-9 bg-card border-border rounded-xl focus:border-foreground"
            />
          </div>

          {(error || localError) && (
            <div className="text-red-500 text-[10px] bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
              {localError || error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs h-9 px-4 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="text-xs h-9 px-4 rounded-xl cursor-pointer bg-foreground text-background"
            >
              {loading ? 'Creating Backup...' : 'Save Backup'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

interface BackupRestoreModalProps {
  isOpen: boolean
  onRestore: (passphrase: string) => Promise<void>
  loading: boolean
  error: string | null
}

function BackupRestoreModal({
  isOpen,
  onRestore,
  loading,
  error,
}: BackupRestoreModalProps) {
  const [passphrase, setPassphrase] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) return
    await onRestore(passphrase)
  }

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-45 animate-in fade-in duration-200" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-[92vw] sm:w-full sm:max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono">
        <div className="mb-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary animate-pulse" /> Restore
            Encryption Keys
          </h2>
        </div>

        <p className="text-[10px] text-muted-foreground mb-4 leading-normal">
          A secure key backup was found on the server for your account. Please
          enter your backup passphrase to restore your private keys and decrypt
          your chat history on this browser.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px]">Backup Passphrase</Label>
            <Input
              type="password"
              placeholder="Enter passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="text-xs h-9 bg-card border-border rounded-xl focus:border-foreground"
            />
          </div>

          {error && (
            <div className="text-red-500 text-[10px] bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full text-xs h-9 px-4 rounded-xl cursor-pointer bg-foreground text-background"
            >
              {loading ? 'Restoring Keys...' : 'Restore Keys & Access Chat'}
            </Button>
          </div>
        </form>
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
  const { showAlert } = useAlert()
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
      showAlert({ title: 'Error', description: e instanceof Error ? e.message : 'Error sending request' })
    }
  }

  const handleRespond = async (
    requestId: Id<'friendRequests'>,
    status: 'accepted' | 'declined',
  ) => {
    try {
      await respondRequest({ requestId, status })
    } catch (e) {
      showAlert({ title: 'Error', description: e instanceof Error ? e.message : 'Error responding' })
    }
  }

  const handleCancel = async (requestId: Id<'friendRequests'>) => {
    try {
      await cancelRequest({ requestId })
    } catch (e) {
      showAlert({ title: 'Error', description: e instanceof Error ? e.message : 'Error cancelling request' })
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-md z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-[92vw] sm:w-full sm:max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono flex flex-col h-[480px]">
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
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-[92vw] sm:w-full sm:max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono max-h-[90vh] overflow-y-auto">
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
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-[92vw] sm:w-full sm:max-w-md shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-200 font-mono h-[420px] flex flex-col">
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
  const { showAlert, showConfirm } = useAlert()

  if (!isOpen || !user || !currentUser) return null

  const isMe = user._id === currentUser._id
  const isFriend = friends.some((f) => f.friend._id === user._id)
  const pendingReceived = receivedRequests.find((r) => r.senderId === user._id)
  const pendingSent = sentRequests.find((r) => r.receiverId === user._id)

  const handleAction = async () => {
    try {
      if (isFriend) {
        const confirmed = await showConfirm({
          title: 'Unfriend',
          description: `Are you sure you want to unfriend ${user.displayName}?`,
          confirmLabel: 'Unfriend',
          destructive: true,
        })
        if (confirmed) {
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
      showAlert({ title: 'Error', description: e instanceof Error ? e.message : 'Action failed' })
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-2xl w-[92vw] sm:w-full sm:max-w-xs shadow-2xl z-[60] animate-in zoom-in-95 fade-in duration-200 font-mono text-center">
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
function ChatInner() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()
  const router = useRouter()
  const { showAlert, showConfirm } = useAlert()

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
  const [isExploreOpen, setIsExploreOpen] = useState(false)

  // Zoom crop and details modals state
  const [selectedImageDetails, setSelectedImageDetails] = useState<{
    url: string
    iv?: string
  } | null>(null)
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<
    any | null
  >(null)
  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(
    new Set(),
  )
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null)

  // Context Menu and Long Press States
  const [activeMenuMessage, setActiveMenuMessage] = useState<any | null>(null)
  const [menuPosition, setMenuPosition] = useState<{
    x: number
    y: number
  } | null>(null)

  // Forwarding Modal States
  const [forwardMessage, setForwardMessage] = useState<any | null>(null)
  const [forwardSearch, setForwardSearch] = useState('')
  const [forwardingState, setForwardingState] = useState<
    Record<string, 'idle' | 'loading' | 'success' | 'error' | undefined>
  >({})

  // Refs for tracking long press timer
  const longPressTimerRef = useRef<any>(null)
  const isLongPressActiveRef = useRef(false)

  // Mobile UI state
  const [mobileShowChat, setMobileShowChat] = useState(true)

  // GIPHY Integration States
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false)
  const [gifSearchQuery, setGifSearchQuery] = useState('')
  const [gifs, setGifs] = useState<any[]>([])
  const [isSearchingGifs, setIsSearchingGifs] = useState(false)
  const [gifError, setGifError] = useState<string | null>(null)

  // Camera Modal States
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    let active = true
    if (!isCameraModalOpen) {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
        setCameraStream(null)
      }
      return
    }

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        setCameraStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('Error starting webcam:', err)
        showAlert({
          title: 'Camera Access Error',
          description: 'Could not access your webcam. Please check permissions.',
        })
        setIsCameraModalOpen(false)
      }
    }

    startWebcam()
    return () => {
      active = false
    }
  }, [isCameraModalOpen])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || !cameraStream) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Mirror image for canvas if front camera
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    canvas.toBlob(
      async (blob) => {
        if (!blob) return
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })

        // Close camera
        setIsCameraModalOpen(false)
        cameraStream.getTracks().forEach((track) => track.stop())
        setCameraStream(null)

        if (file.size > 15 * 1024 * 1024) {
          showAlert({
            title: 'File Too Large',
            description: 'Currently the file size is limited to 15MB.',
          })
          return
        }

        setLocalPreview(URL.createObjectURL(file))
        setUploadProgress(0)
        try {
          let fileToUpload = file
          if (aesKey) {
            const encrypted = await encryptFile(file, aesKey)
            fileToUpload = encrypted.encryptedFile
            imageIvRef.current = encrypted.iv
          } else {
            imageIvRef.current = undefined
          }
          await startUpload([fileToUpload])
        } catch (err) {
          console.error('Failed to upload camera capture:', err)
          showAlert({
            title: 'Upload Error',
            description: 'Failed to upload captured photo.',
          })
        }
      },
      'image/jpeg',
      0.95,
    )
  }

  const handleCameraClick = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      cameraInputRef.current?.click()
    } else {
      setIsCameraModalOpen(true)
    }
  }

  // Refs for tracking drag swipe and scroll
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null)
  const [swipeDistance, setSwipeDistance] = useState<number>(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cryptography Setup State
  const [myKeys, setMyKeys] = useState<{
    privateKey: CryptoKey
    publicKey: CryptoKey
    publicKeyJwkStr: string
  } | null>(null)
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null)
  const [isBackupSetupOpen, setIsBackupSetupOpen] = useState(false)
  const [isBackupRestoreOpen, setIsBackupRestoreOpen] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const imageIvRef = useRef<string | undefined>(undefined)

  // DB queries and mutations
  const currentUser = useQuery(api.users.getCurrentUser)
  const messages = useQuery(api.messages.getMessages, {
    chatroomId: activeRoomId,
  })
  const exploreMessages = useQuery(api.messages.getExploreMessages)
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
  const deleteMessageAction = useAction(api.cleanup.deleteMessage)
  const markMessagesAsSeen = useMutation(api.messages.markMessagesAsSeen)

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isUploadingVoice, setIsUploadingVoice] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<any>(null)
  // Encryption Queries & Mutations
  const registerPublicKey = useMutation(api.keys.registerPublicKey)
  const storeRoomKeys = useMutation(api.keys.storeRoomKeys)
  const myBackupDetails = useQuery(api.keys.getMyBackupDetails)
  const convex = useConvex()

  // E2EE key derivation hook
  const activeRoom = chatrooms?.find((r: any) => r._id === activeRoomId)
  const keyDerivationUserId = activeRoom
    ? activeRoom.isDM
      ? activeRoom.memberIds.find((id) => id !== currentUser?._id)
      : activeRoom.isPrivate
        ? activeRoom.ownerId
        : null
    : null

  const targetUserPublicKeyJwk = useQuery(
    api.keys.getUserPublicKey,
    keyDerivationUserId ? { userId: keyDerivationUserId } : 'skip',
  )

  const myRoomKeyRecord = useQuery(
    api.keys.getRoomKey,
    activeRoom && activeRoom.isPrivate ? { chatroomId: activeRoomId! } : 'skip',
  )

  // Load or generate user encryption keypair
  useEffect(() => {
    if (!currentUser) return

    const initKeys = async () => {
      try {
        const storedPriv = localStorage.getItem(`e2ee_priv_${currentUser._id}`)
        const storedPub = localStorage.getItem(`e2ee_pub_${currentUser._id}`)

        if (storedPriv && storedPub) {
          const privateKey = await importPrivateKey(storedPriv)
          const publicKey = await importPublicKey(storedPub)
          setMyKeys({
            privateKey,
            publicKey,
            publicKeyJwkStr: storedPub,
          })
        } else {
          if (myBackupDetails === undefined) return

          if (myBackupDetails && myBackupDetails.encryptedPrivateKey) {
            setIsBackupRestoreOpen(true)
          } else {
            const keyPair = await generateIdentityKeyPair()
            const privJwk = await exportKey(keyPair.privateKey)
            const pubJwk = await exportKey(keyPair.publicKey)

            localStorage.setItem(`e2ee_priv_${currentUser._id}`, privJwk)
            localStorage.setItem(`e2ee_pub_${currentUser._id}`, pubJwk)

            await registerPublicKey({ publicKey: pubJwk })

            setMyKeys({
              privateKey: keyPair.privateKey,
              publicKey: keyPair.publicKey,
              publicKeyJwkStr: pubJwk,
            })
            setIsBackupSetupOpen(true)
          }
        }
      } catch (err) {
        console.error('Error initializing E2EE keys:', err)
      }
    }

    initKeys()
  }, [currentUser, myBackupDetails])

  // Derive AES symmetric key for the current room
  useEffect(() => {
    let active = true

    const deriveKey = async () => {
      if (!activeRoomId || !activeRoom || !myKeys) {
        setAesKey(null)
        return
      }

      try {
        if (activeRoom.isDM) {
          if (!targetUserPublicKeyJwk) {
            setAesKey(null)
            return
          }
          const theirPubKey = await importPublicKey(targetUserPublicKeyJwk)
          const sharedSecret = await deriveSharedSecret(
            myKeys.privateKey,
            theirPubKey,
          )
          if (active) {
            setAesKey(sharedSecret)
          }
        } else if (activeRoom.isPrivate) {
          if (!myRoomKeyRecord || !targetUserPublicKeyJwk) {
            setAesKey(null)
            return
          }
          const ownerPubKey = await importPublicKey(targetUserPublicKeyJwk)
          const sharedSecretWithCreator = await deriveSharedSecret(
            myKeys.privateKey,
            ownerPubKey,
          )

          const rawKeyBase64 = await decryptText(
            myRoomKeyRecord.encryptedKey,
            myRoomKeyRecord.iv,
            sharedSecretWithCreator,
          )

          const roomAesKey = await importRawRoomKey(
            base64ToArrayBuffer(rawKeyBase64),
          )
          if (active) {
            setAesKey(roomAesKey)
          }
        } else {
          setAesKey(null)
        }
      } catch (err) {
        console.error('Error deriving room AES key:', err)
        if (active) {
          setAesKey(null)
        }
      }
    }

    deriveKey()
    return () => {
      active = false
    }
  }, [
    activeRoomId,
    activeRoom,
    myKeys,
    targetUserPublicKeyJwk,
    myRoomKeyRecord,
  ])

  // Reset upload states when room changes
  useEffect(() => {
    setImageUrl(null)
    setLocalPreview(null)
    imageIvRef.current = undefined
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }, [activeRoomId])

  // Dismiss context menu on click or scroll
  useEffect(() => {
    const handleDismiss = () => {
      setMenuPosition(null)
      setActiveMenuMessage(null)
    }
    window.addEventListener('click', handleDismiss)
    window.addEventListener('scroll', handleDismiss, true)
    return () => {
      window.removeEventListener('click', handleDismiss)
      window.removeEventListener('scroll', handleDismiss, true)
    }
  }, [])

  const { startUpload: startForwardImageUpload } =
    useUploadThing('imageUploader')
  const { startUpload: startForwardVoiceUpload } =
    useUploadThing('voiceUploader')

  const deriveKeyForRoom = async (room: any) => {
    if (!myKeys) throw new Error('No user keys loaded')
    if (room.isDM) {
      const otherId = room.memberIds.find((id: any) => id !== currentUser?._id)
      if (!otherId) throw new Error('Could not find other member in DM')
      const otherPubKeyJwk = await convex.query(api.keys.getUserPublicKey, {
        userId: otherId,
      })
      if (!otherPubKeyJwk)
        throw new Error('Other member has not registered public key')
      const theirPubKey = await importPublicKey(otherPubKeyJwk)
      const sharedSecret = await deriveSharedSecret(
        myKeys.privateKey,
        theirPubKey,
      )
      return sharedSecret
    } else if (room.isPrivate) {
      const roomKeyRecord = await convex.query(api.keys.getRoomKey, {
        chatroomId: room._id,
      })
      if (!roomKeyRecord) throw new Error('Room key not found')
      const ownerPubKeyJwk = await convex.query(api.keys.getUserPublicKey, {
        userId: room.ownerId,
      })
      if (!ownerPubKeyJwk)
        throw new Error('Room owner has not registered public key')
      const ownerPubKey = await importPublicKey(ownerPubKeyJwk)
      const sharedSecretWithCreator = await deriveSharedSecret(
        myKeys.privateKey,
        ownerPubKey,
      )
      const rawKeyBase64 = await decryptText(
        roomKeyRecord.encryptedKey,
        roomKeyRecord.iv,
        sharedSecretWithCreator,
      )
      const roomAesKey = await importRawRoomKey(
        base64ToArrayBuffer(rawKeyBase64),
      )
      return roomAesKey
    } else {
      return null
    }
  }

  const handleForwardMessage = async (msg: any, targetRoom: any) => {
    setForwardingState((prev) => ({ ...prev, [targetRoom._id]: 'loading' }))
    try {
      const sourceAesKey = aesKey
      const targetAesKey = await deriveKeyForRoom(targetRoom)

      let forwardedBody: string | undefined = undefined
      let forwardedBodyIv: string | undefined = undefined
      let forwardedImageUrl: string | undefined = undefined
      let forwardedImageIv: string | undefined = undefined
      let forwardedAudioUrl: string | undefined = undefined
      let forwardedAudioIv: string | undefined = undefined
      let forwardedAudioDuration: number | undefined = undefined

      if (msg.body) {
        let plainText = msg.body
        if (msg.bodyIv && sourceAesKey) {
          plainText = await decryptText(msg.body, msg.bodyIv, sourceAesKey)
        }
        if (targetAesKey) {
          const enc = await encryptText(plainText, targetAesKey)
          forwardedBody = enc.ciphertext
          forwardedBodyIv = enc.iv
        } else {
          forwardedBody = plainText
        }
      }

      if (msg.imageUrl) {
        const isGiphy = !msg.imageIv
        if (isGiphy) {
          forwardedImageUrl = msg.imageUrl
        } else {
          if (!sourceAesKey)
            throw new Error('Source E2E key is missing for encrypted image')
          const response = await fetch(msg.imageUrl)
          if (!response.ok) throw new Error('Failed to fetch source image file')
          const encryptedBuffer = await response.arrayBuffer()
          const decryptedBuffer = await decryptFile(
            encryptedBuffer,
            msg.imageIv,
            sourceAesKey,
          )
          const fileName = 'forwarded-image.jpg'

          let fileToUpload: File | Blob = new Blob([decryptedBuffer], {
            type: 'image/jpeg',
          })
          if (targetAesKey) {
            const encrypted = await encryptFile(
              new File([decryptedBuffer], fileName, { type: 'image/jpeg' }),
              targetAesKey,
            )
            fileToUpload = encrypted.encryptedFile
            forwardedImageIv = encrypted.iv
          }
          const uploadRes = await startForwardImageUpload([
            fileToUpload as File,
          ])
          if (!uploadRes || !uploadRes[0])
            throw new Error('Image upload failed during forwarding')
          forwardedImageUrl = uploadRes[0].ufsUrl || uploadRes[0].url
        }
      }

      if (msg.audioUrl) {
        const response = await fetch(msg.audioUrl)
        if (!response.ok) throw new Error('Failed to fetch source audio file')
        const encryptedBuffer = await response.arrayBuffer()
        let decryptedBuffer = encryptedBuffer
        if (msg.audioIv && sourceAesKey) {
          decryptedBuffer = await decryptFile(
            encryptedBuffer,
            msg.audioIv,
            sourceAesKey,
          )
        }
        const fileName = `forwarded-voice-${Date.now()}.webm`
        let fileToUpload: File | Blob = new Blob([decryptedBuffer], {
          type: 'audio/webm',
        })
        if (targetAesKey) {
          const encrypted = await encryptFile(
            new File([decryptedBuffer], fileName, { type: 'audio/webm' }),
            targetAesKey,
          )
          fileToUpload = encrypted.encryptedFile
          forwardedAudioIv = encrypted.iv
        }
        const uploadRes = await startForwardVoiceUpload([fileToUpload as File])
        if (!uploadRes || !uploadRes[0])
          throw new Error('Audio upload failed during forwarding')
        forwardedAudioUrl = uploadRes[0].ufsUrl || uploadRes[0].url
        forwardedAudioDuration = msg.audioDuration
      }

      await sendMessage({
        body: forwardedBody,
        bodyIv: forwardedBodyIv,
        imageUrl: forwardedImageUrl,
        imageIv: forwardedImageIv,
        audioUrl: forwardedAudioUrl,
        audioIv: forwardedAudioIv,
        audioDuration: forwardedAudioDuration,
        chatroomId: targetRoom._id === 'global' ? undefined : targetRoom._id,
      })

      setForwardingState((prev) => ({ ...prev, [targetRoom._id]: 'success' }))
      playPingSound()
      setTimeout(() => {
        setForwardingState((prev) => {
          const next = { ...prev }
          delete next[targetRoom._id]
          return next
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to forward message:', err)
      setForwardingState((prev) => ({ ...prev, [targetRoom._id]: 'error' }))
    }
  }

  const handleDeleteFullMessage = async (messageId: Id<'messages'>) => {
    const confirmed = await showConfirm({
      title: 'Delete Message',
      description: 'Are you sure you want to delete this message forever? This cannot be undone.',
      confirmLabel: 'Delete Forever',
      destructive: true,
    })
    if (!confirmed) return
    setDeletingMessageIds((prev) => {
      const next = new Set(prev)
      next.add(messageId)
      return next
    })
    try {
      await deleteMessageAction({ messageId })
      setDeletingMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    } catch (err) {
      setDeletingMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
      console.error('Failed to delete message:', err)
      showAlert({ title: 'Error', description: 'Failed to delete message' })
    }
  }

  // Mark messages as seen when room becomes active or new messages arrive (DMs only)
  useEffect(() => {
    if (activeRoomId && activeRoom?.isDM && messages) {
      const hasUnseen = messages.some(
        (msg: any) => msg.userId !== currentUser?._id && !msg.seen,
      )
      if (hasUnseen) {
        markMessagesAsSeen({ chatroomId: activeRoomId })
      }
    }
  }, [activeRoomId, activeRoom, messages, currentUser, markMessagesAsSeen])

  const handleRestoreBackup = async (passphrase: string) => {
    if (
      !currentUser ||
      !myBackupDetails ||
      !myBackupDetails.encryptedPrivateKey
    )
      return

    setBackupLoading(true)
    setBackupError(null)

    try {
      const decryptedPrivJwk = await decryptPrivateKeyBackup(
        myBackupDetails.encryptedPrivateKey,
        passphrase,
        myBackupDetails.backupIv!,
        myBackupDetails.backupSalt!,
      )

      localStorage.setItem(`e2ee_priv_${currentUser._id}`, decryptedPrivJwk)
      localStorage.setItem(
        `e2ee_pub_${currentUser._id}`,
        myBackupDetails.publicKey,
      )

      const privateKey = await importPrivateKey(decryptedPrivJwk)
      const publicKey = await importPublicKey(myBackupDetails.publicKey)

      setMyKeys({
        privateKey,
        publicKey,
        publicKeyJwkStr: myBackupDetails.publicKey,
      })

      setIsBackupRestoreOpen(false)
    } catch (err) {
      console.error('Backup restore failed:', err)
      setBackupError('Incorrect passphrase. Please try again.')
      throw err
    } finally {
      setBackupLoading(false)
    }
  }

  const handleSetupBackup = async (passphrase: string) => {
    if (!currentUser || !myKeys || !passphrase.trim()) return

    setBackupLoading(true)
    setBackupError(null)

    try {
      const privJwk = localStorage.getItem(`e2ee_priv_${currentUser._id}`)!
      const backup = await encryptPrivateKeyBackup(privJwk, passphrase)

      await registerPublicKey({
        publicKey: myKeys.publicKeyJwkStr,
        encryptedPrivateKey: backup.encryptedPrivateKey,
        backupIv: backup.iv,
        backupSalt: backup.salt,
      })

      setIsBackupSetupOpen(false)
      showAlert({ title: '✓ Key Backup Saved', description: 'Your encryption key backup has been completed successfully.' })
    } catch (err) {
      console.error('Backup setup failed:', err)
      setBackupError('Failed to set up backup. Please try again.')
      throw err
    } finally {
      setBackupLoading(false)
    }
  }

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

  // Fetch GIFs from GIPHY API
  useEffect(() => {
    if (!isGifPickerOpen) return

    const delayDebounce = setTimeout(async () => {
      setIsSearchingGifs(true)
      setGifError(null)

      const apiKey = import.meta.env.VITE_GIPHY_API_KEY
      if (!apiKey) {
        setGifs([])
        setGifError(
          'GIPHY API Key missing. Please set VITE_GIPHY_API_KEY in .env.local',
        )
        setIsSearchingGifs(false)
        return
      }

      try {
        const url = gifSearchQuery.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(gifSearchQuery)}&limit=12&rating=g`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=12&rating=g`

        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`)
        }
        const json = await res.json()
        if (json.meta && json.meta.status !== 200) {
          throw new Error(json.meta.msg || 'Failed to fetch GIFs')
        }
        setGifs(json.data || [])
      } catch (err) {
        console.error('Error fetching GIFs:', err)
        setGifError(err instanceof Error ? err.message : 'Error searching GIFs')
      } finally {
        setIsSearchingGifs(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [isGifPickerOpen, gifSearchQuery])

  // Active chat metadata
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
    const confirmed = await showConfirm({
      title: 'Delete Image',
      description: 'Are you sure you want to delete this image forever? This cannot be undone.',
      confirmLabel: 'Delete Forever',
      destructive: true,
    })
    if (!confirmed) return

    setDeletingMessageIds((prev) => {
      const next = new Set(prev)
      next.add(messageId)
      return next
    })

    try {
      await deleteImageAction({ messageId })
      setDeletingMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    } catch (err) {
      setDeletingMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
      console.error(err)
      showAlert({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete image' })
    }
  }

  const { startUpload, isUploading } = useUploadThing('imageUploader', {
    onClientUploadComplete: (res) => {
      if (res[0]) {
        setImageUrl(res[0].ufsUrl || res[0].url)
      }
    },
    onUploadError: (err) => {
      showAlert({ title: 'Upload Error', description: `Error uploading file: ${err.message}` })
      setLocalPreview(null)
    },
    onUploadProgress: (p: number) => {
      setUploadProgress(p)
    },
  })

  const { startUpload: startVoiceUpload } = useUploadThing('voiceUploader', {
    onUploadError: (err) => {
      showAlert({ title: 'Upload Error', description: `Error uploading voice message: ${err.message}` })
      setIsUploadingVoice(false)
    },
  })
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="border-b border-border px-6 py-2.5">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Skeleton className="h-6 w-32 bg-accent animate-pulse" />
            <Skeleton className="h-4 w-24 bg-accent animate-pulse" />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3">
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
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // If multiple files are selected, upload and send them immediately
    if (files.length > 1) {
      const validFiles = files.filter((file) => {
        if (file.size > 15 * 1024 * 1024) {
          showAlert({
            title: 'File Too Large',
            description: `File "${file.name}" is larger than 15MB limit and will be skipped.`,
          })
          return false
        }
        return true
      })

      if (validFiles.length === 0) {
        e.target.value = ''
        return
      }

      try {
        for (const file of validFiles) {
          setLocalPreview(URL.createObjectURL(file))
          setUploadProgress(0)

          let fileToUpload = file
          let iv: string | undefined = undefined
          if (aesKey) {
            const encrypted = await encryptFile(file, aesKey)
            fileToUpload = encrypted.encryptedFile
            iv = encrypted.iv
          }

          // startUpload returns the array of uploaded files when complete
          const res = await startUpload([fileToUpload])
          if (res && res[0]) {
            const uploadedUrl = res[0].ufsUrl || res[0].url
            await sendMessage({
              imageUrl: uploadedUrl,
              imageIv: iv,
              chatroomId: activeRoomId,
            })
          }
        }
      } catch (err) {
        console.error('Error uploading multiple files:', err)
        showAlert({
          title: 'Upload Error',
          description: 'Failed to upload one or more files.',
        })
      } finally {
        setUploadProgress(0)
        setLocalPreview(null)
        setImageUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
      return
    }

    const file = files[0]
    if (file.size > 15 * 1024 * 1024) {
      showAlert({
        title: 'File Too Large',
        description: 'Currently the file size is limited to 15MB.',
      })
      e.target.value = ''
      return
    }

    setLocalPreview(URL.createObjectURL(file))
    setUploadProgress(0)
    try {
      let fileToUpload = file
      if (aesKey) {
        const encrypted = await encryptFile(file, aesKey)
        fileToUpload = encrypted.encryptedFile
        imageIvRef.current = encrypted.iv
      } else {
        imageIvRef.current = undefined
      }
      await startUpload([fileToUpload])
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearImage = () => {
    setImageUrl(null)
    setLocalPreview(null)
    imageIvRef.current = undefined
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      audioChunksRef.current = []
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000,
      })
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) return

        setIsUploadingVoice(true)
        try {
          const duration = recordingDuration
          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm',
          })
          const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
            type: 'audio/webm',
          })

          let fileToUpload = audioFile
          let audioIv: string | undefined = undefined

          if (aesKey) {
            const encrypted = await encryptFile(audioFile, aesKey)
            fileToUpload = encrypted.encryptedFile
            audioIv = encrypted.iv
          }

          const res = await startVoiceUpload([fileToUpload])
          if (res && res[0]) {
            const audioUrl = res[0].ufsUrl || res[0].url
            await sendMessage({
              audioUrl,
              audioIv,
              audioDuration: duration,
              chatroomId: activeRoomId,
              replyToId: replyingToMessage?._id,
            })
            setReplyingToMessage(null)
          }
        } catch (err) {
          console.error('Failed to process voice recording:', err)
          showAlert({ title: 'Error', description: 'Failed to send voice message' })
        } finally {
          setIsUploadingVoice(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error starting voice recording:', err)
      showAlert({ title: 'Microphone Access Denied', description: 'Could not access your microphone. Please grant permission in your browser settings.' })
    }
  }

  const stopRecording = () => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === 'inactive'
    )
      return

    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setIsRecording(false)
  }

  const cancelRecording = () => {
    if (!mediaRecorderRef.current) return

    audioChunksRef.current = []
    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setIsRecording(false)
    setRecordingDuration(0)
  }

  /* eslint-disable no-misleading-character-class */
  const isOnlyEmojis = (str: string) => {
    const cleanStr = str.replace(/\s+/g, '')
    if (!cleanStr) return false
    const emojiRegex =
      /^[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}]+$/u
    return emojiRegex.test(cleanStr)
  }
  /* eslint-enable no-misleading-character-class */

  // ----------------------------------------------------------------------------
  // SWIPE-TO-REPLY TOUCH HANDLERS
  // ----------------------------------------------------------------------------
  const handleTouchStart = (e: React.TouchEvent, msg: any) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    setSwipingMessageId(msg._id)
    setSwipeDistance(0)
    isLongPressActiveRef.current = false

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (typeof window !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(50)
        } catch (_) {}
      }
      setActiveMenuMessage(msg)
      setMenuPosition(null)
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !swipingMessageId) return
    const t = e.touches[0]
    const deltaX = t.clientX - touchStartRef.current.x
    const deltaY = t.clientY - touchStartRef.current.y

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }

    // Allow swipe if it is primarily horizontal and moving to the right
    if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY) * 0.8) {
      setSwipeDistance(Math.min(deltaX, 80))
    }
  }

  const handleTouchEnd = (msg: any) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false
      touchStartRef.current = null
      setSwipingMessageId(null)
      setSwipeDistance(0)
      return
    }

    if (swipeDistance > 45) {
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

    let encryptedBody: string | undefined = undefined
    let bodyIv: string | undefined = undefined

    if (aesKey && body.trim()) {
      const enc = await encryptText(body.trim(), aesKey)
      encryptedBody = enc.ciphertext
      bodyIv = enc.iv
    } else {
      encryptedBody = body.trim() || undefined
    }

    await sendMessage({
      body: encryptedBody,
      bodyIv: bodyIv,
      imageUrl: imageUrl || undefined,
      imageIv: imageIvRef.current,
      chatroomId: activeRoomId,
      replyToId: replyingToMessage?._id,
      mentions: mentions.length > 0 ? mentions : undefined,
    })

    setBody('')
    setImageUrl(null)
    setLocalPreview(null)
    setReplyingToMessage(null)
    imageIvRef.current = undefined
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleCreateRoom = async (
    name: string,
    password?: string,
    isPrivate?: boolean,
    members?: Id<'users'>[],
  ) => {
    try {
      const initialMembers = [currentUser?._id, ...(members || [])].filter(
        Boolean,
      ) as Id<'users'>[]
      const roomKeyDetails: Array<{
        userId: Id<'users'>
        encryptedKey: string
        iv: string
      }> = []

      if (isPrivate && myKeys) {
        const roomKey = await generateRoomKey()
        const rawKeyBytes = await exportRawRoomKey(roomKey)
        const rawKeyBase64 = arrayBufferToBase64(rawKeyBytes)

        const publicKeys = await convex.query(api.keys.getUserPublicKeys, {
          userIds: initialMembers,
        })

        for (const pkInfo of publicKeys) {
          const memberPubKey = await importPublicKey(pkInfo.publicKey)
          const sharedSecret = await deriveSharedSecret(
            myKeys.privateKey,
            memberPubKey,
          )
          const { ciphertext, iv } = await encryptText(
            rawKeyBase64,
            sharedSecret,
          )
          roomKeyDetails.push({
            userId: pkInfo.userId,
            encryptedKey: ciphertext,
            iv: iv,
          })
        }
      }

      const id = await createRoom({
        name,
        password,
        isPrivate: isPrivate || false,
        initialMembers: members,
      })

      if (isPrivate && roomKeyDetails.length > 0) {
        await storeRoomKeys({
          chatroomId: id,
          keys: roomKeyDetails,
        })
      }

      setActiveRoomId(id)
      setIsExploreOpen(false)
      setIsCreateRoomOpen(false)
      setMobileShowChat(true)
    } catch (e) {
      showAlert({ title: 'Error', description: e instanceof Error ? e.message : 'Error creating room' })
    }
  }

  const handleJoinRoom = async (id: Id<'chatrooms'>, password?: string) => {
    try {
      await joinRoom({ chatroomId: id, password })
      setActiveRoomId(id)
      setIsExploreOpen(false)
      setIsJoinRoomOpen(false)
      setMobileShowChat(true)
    } catch (e) {
      showAlert({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to join room' })
    }
  }

  const handleFriendClick = async (friendId: Id<'users'>) => {
    try {
      const dmId = await checkOrCreateDM({ friendId })
      setActiveRoomId(dmId)
      setIsExploreOpen(false)
      setMobileShowChat(true)
    } catch (e) {
      showAlert({ title: 'Error', description: e instanceof Error ? e.message : 'Error opening DM' })
    }
  }

  return (
    <div className="h-[100dvh] bg-background text-foreground flex overflow-hidden font-mono">
      {/* ----------------------------------------------------------------------
          SIDEBAR UI
          ---------------------------------------------------------------------- */}
      <aside
        className={`w-full md:w-[280px] shrink-0 border-r border-border bg-card flex flex-col h-full z-30 transition-all duration-300 ${
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
                      setIsBackupSetupOpen(true)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent cursor-pointer flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" /> Key Backup Setup
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
                setIsExploreOpen(false)
                setMobileShowChat(true)
              }}
              className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs transition-colors cursor-pointer ${
                activeRoomId === null && !isExploreOpen
                  ? 'bg-primary/20 font-bold border border-primary/20'
                  : 'hover:bg-muted/40 border border-transparent'
              }`}
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span>Global Chat</span>
            </button>

            {/* Explore */}
            <button
              onClick={() => {
                setIsExploreOpen(true)
                setMobileShowChat(true)
              }}
              className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs transition-colors cursor-pointer ${
                isExploreOpen
                  ? 'bg-primary/20 font-bold border border-primary/20'
                  : 'hover:bg-muted/40 border border-transparent'
              }`}
            >
              <Images className="w-4 h-4 text-muted-foreground" />
              <span>Explore</span>
            </button>

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
                        setIsExploreOpen(false)
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
                        setIsExploreOpen(false)
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
        className={`flex-1 flex flex-col h-full bg-background transition-all duration-300 ${
          !mobileShowChat
            ? 'max-md:translate-x-full absolute md:relative'
            : 'relative w-full md:w-auto'
        }`}
      >
        {isExploreOpen ? (
          <ExploreView
            exploreMessages={exploreMessages}
            chatrooms={chatrooms}
            currentUser={currentUser}
            myKeys={myKeys}
            onImageClick={(url, iv) => setSelectedImageDetails({ url, iv: iv })}
            onGoBack={() => { setIsExploreOpen(false); setMobileShowChat(false) }}
          />
        ) : (
          <>
        {/* Chat Header */}
        <header className="border-b border-border/80 px-4 py-2 md:px-6 md:py-2.5 flex items-center justify-between z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileShowChat(false)}
              className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold flex items-center gap-1.5 truncate">
                {activeRoomId === null ? (
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{chatTitle}</span>
                {activeRoomId !== null && (
                  <span className="inline-flex md:hidden items-center text-[9px] px-1.5 py-0.5 rounded-full bg-muted border border-border/60 text-muted-foreground font-mono font-medium scale-90 shrink-0">
                    {activeRoom?.isDM ? (
                      <Lock className="w-2.5 h-2.5 mr-0.5" />
                    ) : activeRoom?.isPrivate ? (
                      <Lock className="w-2.5 h-2.5 mr-0.5" />
                    ) : (
                      <Globe className="w-2.5 h-2.5 mr-0.5" />
                    )}
                    {activeRoom?.isDM ? 'DM' : activeRoom?.isPrivate ? 'Private' : 'Public'}
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-muted-foreground leading-none truncate mt-0.5">
                {chatDescription}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center text-xs font-mono text-muted-foreground">
              {activeRoomId === null
                ? 'Public Channel'
                : activeRoom?.isPrivate
                  ? 'Private Room'
                  : 'Public Room'}
            </div>
          </div>
        </header>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="max-w-4xl mx-auto space-y-2 relative">
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

                const isDeletedMsg = !!msg.isDeleted
                return (
                  <div
                    key={msg._id}
                    id={`msg-${msg._id}`}
                    onTouchStart={(e) =>
                      !isDeletedMsg && handleTouchStart(e, msg)
                    }
                    onTouchMove={!isDeletedMsg ? handleTouchMove : undefined}
                    onTouchEnd={
                      !isDeletedMsg ? () => handleTouchEnd(msg) : undefined
                    }
                    onContextMenu={(e) => {
                      if (isDeletedMsg) return
                      e.preventDefault()
                      setActiveMenuMessage(msg)
                      setMenuPosition({ x: e.clientX, y: e.clientY })
                    }}
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
                          swipeDistance > 45
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
                          <DecryptedTextInline
                            body={msg.repliedTo.body}
                            bodyIv={msg.repliedTo.bodyIv}
                            aesKey={aesKey}
                            fallback="Image"
                          />
                        </div>
                      )}
                      {msg.isDeleted ? (
                        <div
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs italic text-muted-foreground bg-muted/20 border-dashed border-border/80 select-none ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span>
                            {msg.deletedFormat === 'voice'
                              ? 'A sound wave was silenced'
                              : msg.deletedFormat === 'image'
                                ? 'Visual memory collapsed into a black hole'
                                : msg.deletedFormat === 'gif'
                                  ? 'GIF vanished into pixels'
                                  : 'A thought was lost to the void'}
                          </span>
                        </div>
                      ) : (
                        <>
                          {/* Bubble Text */}
                          {msg.body && (
                            <DecryptedText
                              body={msg.body}
                              bodyIv={msg.bodyIv}
                              aesKey={aesKey}
                              isOnlyEmojis={isOnlyEmojis}
                              renderBodyWithMentions={renderBodyWithMentions}
                              isMe={!!isMe}
                            />
                          )}

                          {/* Bubble Voice Message */}
                          {msg.audioUrl && (
                            <VoiceMessagePlayer
                              audioUrl={msg.audioUrl}
                              audioIv={msg.audioIv}
                              audioDuration={msg.audioDuration}
                              aesKey={aesKey}
                              isMe={!!isMe}
                            />
                          )}
                          {/* Bubble Image */}
                          {msg.imageUrl && (
                            <div
                              className={`relative group mt-1 max-w-xs rounded-xl overflow-hidden transition-all duration-300 ${
                                !msg.body
                                  ? 'border-0 bg-transparent'
                                  : 'border border-border bg-card'
                              } ${
                                isDeletingImage ? 'opacity-0 scale-95' : ''
                              }`}
                            >
                              <div
                                onClick={() =>
                                  setSelectedImageDetails({
                                    url: msg.imageUrl!,
                                    iv: msg.imageIv,
                                  })
                                }
                                className="cursor-zoom-in hover:opacity-95 transition-opacity"
                              >
                                {msg.imageIv && aesKey ? (
                                  <EncryptedImage
                                    imageUrl={msg.imageUrl}
                                    imageIv={msg.imageIv}
                                    aesKey={aesKey}
                                    alt="Uploaded chat image"
                                    className="w-full h-auto max-h-56 object-cover"
                                  />
                                ) : (
                                  <img
                                    src={msg.imageUrl}
                                    alt="Uploaded chat image"
                                    className="w-full h-auto max-h-56 object-cover"
                                  />
                                )}
                              </div>
                              {isMe && !isDeletingImage && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImage(msg._id)}
                                  className="hidden md:block absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 hover:bg-destructive text-white rounded-lg p-1.5 transition-all cursor-pointer shadow-md"
                                  title="Delete image forever"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Expired Image Placeholder */}
                      {msg.imageDeletedReason === 'expired' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 border border-border/50 px-2.5 py-1.5 rounded-xl select-none max-w-xs italic mt-1">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                          <span>7 days has elapsed, the image is now gone</span>
                        </div>
                      )}

                      {/* Meta/Sender Label */}
                      <span className="text-[9px] font-semibold text-muted-foreground mt-0.5 px-1 flex items-center gap-1.5 select-none">
                        <span>
                          {isMe ? 'You' : msg.user?.displayName || 'Anonymous'}
                        </span>
                        {isMe && activeRoom?.isDM && (
                          <span
                            className="inline-flex items-center"
                            title={msg.seen ? 'Seen' : 'Sent'}
                          >
                            {msg.seen ? (
                              <CheckCheck className="w-3 h-3 text-sky-500 stroke-[2.5]" />
                            ) : (
                              <Check className="w-3 h-3 text-muted-foreground/50 stroke-[2.5]" />
                            )}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Hover Reply Button (Desktop) */}
                    {!msg.isDeleted && (
                      <button
                        onClick={() => setReplyingToMessage(msg)}
                        className={`hidden md:block opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground cursor-pointer shadow-sm ${
                          isMe ? '-left-8' : '-right-8'
                        }`}
                        title="Reply"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Form Area */}
        <div className="border-t border-border/80 p-2 pb-[calc(8px+env(safe-area-inset-bottom))] md:p-2.5">
          {/* File Upload Preview Panel */}
          {localPreview && (
            <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 md:gap-3 p-2 rounded-xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
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
                  {fileInputRef.current?.files?.[0]?.name ||
                    (imageUrl?.includes('giphy.com')
                      ? 'GIPHY Image'
                      : 'Selected Image')}
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
            <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-[10px] text-muted-foreground animate-in slide-in-from-bottom-1 duration-150">
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
            className="max-w-4xl mx-auto flex items-center gap-1.5 md:gap-2 relative"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
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

            {/* GIPHY GIF Picker Popover */}
            {isGifPickerOpen && (
              <div className="absolute bottom-full left-0 mb-2 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-4 z-30 font-sans text-xs w-full sm:w-[400px] h-[360px] sm:h-[420px] max-h-[60vh] overflow-hidden flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    Search GIPHY
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGifPickerOpen(false)
                      setGifSearchQuery('')
                    }}
                    className="text-muted-foreground hover:text-destructive cursor-pointer p-1 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <Input
                  value={gifSearchQuery}
                  onChange={(e) => setGifSearchQuery(e.target.value)}
                  placeholder="Search GIFs..."
                  autoFocus
                  className="h-9 rounded-xl text-xs bg-muted/40 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/50 px-3"
                />

                <div className="flex-1 overflow-y-auto min-h-0 pr-1 scrollbar-thin">
                  {gifError ? (
                    <div className="text-center py-10 text-destructive text-[11px]">
                      {gifError}
                    </div>
                  ) : isSearchingGifs ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-[11px] text-muted-foreground">
                        Searching GIPHY...
                      </span>
                    </div>
                  ) : gifs.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-[11px]">
                      {gifSearchQuery ? 'No GIFs found' : 'No trending GIFs'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {gifs.map((gif) => {
                        const thumbnailUrl =
                          gif.images.fixed_height_downsampled?.url ||
                          gif.images.fixed_height?.url
                        const fullUrl = gif.images.original?.url
                        return (
                          <div
                            key={gif.id}
                            onClick={() => {
                              setImageUrl(fullUrl)
                              setLocalPreview(fullUrl)
                              setIsGifPickerOpen(false)
                              setGifSearchQuery('')
                            }}
                            className="aspect-[4/3] rounded-lg overflow-hidden border border-border/40 bg-muted hover:border-primary/50 cursor-pointer transition-all hover:scale-[1.02] shadow-sm active:scale-95"
                          >
                            <img
                              src={thumbnailUrl}
                              alt={gif.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isRecording && !localPreview && (
              <div className="flex items-center gap-1.5 shrink-0">
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

                <Button
                  type="button"
                  onClick={handleCameraClick}
                  disabled={isUploading}
                  variant="outline"
                  className="shrink-0 rounded-xl bg-card border-border/80 text-muted-foreground hover:text-foreground cursor-pointer h-9 w-9 flex items-center justify-center p-0"
                  title="Take photo with camera"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    setIsGifPickerOpen(!isGifPickerOpen)
                  }}
                  variant="outline"
                  className={`shrink-0 rounded-xl border-border/80 cursor-pointer h-9 px-2 text-xs font-bold font-sans transition-all flex items-center justify-center ${
                    isGifPickerOpen
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  }`}
                  title="Find and share GIF"
                >
                  GIF
                </Button>
              </div>
            )}

            {isRecording ? (
              <div className="flex-1 flex items-center justify-between bg-muted/40 border border-border/60 rounded-xl h-9 px-2 md:px-3 font-mono text-[10px] md:text-xs animate-in fade-in duration-200 min-w-0">
                <div className="flex items-center gap-1 md:gap-2 min-w-0 truncate">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-muted-foreground font-bold hidden md:inline">
                    Recording Voice Note:
                  </span>
                  <span className="text-muted-foreground font-bold md:hidden">
                    Rec:
                  </span>
                  <span className="font-semibold shrink-0">
                    {Math.floor(recordingDuration / 60)}:
                    {(recordingDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={cancelRecording}
                    className="h-7 px-1.5 md:px-2.5 text-[10px] md:text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Discard</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={stopRecording}
                    disabled={isUploadingVoice}
                    className="h-7 px-2 md:px-3 text-[10px] md:text-xs bg-foreground text-background hover:opacity-90 rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    {isUploadingVoice ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Input
                  ref={inputRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type message (@username to tag)..."
                  className="flex-1 rounded-xl bg-card border-border/80 h-9 px-3 py-2 text-sm md:text-xs focus:ring-1 focus:ring-ring min-w-0"
                />

                {body.trim() || imageUrl ? (
                  <Button
                    type="submit"
                    disabled={isUploading}
                    className="shrink-0 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 h-9 w-9 md:w-auto p-0 md:px-4 md:py-2 animate-in scale-in"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Send</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={startRecording}
                    variant="outline"
                    className="shrink-0 rounded-xl bg-card border-border/80 text-muted-foreground hover:text-foreground cursor-pointer h-9 w-9 flex items-center justify-center p-0 animate-in scale-in"
                    title="Record voice note"
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </form>
        </div>
      </>
      )}
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
        imageUrl={selectedImageDetails?.url || null}
        imageIv={selectedImageDetails?.iv || null}
        aesKey={aesKey}
        onClose={() => setSelectedImageDetails(null)}
      />
      <BackupSetupModal
        isOpen={isBackupSetupOpen}
        onClose={() => setIsBackupSetupOpen(false)}
        onSetup={handleSetupBackup}
        loading={backupLoading}
        error={backupError}
      />
      <BackupRestoreModal
        isOpen={isBackupRestoreOpen}
        onRestore={handleRestoreBackup}
        loading={backupLoading}
        error={backupError}
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

      {/* Floating Context Menu (PC) */}
      {menuPosition && activeMenuMessage && (
        <div
          className="fixed z-50 min-w-[150px] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100 font-sans"
          style={{ top: menuPosition.y, left: menuPosition.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setForwardMessage(activeMenuMessage)
              setMenuPosition(null)
              setActiveMenuMessage(null)
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-xs transition-colors cursor-pointer flex items-center gap-2"
          >
            <Share className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Forward</span>
          </button>
          {currentUser && activeMenuMessage.userId === currentUser._id && (
            <button
              onClick={() => {
                handleDeleteFullMessage(activeMenuMessage._id)
                setMenuPosition(null)
                setActiveMenuMessage(null)
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-destructive/15 text-destructive text-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}

      {/* Bottom Sheet for Message Actions (Mobile) */}
      <Sheet
        open={activeMenuMessage !== null && menuPosition === null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveMenuMessage(null)
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-w-lg mx-auto p-4 pb-6 font-sans"
        >
          <SheetHeader className="text-left pb-2 border-b border-border/60">
            <SheetTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Message Actions
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 mt-2">
            <button
              onClick={() => {
                setForwardMessage(activeMenuMessage)
                setActiveMenuMessage(null)
              }}
              className="w-full text-left px-4 py-3.5 rounded-xl hover:bg-muted text-sm transition-colors cursor-pointer flex items-center gap-3 active:bg-muted/80"
            >
              <Share className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Forward Message</span>
            </button>

            {currentUser &&
              activeMenuMessage &&
              activeMenuMessage.userId === currentUser._id && (
                <button
                  onClick={() => {
                    handleDeleteFullMessage(activeMenuMessage._id)
                    setActiveMenuMessage(null)
                  }}
                  className="w-full text-left px-4 py-3.5 rounded-xl hover:bg-destructive/10 text-destructive text-sm transition-colors cursor-pointer flex items-center gap-3 active:bg-destructive/15"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="font-medium">Delete Message</span>
                </button>
              )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Forward Modal */}
      {forwardMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-background border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Forward Message</h3>
                <p className="text-[10px] text-muted-foreground">
                  Select a chat or friend to forward to
                </p>
              </div>
              <button
                onClick={() => {
                  setForwardMessage(null)
                  setForwardSearch('')
                  setForwardingState({})
                }}
                className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-border/40">
              <Input
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder="Search chats or friends..."
                className="h-8 rounded-lg text-xs bg-muted/40"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {[
                {
                  _id: 'global',
                  name: 'Global Chat',
                  isDM: false,
                  isPrivate: false,
                },
                ...(chatrooms || []),
              ]
                .filter((r: any) =>
                  r.name.toLowerCase().includes(forwardSearch.toLowerCase()),
                )
                .map((room: any) => {
                  const state = forwardingState[room._id] || 'idle'

                  return (
                    <div
                      key={room._id}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/40 transition-colors border border-transparent"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {room._id === 'global' ? (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                            <Globe className="w-4 h-4 text-primary" />
                          </div>
                        ) : room.isDM ? (
                          <img
                            src={
                              room.otherUser?.image ||
                              getAvatar(room.otherUser?.avatarSeed || 'default')
                            }
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-border/60"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border/60">
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="truncate min-w-0">
                          <p className="text-xs font-semibold leading-none truncate">
                            {room.name}
                          </p>
                          <span className="text-[9px] text-muted-foreground leading-none">
                            {room._id === 'global'
                              ? 'Public Channel'
                              : room.isDM
                                ? 'Direct Message'
                                : room.isPrivate
                                  ? 'Private Room'
                                  : 'Public Room'}
                          </span>
                        </div>
                      </div>

                      <button
                        disabled={state === 'loading' || state === 'success'}
                        onClick={() =>
                          handleForwardMessage(forwardMessage, room)
                        }
                        className={`text-[10px] font-bold h-7 px-3 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          state === 'loading'
                            ? 'bg-muted text-muted-foreground cursor-wait'
                            : state === 'success'
                              ? 'bg-green-500/10 text-green-500 font-bold border border-green-500/20'
                              : state === 'error'
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                : 'bg-primary text-primary-foreground hover:opacity-90'
                        }`}
                      >
                        {state === 'loading' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : state === 'success' ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Sent</span>
                          </>
                        ) : state === 'error' ? (
                          <span>Failed</span>
                        ) : (
                          <span>Send</span>
                        )}
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Web Camera Modal (Desktop) */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <span className="font-sans font-bold text-xs">Camera Preview</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(false)}
                className="text-muted-foreground hover:text-destructive cursor-pointer p-1 rounded-lg hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video preview container */}
            <div className="relative flex-1 bg-black aspect-video flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {!cameraStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <span className="text-[10px] text-muted-foreground font-mono">Initializing camera...</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 border-t border-border/60 flex items-center justify-center gap-4 bg-card/50">
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(false)}
                className="px-4 py-2 border border-border/80 rounded-xl text-xs hover:bg-muted text-muted-foreground cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraStream}
                className="h-12 w-12 rounded-full border-4 border-primary/20 bg-primary hover:bg-primary/90 flex items-center justify-center text-primary-foreground shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                title="Capture Photo"
              >
                <div className="w-5 h-5 rounded-full border-2 border-white bg-white/20" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// ROOT ROUTE COMPONENT (wraps ChatInner in AlertProvider)
// ----------------------------------------------------------------------------
function RouteComponent() {
  return (
    <AlertProvider>
      <ChatInner />
    </AlertProvider>
  )
}
