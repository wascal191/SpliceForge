"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem = {
  label: string;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
};

type Props = {
  items: ContextMenuItem[];
  children: (open: (e: React.MouseEvent) => void) => ReactNode;
};

export function ContextMenu({ items, children }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!pos) return;
    function close(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPos(null);
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("contextmenu", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("contextmenu", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  return (
    <>
      {children(open)}
      {pos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onMouseDown={() => setPos(null)} />
          <div
            ref={ref}
            className="fixed z-[9999] min-w-[170px] rounded-md border bg-popover text-popover-foreground shadow-md py-1 text-xs"
            style={{ left: pos.x, top: pos.y }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {items.map((it, i) => (
              <div key={i}>
                {it.separatorBefore && <div className="my-1 h-px bg-border" />}
                <button
                  disabled={it.disabled}
                  className={
                    "w-full text-left px-3 py-1.5 outline-none " +
                    (it.disabled
                      ? "opacity-40 cursor-not-allowed "
                      : "hover:bg-accent cursor-pointer ") +
                    (it.destructive ? "text-destructive " : "")
                  }
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (it.disabled) return;
                    setPos(null);
                    await it.onSelect();
                  }}
                >
                  {it.label}
                </button>
              </div>
            ))}
          </div>
          </>,
          document.body
        )}
    </>
  );
}
