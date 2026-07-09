import { redirect } from "next/navigation";
import { loginAdmin } from "@/lib/auth";
import { FormField } from "@/components/ui/FormField";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  async function login(formData: FormData) {
    "use server";
    const ok = await loginAdmin(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    if (!ok) redirect("/admin/login?error=1");
    redirect("/admin");
  }

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form action={login} className="grid w-full max-w-sm gap-4 rounded-lg border border-zinc-800 bg-[#141417] p-6">
        <div>
          <h1 className="text-2xl font-black">Admin</h1>
          <p className="text-sm text-zinc-500">Trashpanda Garage</p>
        </div>
        <FormField label="Email"><input name="email" type="email" required /></FormField>
        <FormField label="Password"><input name="password" type="password" required /></FormField>
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
