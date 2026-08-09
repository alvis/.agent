import type { ReactNode } from 'react';

export type InputProps = {
  onClick?: () => void;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function Input(props: InputProps): ReactNode {
  return props.placeholder ?? '';
}
