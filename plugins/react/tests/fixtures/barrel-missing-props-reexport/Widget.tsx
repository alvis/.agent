import type { ReactNode } from 'react';

export type WidgetProps = {
  title: string;
};

export function Widget(props: WidgetProps): ReactNode {
  return props.title;
}
