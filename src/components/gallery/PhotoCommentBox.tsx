"use client";

export function PhotoCommentBox({ comment, onChange }: { comment: string; onChange: (comment: string) => void }) {
  return (
    <textarea
      className="mt-2 text-sm"
      rows={2}
      placeholder="Comentario"
      value={comment}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
