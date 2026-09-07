"use client";

import React, { createContext, useContext, useState } from "react";
import { GuideTourDialog } from "@/components/guide-tour/guide-tour-dialog";
import { GuideTourSpotlight } from "@/components/guide-tour/guide-tour-spotlight";

interface TourContextType {
  openTour: () => void;
  openSummary: () => void;
  closeTour: () => void;
  isOpen: boolean;
}

const TourContext = createContext<TourContextType>({
  openTour: () => {},
  openSummary: () => {},
  closeTour: () => {},
  isOpen: false,
});

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <TourContext.Provider
      value={{
        openTour: () => {
          setSummaryOpen(false);
          setSpotlightOpen(true);
        },
        openSummary: () => {
          setSpotlightOpen(false);
          setSummaryOpen(true);
        },
        closeTour: () => {
          setSpotlightOpen(false);
          setSummaryOpen(false);
        },
        isOpen: spotlightOpen || summaryOpen,
      }}
    >
      {children}
      <GuideTourSpotlight
        open={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
      />
      <GuideTourDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
      />
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}
