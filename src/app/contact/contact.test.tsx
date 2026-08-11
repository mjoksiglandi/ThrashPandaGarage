import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CategoryPage } from "@/components/public/CategoryPage";
import { PublicNav } from "@/components/public/PublicNav";
import ContactPage from "./page";
import { submitContactRequest } from "./ContactForm";

describe("public contact and navigation", () => {
  it("renders a validated contact form with optional session and submit action", () => {
    const html = renderToStaticMarkup(<ContactPage />);

    expect(html).toContain('name="name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="sessionType"');
    expect(html).toContain("Tipo de sesión (opcional)");
    expect(html).toContain('name="message"');
    expect(html).toContain('name="website"');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('type="button" class="solid-btn"');
  });

  it("routes public Login controls to the client login", () => {
    const html = renderToStaticMarkup(<PublicNav />);
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/admin/login"');
  });

  it("does not render decorative portfolio filters", () => {
    const html = renderToStaticMarkup(<CategoryPage activeKey="photo" />);
    expect(html).not.toContain('class="filters"');
    expect(html).not.toContain(">Todo<");
  });

  it("maps endpoint success and failures to explicit UI states", async () => {
    const successFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      message: "Enviado",
    }), { status: 201 }));
    await expect(submitContactRequest({}, successFetch)).resolves.toEqual({
      status: "success",
      message: "Enviado",
    });

    const failedFetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    await expect(submitContactRequest({}, failedFetch)).resolves.toMatchObject({
      status: "error",
    });
  });
});
