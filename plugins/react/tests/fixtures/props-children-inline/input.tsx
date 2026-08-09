import type { ReactNode } from 'react';

export type PanelProps = {
  children: ReactNode;
  title: string;
};

export type BadgeProps = {
  children?: React.ReactNode;
  tone: 'info' | 'warn';
};

export function Panel(props: PanelProps): ReactNode {
  return props.title;
}
