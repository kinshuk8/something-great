import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Mic } from 'lucide-react'
import { decryptFile } from '../lib/crypto'
import { Skeleton } from '#/components/ui/skeleton'

interface VoiceMessagePlayerProps {
  audioUrl: string
  audioIv?: string
  audioDuration?: number
  aesKey: CryptoKey | null
  isMe: boolean
}

export function VoiceMessagePlayer({
  audioUrl,
  audioIv,
  audioDuration,
  aesKey,
  isMe,
}: VoiceMessagePlayerProps) {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(audioDuration || 0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isSeekingRef = useRef(false)

  // 1. Handle Decryption and URL setup
  useEffect(() => {
    let active = true
    let localUrl: string | null = null

    const loadAudio = async () => {
      setLoading(true)
      try {
        if (audioIv && aesKey) {
          // Encrypted voice message
          const response = await fetch(audioUrl)
          if (!response.ok) throw new Error('Failed to fetch audio file')
          const buffer = await response.arrayBuffer()

          const decryptedBuffer = await decryptFile(buffer, audioIv, aesKey)
          const blob = new Blob([decryptedBuffer], { type: 'audio/webm' })
          localUrl = URL.createObjectURL(blob)
          if (active) {
            setDecryptedUrl(localUrl)
            setError(false)
          }
        } else {
          // Unencrypted public voice message
          if (active) {
            setDecryptedUrl(audioUrl)
            setError(false)
          }
        }
      } catch (err) {
        console.error('Failed to load/decrypt voice message:', err)
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAudio()

    return () => {
      active = false
      if (localUrl) {
        URL.revokeObjectURL(localUrl)
      }
    }
  }, [audioUrl, audioIv, aesKey])

  // 2. Playback listeners
  useEffect(() => {
    if (!decryptedUrl) return

    const audio = new Audio(decryptedUrl)
    audioRef.current = audio

    const onTimeUpdate = () => {
      if (!isSeekingRef.current) {
        setCurrentTime(audio.currentTime)
      }
    }

    const onLoadedMetadata = () => {
      if (audio.duration && !audioDuration) {
        setDuration(audio.duration)
      }
    }

    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [decryptedUrl, audioDuration])

  const togglePlay = () => {
    if (!audioRef.current || loading || error) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Audio play failed:', err)
      })
      setIsPlaying(true)
    }
  }

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setCurrentTime(val)
    isSeekingRef.current = true
  }

  const handleSeekEnd = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = currentTime
    isSeekingRef.current = false
  }

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-[10px] px-3 py-2.5 rounded-2xl rounded-tl-none border border-destructive/20 select-none">
        <span>Failed to decrypt voice message</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={`flex items-center gap-4 px-4.5 py-3.5 rounded-2xl w-76 max-w-full border ${
          isMe
            ? 'bg-foreground/5 border-foreground/10 text-foreground'
            : 'bg-card text-foreground border-border/80'
        }`}
      >
        <Skeleton className="w-9 h-9 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-2 w-full bg-muted" />
          <Skeleton className="h-1.5 w-1/3 bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-4 px-4.5 py-3.5 rounded-2xl w-76 max-w-full select-none ${
        isMe
          ? 'bg-foreground text-background rounded-tr-none'
          : 'bg-card text-foreground border border-border/80 rounded-tl-none'
      }`}
    >
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${
          isMe
            ? 'bg-background text-foreground hover:scale-105'
            : 'bg-foreground text-background hover:scale-105'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <Mic
            className={`w-3.5 h-3.5 ${isMe ? 'opacity-70' : 'text-muted-foreground'}`}
          />
          <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">
            Voice Note
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeekChange}
          onMouseUp={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
          className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none ${
            isMe
              ? 'bg-background/20 accent-background'
              : 'bg-muted accent-foreground'
          }`}
          style={{
            background: isMe
              ? `linear-gradient(to right, currentColor ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%)`
              : `linear-gradient(to right, currentColor ${(currentTime / (duration || 1)) * 100}%, var(--muted) ${(currentTime / (duration || 1)) * 100}%)`,
          }}
        />

        <div
          className={`flex justify-between text-[10px] font-mono ${isMe ? 'opacity-80' : 'text-muted-foreground'}`}
        >
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}
