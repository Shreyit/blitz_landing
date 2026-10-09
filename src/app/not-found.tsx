import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-width page-intro">
      <h1>Out of bounds.</h1>
      <p>That page isn’t on the court.</p>
      <Link href="/" className="button" style={{ marginTop: 25 }}>
        Back to BLITZ
      </Link>
    </div>
  );
}
