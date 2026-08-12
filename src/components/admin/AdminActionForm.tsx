"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type AdminActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  buttonClassName?: string;
  children?: ReactNode;
  className?: string;
  confirmMessage?: string;
  disabled?: boolean;
  label: string;
  pendingLabel: string;
};

export function AdminActionForm({
  action,
  buttonClassName,
  children,
  className,
  confirmMessage,
  disabled = false,
  label,
  pendingLabel,
}: AdminActionFormProps) {
  return (
    <form
      action={action}
      className={["admin-action-form", className].filter(Boolean).join(" ")}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <ActionContents buttonClassName={buttonClassName} disabled={disabled} label={label} pendingLabel={pendingLabel}>
        {children}
      </ActionContents>
    </form>
  );
}

function ActionContents({
  buttonClassName,
  children,
  label,
  pendingLabel,
  disabled,
}: Pick<AdminActionFormProps, "buttonClassName" | "children" | "disabled" | "label" | "pendingLabel">) {
  const { pending } = useFormStatus();
  return (
    <fieldset className="contents" disabled={pending || disabled} aria-busy={pending}>
      {children}
      <button className={buttonClassName} type="submit">
        {pending ? pendingLabel : label}
      </button>
    </fieldset>
  );
}
