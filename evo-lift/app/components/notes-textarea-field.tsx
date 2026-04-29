"use client";

type NotesTextareaFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  heightClassName?: string;
};

export function NotesTextareaField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  heightClassName = "h-24",
}: NotesTextareaFieldProps) {
  return (
    <label className="block text-sm font-medium">
      {label ? label : null}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm ${heightClassName}`}
        maxLength={maxLength}
        placeholder={placeholder}
      />
      <p className="mt-1 text-xs text-zinc-500">
        {value.length}/{maxLength}
      </p>
    </label>
  );
}
