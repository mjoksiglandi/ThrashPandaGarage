import Link from "next/link";

export function LoginStage({
  eyebrow,
  title,
  description,
  action,
  error,
  submitLabel,
  alternateHref,
  alternateLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  submitLabel: string;
  alternateHref: string;
  alternateLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="login-stage">
      <div className="login-stage__background" aria-hidden="true" />
      <div className="login-stage__fade" aria-hidden="true" />
      <Link className="login-stage__logo" href="/">TRASHPANDA<span>—</span>GARAGE</Link>
      <section className="login-card">
        <header className="login-card__header">
          <span className="meta">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        <form action={action} className="login-form">
          {error && <p className="login-error" role="alert">{error}</p>}
          <label className="login-field"><span>Email</span><input name="email" type="email" placeholder="tu@email.com" autoComplete="email" required /></label>
          <label className="login-field"><span>Contraseña</span><input name="password" type="password" placeholder="••••••••" autoComplete="current-password" required /></label>
          <button className="login-primary" type="submit">{submitLabel}</button>
        </form>
        {children}
        <footer className="login-card__footer"><Link href={alternateHref}>{alternateLabel}</Link> · <Link href="/contact">Necesito ayuda</Link></footer>
      </section>
      <span className="login-stage__copyright">© 2026 Trashpanda Garage</span>
    </main>
  );
}
