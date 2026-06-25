import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertOptions {
  title: string
  description?: string
  actionLabel?: string
}

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface AlertState {
  open: boolean
  title: string
  description?: string
  actionLabel: string
  onAction?: () => void
  isConfirm: boolean
  confirmLabel: string
  cancelLabel: string
  destructive: boolean
  onCancel?: () => void
}

interface AlertContextValue {
  showAlert: (opts: AlertOptions) => Promise<void>
  showConfirm: (opts: ConfirmOptions) => Promise<boolean>
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AlertContext = React.createContext<AlertContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AlertState>({
    open: false,
    title: '',
    description: undefined,
    actionLabel: 'OK',
    onAction: undefined,
    isConfirm: false,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    destructive: false,
    onCancel: undefined,
  })

  const resolveRef = React.useRef<((value: boolean) => void) | null>(null)

  const showAlert = React.useCallback((opts: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolveRef.current = () => { resolve(); }
      setState({
        open: true,
        title: opts.title,
        description: opts.description,
        actionLabel: opts.actionLabel ?? 'OK',
        onAction: undefined,
        isConfirm: false,
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
        destructive: false,
        onCancel: undefined,
      })
    })
  }, [])

  const showConfirm = React.useCallback(
    (opts: ConfirmOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve
        setState({
          open: true,
          title: opts.title,
          description: opts.description,
          actionLabel: opts.confirmLabel ?? 'Confirm',
          onAction: undefined,
          isConfirm: true,
          confirmLabel: opts.confirmLabel ?? 'Confirm',
          cancelLabel: opts.cancelLabel ?? 'Cancel',
          destructive: opts.destructive ?? false,
          onCancel: undefined,
        })
      })
    },
    [],
  )

  const handleAction = () => {
    setState((s) => ({ ...s, open: false }))
    resolveRef.current?.(true)
    resolveRef.current = null
  }

  const handleCancel = () => {
    setState((s) => ({ ...s, open: false }))
    resolveRef.current?.(false)
    resolveRef.current = null
  }

  const ctx = React.useMemo(
    () => ({ showAlert, showConfirm }),
    [showAlert, showConfirm],
  )

  return (
    <AlertContext.Provider value={ctx}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description && (
              <AlertDialogDescription>{state.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            {state.isConfirm && (
              <AlertDialogCancel onClick={handleCancel}>
                {state.cancelLabel}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={handleAction}
              className={
                state.destructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {state.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAlert(): AlertContextValue {
  const ctx = React.useContext(AlertContext)
  if (!ctx) {
    throw new Error('useAlert must be used within <AlertProvider>')
  }
  return ctx
}
