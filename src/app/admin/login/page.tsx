import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginAdmin } from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { FormField } from "@/components/ui/FormField";

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

function resolveClientIp(headerList: Headers) {
  return (
    headerList.get("cf-connecting-ip") ??
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const headerList = await headers();
    const rateLimitKey = `login:${resolveClientIp(headerList)}`;

    if (!checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
      redirect("/admin/login?error=rate_limit");
    }

    const ok = await loginAdmin(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    if (!ok) redirect("/admin/login?error=1");

    resetRateLimit(rateLimitKey);
    redirect("/admin");
  }

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form action={login} className="grid w-full max-w-sm gap-4 rounded-lg border border-zinc-800 bg-[#141417] p-6">
        <div>
          <h1 className="text-2xl font-black">Admin</h1>
          <p className="text-sm text-zinc-500">Trashpanda Garage</p>
        </div>
        {error === "rate_limit" && (
          <p className="text-sm text-red-400">Demasiados intentos. Espera unos minutos e intenta de nuevo.</p>
        )}
        {error === "1" && <p className="text-sm text-red-400">Credenciales invalidas.</p>}
        <FormField label="Email"><input name="email" type="email" required /></FormField>
        <FormField label="Password"><input name="password" type="password" required /></FormField>
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
