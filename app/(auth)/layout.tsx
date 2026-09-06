export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh grid place-items-center p-4">{children}</main>
  );
}
