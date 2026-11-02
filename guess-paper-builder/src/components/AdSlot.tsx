import { useEffect } from "react";

/**
 * Google AdSense slot. Jab tak VITE_ADSENSE_PUBLISHER_ID set na ho, kuch render nahi hota.
 * Approval ke baad .env mein ca-pub-XXXXXXXX daalein.
 */
const PUBLISHER_ID = import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptRequested = false;

export function AdSlot({ id }: { id: string }) {
  useEffect(() => {
    if (!PUBLISHER_ID) return;
    if (!scriptRequested) {
      scriptRequested = true;
      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(PUBLISHER_ID)}`;
      document.head.appendChild(script);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blocker ya script load fail ho to layout nahi todta.
    }
  }, []);

  if (!PUBLISHER_ID) return null;

  return (
    <aside className="ad-slot" data-slot={id} aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={PUBLISHER_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
