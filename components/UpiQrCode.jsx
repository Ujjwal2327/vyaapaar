"use client";

/**
 * components/UpiQrCode.jsx
 *
 * Turns any string (in practice, a "upi://pay?..." link from
 * lib/utils/upi.js) into a scannable QR code image using the `qrcode`
 * package. Generation happens entirely client-side inside an effect —
 * never at module scope or during the initial server render — so this is
 * safe to import from a "use client" component without any SSR concerns.
 *
 * Renders as a plain <img src="data:image/png;base64,...">, on purpose,
 * rather than drawing to a <canvas>: it's simpler to keep in sync with a
 * changing `link`, and a plain image is something a phone's browser can
 * long-press-to-save on its own, which a canvas can't do without extra
 * wiring.
 *
 * The quiet-zone margin is left at the library default rather than
 * trimmed down for a tighter visual — this is meant to be scanned by a
 * phone camera, sometimes at an angle or in poor light, so scan
 * reliability wins over a few extra pixels of whitespace.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2, AlertTriangle } from "lucide-react";

export const UpiQrCode = ({ link, size = 220, className = "" }) => {
  const [dataUrl, setDataUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setFailed(false);

    if (!link) return;

    QRCode.toDataURL(link, {
      width: size,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate UPI QR code:", err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [link, size]);

  if (!link) return null;

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-muted-foreground p-3 ${className}`}
        style={{ width: size, height: size }}
      >
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm text-center">Couldn't generate the QR code</p>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border bg-muted/30 ${className}`}
        style={{ width: size, height: size }}
      >
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    // White background regardless of theme — QR scanners rely on strong
    // light/dark contrast, so this shouldn't follow the app into dark mode.
    <img
      src={dataUrl}
      alt="Scan with any UPI app to pay"
      width={size}
      height={size}
      className={`rounded-lg border bg-white p-2 ${className}`}
    />
  );
};
