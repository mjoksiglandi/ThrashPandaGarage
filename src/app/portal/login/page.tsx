import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginStage } from "@/components/auth/LoginStage";
import { loginClient } from "@/lib/client-auth";
import { parseGalleryAccessCode } from "@/lib/gallery-access-code";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { isGalleryAccessible } from "@/modules/galleries/gallery.service";

const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function clientIp(headerList: Headers) {
  return headerList.get("cf-connecting-ip") ?? headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export default async function ClientLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const key = `client-login:${clientIp(await headers())}`;
    if (!checkRateLimit(key, LIMIT, WINDOW_MS)) redirect("/portal/login?error=rate_limit");
    const ok = await loginClient(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    if (!ok) redirect("/portal/login?error=credentials");
    resetRateLimit(key);
    redirect("/portal");
  }

  async function accessWithCode(formData: FormData) {
    "use server";
    const token = parseGalleryAccessCode(String(formData.get("code") ?? ""));
    const gallery = token ? await galleryRepository.findByToken(token) : null;
    if (!gallery || !isGalleryAccessible(gallery)) redirect("/portal/login?error=code");
    redirect(`/g/${encodeURIComponent(token)}`);
  }

  const messages: Record<string, string> = {
    rate_limit: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
    credentials: "Email o contraseña incorrectos.",
    code: "El código de sesión no es válido o ya expiró.",
  };

  return (
    <LoginStage eyebrow="Portal clientes" title="Bienvenido de vuelta." description="Ingresa para ver tus galerías privadas." action={login} error={error ? messages[error] : undefined} submitLabel="Entrar a mis galerías" alternateHref="/admin/login" alternateLabel="Administración">
      <div className="login-divider">o</div>
      <form action={accessWithCode} className="login-code-form">
        <label className="login-field"><span>Código de sesión</span><input name="code" placeholder="Código o enlace de galería" required /></label>
        <button className="login-secondary" type="submit">Acceder con código<span>Incluido en tu correo de entrega</span></button>
      </form>
    </LoginStage>
  );
}
