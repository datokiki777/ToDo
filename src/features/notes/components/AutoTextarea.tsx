import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
}

/** A textarea that grows with its content instead of scrolling inside itself. */
export function AutoTextarea({ value, onValueChange, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      {...rest}
    />
  );
}
