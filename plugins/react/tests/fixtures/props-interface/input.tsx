import type { ReactNode } from 'react';

export interface ButtonProps {
  label: string;
}

export type CardProps = {
  title: string;
};

export function Button(props: ButtonProps): ReactNode {
  return props.label;
}
