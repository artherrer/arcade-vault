import Link from "next/link";

export default function NotFound() {
  return (
    <section className="av-hero fade-in">
      <h1 className="flicker">GAME OVER · 404</h1>
      <div className="sub mb-8">
        ESTE CARTUCHO NO EXISTE EN EL VAULT <span className="blink">_</span>
      </div>
      <Link href="/" className="btn lg">
        VOLVER AL VAULT
      </Link>
    </section>
  );
}
