import React, { useEffect, useState, useRef } from "react";

type StartAppItem = {
  Name: string;
  AppID: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (app: StartAppItem) => void;
};

export default function AppPickerModal({ open, onClose, onSelect }: Props) {
  const api = (window as any).api as
    | undefined
    | {
        getStartApps?: () => Promise<StartAppItem[]>;
      };

  const [apps, setApps] = useState<StartAppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApp, setSelectedApp] = useState<StartAppItem | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    
    console.log("AppPickerModal opened, api available:", !!api?.getStartApps);
    
    // Auto-focus search input when modal opens
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    // Fetch apps
    (async () => {
      if (!api?.getStartApps) {
        console.error("getStartApps API not available");
        return;
      }
      setLoading(true);
      console.log("Fetching apps via Get-StartApps...");
      try {
        const fetchedApps = await api.getStartApps();
        console.log(`Fetched ${fetchedApps.length} apps:`, fetchedApps.slice(0, 5));
        setApps(fetchedApps);
      } catch (err) {
        console.error("Failed to fetch apps:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedApp(null);
    }
  }, [open]);

  if (!open) return null;

  const filteredApps = apps.filter((app) =>
    app.Name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleSelectApp(app: StartAppItem) {
    setSelectedApp(app);
    setTimeout(() => {
      onSelect(app);
      onClose();
    }, 200);
  }

  return (
    <div
      className="appPickerOverlay"
      data-wallpaper-interactive
      onClick={onClose}
    >
      <div
        className="appPickerModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="appPickerHeader">
          <div className="appPickerTitle">Select App</div>
          <button className="appPickerCloseBtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <input
          ref={searchInputRef}
          className="appPickerSearch"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search apps..."
        />

        <div className="appPickerBody">
          {loading ? (
            <div className="appPickerLoading">
              <div className="spinner"></div>
              <div>Loading apps...</div>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="appPickerEmpty">
              {searchQuery ? "No apps found" : "No apps available"}
            </div>
          ) : (
            <div className="appPickerGrid">
              {filteredApps.map((app) => (
                <button
                  key={app.AppID}
                  className={[
                    "appPickerItem",
                    selectedApp?.AppID === app.AppID ? "appPickerItemSelected" : ""
                  ].join(" ")}
                  onClick={() => handleSelectApp(app)}
                  title={app.Name}
                >
                  <div className="appPickerIcon">
                    <span className="appPickerIconPlaceholder">📱</span>
                  </div>
                  <div className="appPickerName">{app.Name}</div>
                  {selectedApp?.AppID === app.AppID && (
                    <div className="appPickerCheckmark">✓</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
