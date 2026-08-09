"use client";

import { useEffect, useRef } from "react";

// Replaces window.confirm(). The browser's own box cannot be styled at all, it
// announces the deployment's hostname ("game-little-fox-vp45.vercel.app says"),
// and it looks nothing like the rest of the game — not what a ten-year-old
// should meet mid-lesson.
//
// Built on <dialog> rather than a hand-rolled overlay: the element gives focus
// trapping, Escape to dismiss, the top layer and ::backdrop for free, so there
// is no scroll-locking or z-index bookkeeping to get wrong.

interface Props {
  open: boolean;
  /** Big line, phrased as the question being asked. */
  title: string;
  /** One sentence on what happens if they go ahead. */
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);

  // showModal() is the only way to get the backdrop and the top layer; setting
  // the `open` attribute in JSX would render a non-modal dialog instead.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className="ask"
      ref={ref}
      aria-labelledby="ask-title"
      // fires on Escape and on the backdrop's built-in dismiss
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {/* Only while open: a closed <dialog> keeps its children in the DOM, and
          a question nobody is being asked should not be findable by Ctrl+F or
          readable by a screen reader. */}
      {open && (
        <div className="ask__body">
          <h2 className="ask__title" id="ask-title">
            {title}
          </h2>
          {body && <p className="muted">{body}</p>}

          <div className="btn-row">
            <button className="btn" type="button" onClick={onConfirm}>
              {confirmLabel}
            </button>
            <button
              className="btn btn--secondary"
              type="button"
              onClick={onCancel}
              autoFocus
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
