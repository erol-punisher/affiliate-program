type Props = {
  className?: string;
};

export function ReleasitLogo({ className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/releasit-logo.svg"
      alt="Releasit"
      className={`h-7 w-auto ${className ?? ""}`}
    />
  );
}
