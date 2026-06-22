import React, { useState, useEffect } from 'react'
import { decryptText } from '../lib/crypto'

interface DecryptedTextProps {
  body: string
  bodyIv?: string
  aesKey: CryptoKey | null
  isOnlyEmojis: (str: string) => boolean
  renderBodyWithMentions: (text: string | undefined) => React.ReactNode
  isMe: boolean
}

export function DecryptedText({
  body,
  bodyIv,
  aesKey,
  isOnlyEmojis,
  renderBodyWithMentions,
  isMe,
}: DecryptedTextProps) {
  const [decryptedText, setDecryptedText] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!bodyIv || !aesKey) {
      setDecryptedText(body) // Not encrypted
      return
    }

    let active = true
    const decrypt = async () => {
      try {
        const plain = await decryptText(body, bodyIv, aesKey)
        if (active) {
          setDecryptedText(plain)
        }
      } catch (err) {
        console.error('Failed to decrypt message body:', err)
        if (active) setError(true)
      }
    }

    decrypt()
    return () => {
      active = false
    }
  }, [body, bodyIv, aesKey])

  if (error) {
    return (
      <p className="text-destructive/80 italic text-xs bg-destructive/5 px-3 py-2 rounded-2xl border border-destructive/10 rounded-tl-none">
        [Encrypted Message - Decryption Failed]
      </p>
    )
  }

  if (decryptedText === null) {
    return (
      <p className="text-xs italic text-muted-foreground animate-pulse px-3 py-2 rounded-2xl bg-muted/40 rounded-tl-none">
        Decrypting message...
      </p>
    )
  }

  return (
    <p
      className={
        isOnlyEmojis(decryptedText)
          ? `text-4xl py-1 select-all break-words leading-none`
          : `text-xs leading-relaxed break-words px-3 py-2 rounded-2xl ${
              isMe
                ? 'bg-foreground text-background rounded-tr-none'
                : 'bg-card text-foreground border border-border/80 rounded-tl-none'
            }`
      }
    >
      {renderBodyWithMentions(decryptedText)}
    </p>
  )
}

interface DecryptedTextInlineProps {
  body?: string
  bodyIv?: string
  aesKey: CryptoKey | null
  fallback?: string
}

export function DecryptedTextInline({
  body,
  bodyIv,
  aesKey,
  fallback = 'Message',
}: DecryptedTextInlineProps) {
  const [decryptedText, setDecryptedText] = useState<string | null>(null)

  useEffect(() => {
    if (!body) {
      setDecryptedText(null)
      return
    }
    if (!bodyIv || !aesKey) {
      setDecryptedText(body)
      return
    }

    let active = true
    const decrypt = async () => {
      try {
        const plain = await decryptText(body, bodyIv, aesKey)
        if (active) {
          setDecryptedText(plain)
        }
      } catch (err) {
        console.error('Failed to decrypt inline:', err)
        if (active) setDecryptedText('[Encrypted]')
      }
    }

    decrypt()
    return () => {
      active = false
    }
  }, [body, bodyIv, aesKey])

  return <span>{decryptedText || fallback}</span>
}
