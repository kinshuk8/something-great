import { useState, useEffect } from 'react'
import { decryptFile } from '../lib/crypto'
import { Skeleton } from '#/components/ui/skeleton'

interface EncryptedImageProps {
  imageUrl: string
  imageIv: string
  aesKey: CryptoKey
  alt?: string
  className?: string
  onClick?: () => void
}

export function EncryptedImage({
  imageUrl,
  imageIv,
  aesKey,
  alt,
  className,
  onClick,
}: EncryptedImageProps) {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    let active = true
    let localUrl: string | null = null

    const loadAndDecrypt = async () => {
      try {
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error('Failed to fetch image')
        const buffer = await response.arrayBuffer()

        const decryptedBuffer = await decryptFile(buffer, imageIv, aesKey)
        const blob = new Blob([decryptedBuffer])
        localUrl = URL.createObjectURL(blob)

        if (active) {
          setDecryptedUrl(localUrl)
        }
      } catch (err) {
        console.error('Failed to decrypt image:', err)
        if (active) setError(true)
      }
    }

    loadAndDecrypt()

    return () => {
      active = false
      if (localUrl) {
        URL.revokeObjectURL(localUrl)
      }
    }
  }, [imageUrl, imageIv, aesKey])

  if (error) {
    return (
      <div className="flex items-center justify-center bg-destructive/10 text-destructive text-[10px] p-3 rounded-lg border border-destructive/20 select-none">
        Failed to decrypt image
      </div>
    )
  }

  if (!decryptedUrl) {
    return (
      <Skeleton className="w-full h-48 bg-accent/20 animate-pulse rounded" />
    )
  }

  return (
    <img src={decryptedUrl} alt={alt} className={className} onClick={onClick} />
  )
}
