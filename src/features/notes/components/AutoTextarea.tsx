import { useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from 'react';

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  inputRef?: Ref<HTMLTextAreaElement>;
}

/** A textarea that grows with its content instead of scrolling inside itself. */
export function AutoTextarea({ value, onValueChange, inputRef, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const setRefs = (el: HTMLTextAreaElement | null) => {
    ref.current = el;
    if (typeof inputRef === 'function') inputRef(el);
    else if (inputRef) inputRef.current = el;
  };

  return (
    <textarea
      ref={setRefs}
      rows={1}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      {...rest}
    />
  );
}
