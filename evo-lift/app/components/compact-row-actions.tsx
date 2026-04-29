"use client";

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
    "inline-flex h-8 w-24 items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-sky-300 hover:bg-zinc-100";

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSave} className={buttonClass}>
          {saveLabel}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass}>
          {cancelLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onEdit} className={buttonClass}>
        {editLabel}
      </button>
      {showSecondary && onSecondary ? (
        <button type="button" onClick={onSecondary} className={buttonClass}>
          {secondaryLabel}
        </button>
      ) : null}
    </div>
  );
}
