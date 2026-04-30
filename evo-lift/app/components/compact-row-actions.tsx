"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";

type CompactRowActionsProps = {
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
  showSecondary?: boolean;
  editLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
};

export function CompactRowActions({
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onSecondary,
  secondaryLabel = "Delete",
  showSecondary = true,
  editLabel = "Edit",
  saveLabel = "Save",
  cancelLabel = "Cancel",
}: CompactRowActionsProps) {
  const buttonClass =
    "inline-flex h-8 w-[72px] sm:w-20 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100";

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSave} className={buttonClass}>
          <Check className="h-3 w-3 text-emerald-600" />
          {saveLabel}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass}>
          <X className="h-3 w-3 text-zinc-500" />
          {cancelLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {showSecondary && onSecondary ? (
        <button type="button" onClick={onSecondary} className={buttonClass}>
          <Trash2 className="h-3 w-3 text-red-600" />
          {secondaryLabel}
        </button>
      ) : null}
      <button type="button" onClick={onEdit} className={buttonClass}>
        <Pencil className="h-3 w-3 text-sky-700" />
        {editLabel}
      </button>
    </div>
  );
}
