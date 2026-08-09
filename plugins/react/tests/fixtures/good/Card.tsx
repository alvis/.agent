import type { ComponentPropsWithoutRef, PropsWithChildren } from 'react';

// Uses `type` (RC-STRUCT-02), `PropsWithChildren` (RC-STRUCT-03), and extends
// `ComponentPropsWithoutRef<'button'>` (RC-STRUCT-04). Should not trigger.
export type CardProps = PropsWithChildren<
  ComponentPropsWithoutRef<'button'> & {
    accent?: string;
  }
>;

export const Card = (props: CardProps) => <button {...props} />;
