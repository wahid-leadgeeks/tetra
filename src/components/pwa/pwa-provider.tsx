"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaContextValue {
  isSupported: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  isRegistered: boolean;
  promptInstall: () => Promise<boolean>;
}

// Standalone mode external store
function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.addEventListener("change", callback);
  return () => {
    mediaQuery.removeEventListener("change", callback);
  };
}

function getStandaloneSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandaloneMedia || isIosStandalone;
}

function getServerStandaloneSnapshot(): boolean {
  return false;
}

// Install prompt external store
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptSubscribers() {
  for (const listener of promptListeners) {
    listener();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyPromptSubscribers();
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    notifyPromptSubscribers();
    toast.success("TETRA installed as standalone app!");
  });
}

function subscribePrompt(callback: () => void) {
  promptListeners.add(callback);
  return () => {
    promptListeners.delete(callback);
  };
}

function getPromptSnapshot(): BeforeInstallPromptEvent | null {
  return globalDeferredPrompt;
}

function getServerPromptSnapshot(): BeforeInstallPromptEvent | null {
  return null;
}

const PwaContext = createContext<PwaContextValue>({
  isSupported: false,
  isInstalled: false,
  canInstall: false,
  isRegistered: false,
  promptInstall: async () => false,
});

export function PwaProvider({ children }: { children: ReactNode }) {
  const [isRegistered, setIsRegistered] = useState(false);

  const isInstalled = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getServerStandaloneSnapshot,
  );

  const deferredPrompt = useSyncExternalStore(
    subscribePrompt,
    getPromptSnapshot,
    getServerPromptSnapshot,
  );

  const isSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        setIsRegistered(true);
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                toast.info("A new version of TETRA is available.", {
                  action: {
                    label: "Reload",
                    onClick: () => {
                      installingWorker.postMessage({ type: "SKIP_WAITING" });
                      window.location.reload();
                    },
                  },
                });
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration skipped or failed:", err);
      });
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        globalDeferredPrompt = null;
        notifyPromptSubscribers();
        return true;
      }
      return false;
    } catch (err) {
      console.error("[PWA] Error triggering install prompt:", err);
      return false;
    }
  }, [deferredPrompt]);

  return (
    <PwaContext.Provider
      value={{
        isSupported,
        isInstalled,
        canInstall: !!deferredPrompt && !isInstalled,
        isRegistered,
        promptInstall,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  return useContext(PwaContext);
}
