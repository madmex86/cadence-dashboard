"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./ScannerModal.module.css";

const SCANNER_EL_ID = "cc-scanner-viewfinder";

// Reusable barcode / QR scanner modal.
// Parent passes isOpen + onScan(decodedText) callback — all business logic lives
// in the caller. This component only handles camera lifecycle and code detection.
export default function ScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scan Code",
  hint,
  mode = "qr", // "qr" | "barcode" | "any"
}) {
  const [status, setStatus] = useState("idle"); // idle | starting | scanning | error | success
  const [errorMsg, setErrorMsg] = useState("");
  const [lastScan, setLastScan] = useState(null);
  const scannerRef = useRef(null);
  const cooldownRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }
    startScanner();
    return () => stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function startScanner() {
    setStatus("starting");
    setErrorMsg("");
    setLastScan(null);
    cooldownRef.current = false;

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      const formatsToSupport =
        mode === "barcode"
          ? [
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
            ]
          : mode === "qr"
          ? [Html5QrcodeSupportedFormats.QR_CODE]
          : undefined;

      const initConfig = formatsToSupport ? { formatsToSupport } : {};
      const qr = new Html5Qrcode(SCANNER_EL_ID, initConfig);

      if (!mountedRef.current) return;
      scannerRef.current = qr;

      const qrboxFn = (viewW, viewH) => {
        if (mode === "barcode") {
          // Wide rectangular box for 1-D barcodes
          return { width: Math.min(viewW * 0.88, 320), height: Math.min(viewH * 0.3, 100) };
        }
        const side = Math.min(viewW * 0.72, 260);
        return { width: side, height: side };
      };

      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: qrboxFn },
        (decodedText) => {
          if (!mountedRef.current || cooldownRef.current) return;
          cooldownRef.current = true;
          setLastScan(decodedText);
          setStatus("success");
          onScan(decodedText);
          // 2-second cooldown then allow next scan
          setTimeout(() => {
            if (mountedRef.current) {
              cooldownRef.current = false;
              setLastScan(null);
              setStatus("scanning");
            }
          }, 2000);
        },
        () => {} // per-frame misses are normal — suppress
      );

      if (mountedRef.current) setStatus("scanning");
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("error");
      const msg = err?.message || "";
      if (err?.name === "NotAllowedError" || msg.includes("permission")) {
        setErrorMsg(
          "Camera access was denied. Open your browser settings, allow the camera for this site, then try again."
        );
      } else if (msg.includes("not found") || msg.includes("Could not start")) {
        setErrorMsg("No camera found on this device.");
      } else {
        setErrorMsg(msg || "Camera failed to start.");
      }
    }
  }

  async function stopScanner() {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch {}
    scannerRef.current = null;
    if (mountedRef.current) setStatus("idle");
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close scanner">
            ✕
          </button>
        </div>

        {hint && <p className={styles.hint}>{hint}</p>}

        {/* Camera viewfinder */}
        <div className={styles.viewfinder}>
          <div id={SCANNER_EL_ID} />
          {status === "scanning" && <div className={styles.scanLine} aria-hidden="true" />}
          {status === "starting" && (
            <div className={styles.startingOverlay}>
              <div className={styles.spinner} />
              <span>Requesting camera…</span>
            </div>
          )}
        </div>

        {/* Status messages */}
        {status === "error" && (
          <div className={styles.errorBox}>
            <strong>Camera unavailable</strong>
            <br />
            {errorMsg}
          </div>
        )}

        {status === "success" && lastScan && (
          <div className={styles.successBanner}>
            <span className={styles.tick}>✓</span>
            <span className={styles.scannedText}>{lastScan}</span>
          </div>
        )}

        {status === "scanning" && (
          <p className={styles.scanningHint}>
            {mode === "barcode" ? "Point at the UPC/barcode" : "Point at the QR code"} — it scans automatically
          </p>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
