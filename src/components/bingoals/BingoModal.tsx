import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function BingoModal({ open, title, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const el = dialogRef.current;
      if (!el) return;
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable[0]?.focus();

      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") { onClose(); return; }
        if (e.key === "Tab") {
          const focusableList = Array.from(
            el!.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          );
          const first = focusableList[0];
          const last = focusableList[focusableList.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
          } else {
            if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
          }
        }
      }

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="bingo-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bingo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bingo-modal-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bingo-modal-header">
          <span className="bingo-modal-title" id="bingo-modal-title">{title}</span>
          <button className="btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="bingo-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
