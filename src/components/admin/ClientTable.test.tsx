import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BulkInvitationFeedback } from "./ClientTable";

describe("BulkInvitationFeedback", () => {
  it("renders summary and per-client feedback", () => {
    const html = renderToStaticMarkup(
      <BulkInvitationFeedback
        state={{
          status: "complete",
          invited: 1,
          resent: 1,
          skipped: 1,
          failed: 1,
          items: [
            { clientId: "1", clientName: "Ana", outcome: "INVITED", message: "Invitación enviada." },
            { clientId: "2", clientName: "Beto", outcome: "SKIPPED_ACTIVE", message: "Omitido: la cuenta ya está activa." },
            { clientId: "3", clientName: "Cata", outcome: "FAILED", message: "Falló el envío. Puedes reintentar este cliente." },
          ],
        }}
      />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("1 enviada · 1 reenviada · 1 omitida · 1 fallida");
    expect(html).toContain("Ana:");
    expect(html).toContain("cuenta ya está activa");
    expect(html).toContain("Puedes reintentar");
  });
});
