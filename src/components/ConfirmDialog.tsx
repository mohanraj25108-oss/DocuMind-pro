"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={{
                backgroundColor: destructive ? "#FEF0F0" : "#EEF2FB",
                borderColor: destructive ? "#F7CACA" : "#D6E0F5",
                color: destructive ? "#DC5252" : "#4568C7",
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="text-base font-semibold text-[#111827]"
              >
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#667085]">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md p-1 text-[#667085] hover:bg-[#F3F4F6] hover:text-[#111827]"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{
              backgroundColor: destructive ? "#DC5252" : "#4568C7",
            }}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
