// Barrel scenario: sibling exports both Button AND ButtonProps, but the
// barrel index.ts forgets to re-export ButtonProps — RC-STRUCT-05.
export type ButtonProps = {
  label: string;
};

export const Button = (props: ButtonProps) => <button>{props.label}</button>;
