"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheck,
  Info,
  TriangleAlert,
  OctagonAlert,
  Loader2,
  X,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton={true}
      richColors={true}
      gap={14}
      visibleToasts={4}
      icons={{
        success: (
          <div
            data-testid="toast-icon-success"
            className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-300 border border-emerald-300/70 dark:border-emerald-700/60 shadow-xs"
          >
            <CircleCheck className="size-5 stroke-[2.25]" />
          </div>
        ),
        info: (
          <div
            data-testid="toast-icon-info"
            className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-sky-100 text-sky-700 dark:bg-sky-950/90 dark:text-sky-300 border border-sky-300/70 dark:border-sky-700/60 shadow-xs"
          >
            <Info className="size-5 stroke-[2.25]" />
          </div>
        ),
        warning: (
          <div
            data-testid="toast-icon-warning"
            className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-950/90 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60 shadow-xs"
          >
            <TriangleAlert className="size-5 stroke-[2.25]" />
          </div>
        ),
        error: (
          <div
            data-testid="toast-icon-error"
            className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-100 text-rose-700 dark:bg-rose-950/90 dark:text-rose-300 border border-rose-300/70 dark:border-rose-700/60 shadow-xs"
          >
            <OctagonAlert className="size-5 stroke-[2.25]" />
          </div>
        ),
        loading: (
          <div
            data-testid="toast-icon-loading"
            className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/90 dark:text-indigo-300 border border-indigo-300/70 dark:border-indigo-700/60 shadow-xs"
          >
            <Loader2 className="size-5 animate-spin stroke-[2.25]" />
          </div>
        ),
        close: <X className="size-4" />,
      }}
      style={
        {
          "--width": "440px",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          closeButton: "cn-toast-close",
          title: "cn-toast-title",
          description: "cn-toast-description",
          actionButton: "cn-toast-action",
          cancelButton: "cn-toast-cancel",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
