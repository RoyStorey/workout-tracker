import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="text-6xl font-extrabold text-accent">404</div>
      <h1 className="mt-2 text-xl font-bold">Nothing here</h1>
      <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist, or it&apos;s private and you need an invite link to see it.</p>
      <Link href="/" className="btn-primary mt-6">Back home</Link>
    </div>
  );
}
