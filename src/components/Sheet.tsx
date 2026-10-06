import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLanguageStore } from "../store/useLanguageStore";
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ar = useLanguageStore((s) => s.lang === "ar");
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-body">
        <header className="section-head">
          <h2>{title}</h2>
          <button aria-label={ar ? "إغلاق" : "Close"} onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
