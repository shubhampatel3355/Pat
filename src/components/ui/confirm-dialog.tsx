"use client";

import { Button } from "./button";
import { Modal } from "./overlay";

/** Styled replacement for window.confirm: a small frosted modal with Keep / confirm buttons. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Keep",
  pending,
  tone = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  /** "danger" for removals, "primary" for weighty but constructive steps (approve, disburse). */
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={440}
      stacked
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger-soft" : "primary"} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm leading-5 text-muted">{body}</p>
    </Modal>
  );
}
