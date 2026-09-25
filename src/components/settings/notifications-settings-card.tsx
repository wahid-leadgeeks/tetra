"use client";

import { useState } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Download,
  Info,
  Laptop,
  Loader2,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { usePwa } from "@/components/pwa/pwa-provider";
import { useNotifications } from "@/features/notifications/store";

export function NotificationsSettingsCard() {
  const {
    browserAlertsEnabled,
    permission,
    requestPermission,
    toggleBrowserAlerts,
    sendTestNotification,
  } = useNotifications();

  const { isInstalled, canInstall, promptInstall } = usePwa();
  const [testing, setTesting] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleTestAlert = () => {
    setTesting(true);
    sendTestNotification();
    toast.success("Test notification dispatched!", {
      description: "If allowed, you will see a system alert on your screen.",
    });
    setTimeout(() => setTesting(false), 1000);
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const accepted = await promptInstall();
      if (accepted) {
        toast.success("Installation accepted! TETRA is now installing.");
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Card className="shadow-xs border-border/80" data-testid="notifications-settings-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BellRing className="size-4.5 text-primary" />
              Notifications &amp; Companion App
            </CardTitle>
            <CardDescription>
              Configure system alerts, background reminders, and offline PWA capabilities.
            </CardDescription>
          </div>
          {permission === "granted" ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="size-3" />
              Allowed
            </Badge>
          ) : permission === "denied" ? (
            <Badge
              variant="outline"
              className="gap-1 border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            >
              <XCircle className="size-3" />
              Blocked
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              <Info className="size-3" />
              Not Configured
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Permission & Alerts Toggle */}
        <div className="flex flex-col gap-4 rounded-lg border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Desktop &amp; Mobile Notifications
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Receive notifications for timer milestones, break reminders, and sync notices even when TETRA is running in another tab.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {permission === "default" ? (
              <Button
                size="sm"
                className="gap-1.5 cursor-pointer"
                onClick={() => void requestPermission()}
                data-testid="enable-notifications-btn"
              >
                <Bell className="size-3.5" />
                Enable Alerts
              </Button>
            ) : permission === "denied" ? (
              <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Blocked in browser settings
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <Switch
                  id="browser-alerts-switch"
                  checked={browserAlertsEnabled}
                  onCheckedChange={() => void toggleBrowserAlerts()}
                  data-testid="browser-alerts-toggle"
                />
              </div>
            )}
          </div>
        </div>

        {permission === "denied" && (
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3 text-xs text-rose-700 dark:text-rose-300">
            <Info className="size-4 shrink-0 mt-0.5" />
            <p>
              Notifications are currently blocked by your browser. To receive alerts, click the lock or site settings icon next to the URL in your browser bar and set Notifications to <strong>Allow</strong>.
            </p>
          </div>
        )}

        {/* Test Notification Action */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">Test System Alert</p>
            <p className="text-[11px] text-muted-foreground">
              Send an immediate test alert to verify notification delivery on this device.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestAlert}
            disabled={testing || permission !== "granted"}
            className="gap-1.5 shrink-0 cursor-pointer"
            data-testid="send-test-notification-btn"
          >
            {testing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Send Test Alert
          </Button>
        </div>

        <Separator />

        {/* PWA / Standalone Installation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Laptop className="size-4 text-muted-foreground" />
                Progressive Web App (PWA)
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Install TETRA on your desktop or mobile home screen for standalone windowing, offline tracking resilience, and quick task launching.
              </p>
            </div>
            {isInstalled ? (
              <Badge
                variant="outline"
                className="gap-1 border-primary/30 bg-primary/10 text-primary shrink-0"
              >
                <CheckCircle2 className="size-3" />
                Installed
              </Badge>
            ) : null}
          </div>

          {canInstall ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  Install App Available
                </p>
                <p className="text-xs text-muted-foreground">
                  Ready to add to your applications folder or desktop dock.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleInstall}
                disabled={installing}
                className="gap-1.5 shrink-0 cursor-pointer"
                data-testid="install-pwa-btn"
              >
                {installing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Install TETRA
              </Button>
            </div>
          ) : isInstalled ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              TETRA is running in standalone companion mode. Offline task caching and notification routing are actively enabled.
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How to install manually:</p>
              <p>• <strong>Chrome / Edge / Brave:</strong> Click the install icon in your browser address bar (⊕ or laptop icon) or menu → &quot;Install TETRA&quot;.</p>
              <p>• <strong>Safari on iOS / iPadOS:</strong> Tap the Share button (⎋) and select &quot;Add to Home Screen&quot;.</p>
              <p>• <strong>Safari on macOS:</strong> Select File → &quot;Add to Dock...&quot;.</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Notification Types Breakdown */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Included Companion Alerts
          </p>
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <div className="flex items-start gap-2 rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-base leading-none">⏱️</span>
              <div>
                <p className="font-medium text-foreground">Long-running Timers</p>
                <p className="text-[11px] text-muted-foreground">
                  Alerts if a task timer runs continuously past 90 minutes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-base leading-none">☕</span>
              <div>
                <p className="font-medium text-foreground">Extended Breaks</p>
                <p className="text-[11px] text-muted-foreground">
                  Reminds you to resume work after a 45–60 minute break.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-base leading-none">📊</span>
              <div>
                <p className="font-medium text-foreground">Shift &amp; Sheet Sync</p>
                <p className="text-[11px] text-muted-foreground">
                  End of day reminder to review tasks and sync to official sheet.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-border/50 bg-background/50 p-2.5">
              <span className="text-base leading-none">📅</span>
              <div>
                <p className="font-medium text-foreground">Calendar Gaps</p>
                <p className="text-[11px] text-muted-foreground">
                  Surfaces unlogged scheduled meetings and timeline gaps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
