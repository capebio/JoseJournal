import { useEffect, useRef } from 'react';

/** A textarea that grows to fit its content (one line minimum). Ports the
 *  prototype's AutoTextarea — the editor segments must not show inner scrollbars.
 *  `onFocusNode` hands the live DOM node to the parent so the toolbar can insert
 *  citation tokens / wrap italics at the caret (§5.3 token-insertion engine). */
export function AutoTextarea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  onFocusNode,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  onFocusNode?: (el: HTMLTextAreaElement) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  };
  useEffect(grow, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      rows={1}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onInput={grow}
      onFocus={onFocusNode ? () => ref.current && onFocusNode(ref.current) : undefined}
    />
  );
}
