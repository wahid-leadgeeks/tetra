import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TETRA — Employee Task & Time Tracking Companion",
    short_name: "TETRA",
    description:
      "Lightweight employee task and time tracking companion. Official report is Google Sheets.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#09090b",
    theme_color: "#18181b",
    categories: ["productivity", "business", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Attendance & Timer",
        url: "/timer",
        description: "Clock in, start tasks, or take a break",
      },
      {
        name: "Daily Timeline",
        url: "/timeline",
        description: "View and edit today's tasks and shifts",
      },
      {
        name: "Sync to Sheets",
        url: "/review",
        description: "Review and synchronize to official Google Sheet",
      },
    ],
  };
}
