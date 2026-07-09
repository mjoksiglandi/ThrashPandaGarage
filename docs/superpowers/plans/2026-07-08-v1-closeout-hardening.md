# V1 Closeout & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining V1 gaps in Trashpanda Garage (Next.js/Prisma monolith) and harden it — fix the photo IDOR, sign the admin session cookie, rate-limit login, add a CSV export, enforce a delivery-URL guard, extract the spec's suggested components, harden Docker/Compose, and add Vitest coverage for the most fragile business logic.

**Architecture:** No architectural changes. This is a series of surgical fixes and refactors inside the existing modular monolith (`src/modules/*` services/repositories, `src/app/**` routes, `src/components/**` UI). Business logic that needs to be unit-testable without a database is extracted into small pure functions.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma 6 + PostgreSQL, Tailwind 4, Zod 4, Nodemailer 7, bcryptjs, Vitest (new).

## Global Constraints

- Do not change the Prisma schema (`prisma/schema.prisma`) — it already matches spec.
- Do not add `middleware.ts` — admin access control stays as `AdminShell` + `requireAdmin()`.
- No new rate-limiting/Redis dependency — in-memory state is correct for a single-instance deployment.
- No JWT library — session cookie is signed with HMAC-SHA256 using `AUTH_SECRET` (must be ≥ 32 characters).
- Componentization tasks are pure refactors — no visible behavior may change.
- Corrected email subject, verbatim: `Tu galería está lista — Trashpanda Garage`
- CSV export columns, verbatim header: `filename,baseName,comment`
- Login rate limit: max 5 failed attempts per IP per 15-minute window (`15 * 60 * 1000` ms).
- Test framework: Vitest, config at repo root, tests colocated as `*.test.ts` next to source.
- All existing repo paths use the `@/*` → `./src/*` alias (see `tsconfig.json:26-28`).

---

### Task 1: Vitest test harness setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/tokens.test.ts`

**Interfaces:**
- Consumes: `slugify` from `src/lib/tokens.ts` (already exists, pure function, no DB).
- Produces: working `npm test` command any later task's test files can rely on; `vitest.config.ts` alias resolution for `@/*`.

- [ ] **Step 1: Install Vitest**

Run: `npm install --save-dev vitest`

This adds a `vitest` entry to `devDependencies` in `package.json` automatically — do not hand-edit the version.

- [ ] **Step 2: Add the `test` script**

Edit `package.json`, inside `"scripts"` add a `test` entry right after `"lint"`:

```json
    "lint": "next lint",
    "test": "vitest run",
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts` at the repo root:

```ts
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Write a real smoke test for the existing `slugify` helper**

Create `src/lib/tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { slugify } from "./tokens";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Karim — Misato Evangelion")).toBe("karim-misato-evangelion");
  });

  it("strips accents", () => {
    expect(slugify("Selección Cliente")).toBe("seleccion-cliente");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Hola Mundo--  ")).toBe("hola-mundo");
  });
});
```

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: all 3 tests in `src/lib/tokens.test.ts` PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/tokens.test.ts
git commit -m "test: add vitest harness with a smoke test for slugify"
```

---

### Task 2: Sign the admin session cookie with HMAC

**Files:**
- Create: `src/lib/session-token.ts`
- Test: `src/lib/session-token.test.ts`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/auth.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: `signSessionValue(userId: string, secret: string): string` and `verifySessionValue(rawValue: string | undefined, secret: string): string | null`, consumed by `src/lib/auth.ts`.
- Produces: `env.AUTH_SECRET` becomes a required, validated string (min 32 chars) instead of optional.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/session-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signSessionValue, verifySessionValue } from "./session-token";

const SECRET = "a".repeat(32);

describe("session-token", () => {
  it("round-trips a signed value", () => {
    const signed = signSessionValue("user_123", SECRET);
    expect(verifySessionValue(signed, SECRET)).toBe("user_123");
  });

  it("rejects a tampered userId", () => {
    const signed = signSessionValue("user_123", SECRET);
    const [, signature] = signed.split(".");
    const tampered = `user_999.${signature}`;
    expect(verifySessionValue(tampered, SECRET)).toBeNull();
  });

  it("rejects a value signed with a different secret", () => {
    const signed = signSessionValue("user_123", SECRET);
    expect(verifySessionValue(signed, "b".repeat(32))).toBeNull();
  });

  it("rejects a malformed value with no signature", () => {
    expect(verifySessionValue("user_123", SECRET)).toBeNull();
  });

  it("rejects an undefined value", () => {
    expect(verifySessionValue(undefined, SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- session-token`
Expected: FAIL with "Cannot find module './session-token'" (file doesn't exist yet).

- [ ] **Step 3: Implement the signing helpers**

Create `src/lib/session-token.ts`:

```ts
import crypto from "crypto";

export function signSessionValue(userId: string, secret: string): string {
  const signature = crypto.createHmac("sha256", secret).update(userId).digest("base64url");
  return `${userId}.${signature}`;
}

export function verifySessionValue(rawValue: string | undefined, secret: string): string | null {
  if (!rawValue) return null;
  const separatorIndex = rawValue.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const userId = rawValue.slice(0, separatorIndex);
  const signature = rawValue.slice(separatorIndex + 1);
  const expectedSignature = crypto.createHmac("sha256", secret).update(userId).digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  return userId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- session-token`
Expected: PASS (5/5).

- [ ] **Step 5: Make `AUTH_SECRET` required in env validation**

Edit `src/lib/env.ts`, replace:

```ts
  AUTH_SECRET: z.string().optional(),
```

with:

```ts
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters long"),
```

- [ ] **Step 6: Wire the signed cookie into `auth.ts`**

Replace the full contents of `src/lib/auth.ts` with:

```ts
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { signSessionValue, verifySessionValue } from "@/lib/session-token";

const cookieName = "tpg_admin";

export async function loginAdmin(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return false;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return false;

  const jar = await cookies();
  jar.set(cookieName, signSessionValue(user.id, env.AUTH_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return true;
}

export async function logoutAdmin() {
  const jar = await cookies();
  jar.delete(cookieName);
}

export async function getCurrentAdmin() {
  const jar = await cookies();
  const userId = verifySessionValue(jar.get(cookieName)?.value, env.AUTH_SECRET);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
```

- [ ] **Step 7: Document the new required variable**

Edit `.env.example`, add after the `DATABASE_URL` line:

```env
DATABASE_URL="postgresql://trashpanda:trashpanda_password@localhost:5432/trashpanda"

AUTH_SECRET=""
```

Edit `README.md`, in the "Desarrollo local" numbered list, replace step 2:

```md
2. Ajusta `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `PHOTO_STORAGE_ROOT`.
```

with:

```md
2. Ajusta `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `PHOTO_STORAGE_ROOT`.
3. Genera un `AUTH_SECRET` de al menos 32 caracteres, por ejemplo con `openssl rand -base64 32`, y pegalo en `.env`.
```

(Renumber the remaining list items below it by one.)

- [ ] **Step 8: Verify the app still boots with a real secret set**

Run: `echo AUTH_SECRET=$(openssl rand -base64 32) >> .env` (only if `.env` exists locally; otherwise create it from `.env.example` first and fill in `DATABASE_URL`).
Run: `npm test`
Expected: all existing tests still PASS (env parsing happens at import time in some modules — a full `npm run build` is a stronger check if available, but `npm test` is enough to confirm nothing else broke at this step).

- [ ] **Step 9: Commit**

```bash
git add src/lib/session-token.ts src/lib/session-token.test.ts src/lib/env.ts src/lib/auth.ts .env.example README.md
git commit -m "fix: sign admin session cookie with HMAC using AUTH_SECRET"
```

---

### Task 3: Rate-limit the admin login

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `src/lib/rate-limit.test.ts`
- Modify: `src/app/admin/login/page.tsx`

**Interfaces:**
- Produces: `checkRateLimit(key: string, limit: number, windowMs: number, now?: number): boolean` and `resetRateLimit(key: string): void`, consumed by `src/app/admin/login/page.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/rate-limit.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimit("test-key");
  });

  it("allows up to the limit within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("test-key", 5, 1000, 0)).toBe(true);
    }
  });

  it("blocks once the limit is exceeded", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("test-key", 5, 1000, 0);
    expect(checkRateLimit("test-key", 5, 1000, 500)).toBe(false);
  });

  it("resets once the window elapses", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("test-key", 5, 1000, 0);
    expect(checkRateLimit("test-key", 5, 1000, 1500)).toBe(true);
  });

  it("keeps separate buckets per key", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("test-key", 5, 1000, 0);
    expect(checkRateLimit("other-key", 5, 1000, 0)).toBe(true);
  });

  it("resetRateLimit clears the bucket immediately", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("test-key", 5, 1000, 0);
    resetRateLimit("test-key");
    expect(checkRateLimit("test-key", 5, 1000, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- rate-limit`
Expected: FAIL with "Cannot find module './rate-limit'".

- [ ] **Step 3: Implement the in-memory rate limiter**

Create `src/lib/rate-limit.ts`:

```ts
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- rate-limit`
Expected: PASS (5/5).

- [ ] **Step 5: Wire rate limiting and error display into the login page**

Replace the full contents of `src/app/admin/login/page.tsx` with:

```tsx
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
```

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`, open `/admin/login`, submit 6 wrong-password attempts in a row.
Expected: after the 5th failed attempt, the 6th redirects with `?error=rate_limit` and shows "Demasiados intentos...". A correct login afterward (once the window resets, or from a different IP in dev this will normally be `unknown` so wait out the window) succeeds and lands on `/admin`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts src/app/admin/login/page.tsx
git commit -m "feat: rate-limit admin login attempts per IP"
```

---

### Task 4: Fix the photo IDOR and centralize gallery-access checks

**Files:**
- Modify: `src/modules/galleries/gallery.service.ts`
- Modify: `src/app/g/[token]/page.tsx`
- Modify: `src/modules/selections/selection.service.ts`
- Create: `src/modules/photos/photo-access.service.ts`
- Test: `src/modules/photos/photo-access.service.test.ts`
- Test: `src/modules/galleries/gallery.service.test.ts`
- Modify: `src/app/api/photos/[id]/route.ts`

**Interfaces:**
- Consumes: `getCurrentAdmin` from `src/lib/auth.ts` (Task 2, unchanged signature).
- Produces: `isGalleryAccessible(gallery: { status: GalleryStatus; expiresAt: Date | null }): boolean` from `src/modules/galleries/gallery.service.ts`, consumed by `selection.service.ts`, `g/[token]/page.tsx`, and `photo-access.service.ts`.
- Produces: `canServePhoto(gallery: { status: GalleryStatus; expiresAt: Date | null; accessToken: string }, options: { isAdmin: boolean; token: string | null }): boolean` from `src/modules/photos/photo-access.service.ts`, consumed by `src/app/api/photos/[id]/route.ts`.

- [ ] **Step 1: Write the failing test for `isGalleryAccessible`**

Create `src/modules/galleries/gallery.service.test.ts`:

```ts
import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isGalleryAccessible } from "./gallery.service";

describe("isGalleryAccessible", () => {
  it("rejects archived galleries", () => {
    expect(isGalleryAccessible({ status: GalleryStatus.ARCHIVED, expiresAt: null })).toBe(false);
  });

  it("rejects expired galleries", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: yesterday })).toBe(false);
  });

  it("allows active galleries with no expiry", () => {
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: null })).toBe(true);
  });

  it("allows active galleries with a future expiry", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isGalleryAccessible({ status: GalleryStatus.PROOFING, expiresAt: tomorrow })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- gallery.service`
Expected: FAIL — `isGalleryAccessible` is not exported yet.

- [ ] **Step 3: Add `isGalleryAccessible` to `gallery.service.ts`**

Edit `src/modules/galleries/gallery.service.ts`, add this export right after the imports (before `cleanGalleryForm`):

```ts
export function isGalleryAccessible(gallery: { status: GalleryStatus; expiresAt: Date | null }): boolean {
  if (gallery.status === GalleryStatus.ARCHIVED) return false;
  if (gallery.expiresAt && gallery.expiresAt < new Date()) return false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- gallery.service`
Expected: PASS (4/4).

- [ ] **Step 5: Use `isGalleryAccessible` in the private gallery page**

Edit `src/app/g/[token]/page.tsx`, replace:

```tsx
import { GalleryStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { ClientGallery } from "@/components/gallery/ClientGallery";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export const dynamic = "force-dynamic";

export default async function PrivateGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gallery = await galleryRepository.findByToken(token);
  if (!gallery || gallery.status === GalleryStatus.ARCHIVED) notFound();
  if (gallery.expiresAt && gallery.expiresAt < new Date()) notFound();
```

with:

```tsx
import { GalleryStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { ClientGallery } from "@/components/gallery/ClientGallery";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { isGalleryAccessible } from "@/modules/galleries/gallery.service";

export const dynamic = "force-dynamic";

export default async function PrivateGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gallery = await galleryRepository.findByToken(token);
  if (!gallery || !isGalleryAccessible(gallery)) notFound();
```

Further down in the same file, update the photo URL mapping to include the gallery token (needed for Step 8's IDOR fix), replacing:

```tsx
        thumbUrl: `/api/photos/${photo.id}?variant=thumb`,
        previewUrl: `/api/photos/${photo.id}?variant=preview`,
```

with:

```tsx
        thumbUrl: `/api/photos/${photo.id}?variant=thumb&token=${token}`,
        previewUrl: `/api/photos/${photo.id}?variant=preview&token=${token}`,
```

- [ ] **Step 6: Use `isGalleryAccessible` in `selection.service.ts`**

Edit `src/modules/selections/selection.service.ts`, replace:

```ts
import { GalleryStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { selectionSchema } from "@/lib/validators";
import { markSelectionConfirmed } from "@/modules/galleries/gallery.service";
import { selectionRepository } from "./selection.repository";

export async function updateSelectionFromClient(accessToken: string, input: unknown) {
  const parsed = selectionSchema.parse(input);
  const gallery = await db.gallery.findUnique({
    where: { accessToken },
    include: { photos: true, selections: true },
  });
  if (!gallery || gallery.status === GalleryStatus.ARCHIVED) throw new Error("Gallery not available");
  if (gallery.expiresAt && gallery.expiresAt < new Date()) throw new Error("Gallery expired");
```

with:

```ts
import { db } from "@/lib/db";
import { selectionSchema } from "@/lib/validators";
import { isGalleryAccessible, markSelectionConfirmed } from "@/modules/galleries/gallery.service";
import { selectionRepository } from "./selection.repository";

export async function updateSelectionFromClient(accessToken: string, input: unknown) {
  const parsed = selectionSchema.parse(input);
  const gallery = await db.gallery.findUnique({
    where: { accessToken },
    include: { photos: true, selections: true },
  });
  if (!gallery || !isGalleryAccessible(gallery)) throw new Error("Gallery not available");
```

Further down in the same file, replace:

```ts
export async function confirmSelection(accessToken: string) {
  const gallery = await db.gallery.findUnique({ where: { accessToken } });
  if (!gallery || gallery.status === GalleryStatus.ARCHIVED) throw new Error("Gallery not available");
  await markSelectionConfirmed(gallery.id);
}
```

with:

```ts
export async function confirmSelection(accessToken: string) {
  const gallery = await db.gallery.findUnique({ where: { accessToken } });
  if (!gallery || !isGalleryAccessible(gallery)) throw new Error("Gallery not available");
  await markSelectionConfirmed(gallery.id);
}
```

- [ ] **Step 7: Write the failing test for `canServePhoto`**

Create `src/modules/photos/photo-access.service.test.ts`:

```ts
import { GalleryStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canServePhoto } from "./photo-access.service";

const activeGallery = { status: GalleryStatus.PROOFING, expiresAt: null, accessToken: "tpg_abc123" };
const archivedGallery = { status: GalleryStatus.ARCHIVED, expiresAt: null, accessToken: "tpg_abc123" };
const expiredGallery = {
  status: GalleryStatus.PROOFING,
  expiresAt: new Date(Date.now() - 1000),
  accessToken: "tpg_abc123",
};

describe("canServePhoto", () => {
  it("allows admins regardless of gallery state", () => {
    expect(canServePhoto(archivedGallery, { isAdmin: true, token: null })).toBe(true);
  });

  it("allows a matching token on an active gallery", () => {
    expect(canServePhoto(activeGallery, { isAdmin: false, token: "tpg_abc123" })).toBe(true);
  });

  it("rejects a missing token for non-admins", () => {
    expect(canServePhoto(activeGallery, { isAdmin: false, token: null })).toBe(false);
  });

  it("rejects a mismatched token", () => {
    expect(canServePhoto(activeGallery, { isAdmin: false, token: "tpg_wrong" })).toBe(false);
  });

  it("rejects a matching token on an archived gallery", () => {
    expect(canServePhoto(archivedGallery, { isAdmin: false, token: "tpg_abc123" })).toBe(false);
  });

  it("rejects a matching token on an expired gallery", () => {
    expect(canServePhoto(expiredGallery, { isAdmin: false, token: "tpg_abc123" })).toBe(false);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm test -- photo-access`
Expected: FAIL — module `./photo-access.service` doesn't exist yet.

- [ ] **Step 9: Implement `canServePhoto`**

Create `src/modules/photos/photo-access.service.ts`:

```ts
import type { GalleryStatus } from "@prisma/client";
import { isGalleryAccessible } from "@/modules/galleries/gallery.service";

type AccessCheckGallery = {
  status: GalleryStatus;
  expiresAt: Date | null;
  accessToken: string;
};

export function canServePhoto(
  gallery: AccessCheckGallery,
  options: { isAdmin: boolean; token: string | null }
): boolean {
  if (options.isAdmin) return true;
  if (!options.token || options.token !== gallery.accessToken) return false;
  return isGalleryAccessible(gallery);
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test -- photo-access`
Expected: PASS (6/6).

- [ ] **Step 11: Fix the IDOR in the photos route**

Replace the full contents of `src/app/api/photos/[id]/route.ts` with:

```ts
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { photoRepository } from "@/modules/photos/photo.repository";
import { canServePhoto } from "@/modules/photos/photo-access.service";
import { resolveStoragePath } from "@/modules/storage/storage.service";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await photoRepository.find(id);
  if (!photo) return new NextResponse("Not found", { status: 404 });

  const admin = await getCurrentAdmin();
  const token = request.nextUrl.searchParams.get("token");
  if (!canServePhoto(photo.gallery, { isAdmin: Boolean(admin), token })) {
    return new NextResponse("Not found", { status: 404 });
  }

  const variant = request.nextUrl.searchParams.get("variant") === "preview" ? "preview" : "thumb";
  const relativePath = variant === "preview" ? photo.previewPath || photo.thumbPath : photo.thumbPath;
  const extension = path.extname(relativePath).replace(".", "").toLowerCase();
  if (!contentTypes[extension]) return new NextResponse("Unsupported", { status: 400 });

  const file = await fs.readFile(resolveStoragePath(relativePath));
  return new NextResponse(file, {
    headers: {
      "Content-Type": contentTypes[extension],
      "Cache-Control": "private, max-age=3600",
    },
  });
}
```

- [ ] **Step 12: Manually verify in the browser**

Run: `npm run dev`. Create a gallery, import photos, open `/g/<accessToken>` — photos must load. Copy a photo URL, strip the `token` query param, and load it directly in a new private/incognito tab (no admin session) — expect `404 Not found`. Log into `/admin`, open the same URL without a token — expect the image to load (admin bypass).

- [ ] **Step 13: Run the full test suite**

Run: `npm test`
Expected: all tests across all files PASS.

- [ ] **Step 14: Commit**

```bash
git add src/modules/galleries/gallery.service.ts src/modules/galleries/gallery.service.test.ts src/app/g/\[token\]/page.tsx src/modules/selections/selection.service.ts src/modules/photos/photo-access.service.ts src/modules/photos/photo-access.service.test.ts src/app/api/photos/\[id\]/route.ts
git commit -m "fix: close photo IDOR and centralize gallery-access checks"
```

---

### Task 5: Correct the email subject and body copy

**Files:**
- Modify: `src/modules/mail/mail.service.ts`
- Test: `src/modules/mail/mail.service.test.ts`

**Interfaces:**
- Consumes: none new.
- Produces: no interface change — `galleryEmailText` signature unchanged, only its returned string and the hardcoded subject change.

- [ ] **Step 1: Write the failing test locking in the exact copy**

Create `src/modules/mail/mail.service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { galleryEmailText } from "./mail.service";

describe("galleryEmailText", () => {
  it("uses accented Spanish copy and the client name/url", () => {
    const text = galleryEmailText("Karim", "https://example.com/g/tpg_abc");

    expect(text).toContain("Hola, Karim.");
    expect(text).toContain("Tu galería de selección ya está disponible:");
    expect(text).toContain("https://example.com/g/tpg_abc");
    expect(text).toContain("Confirmar selección");
    expect(text).toContain("edición final");
    expect(text).toContain("— Gormm");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mail.service`
Expected: FAIL — current copy is missing accents (e.g. `"Confirmar seleccion"` not `"Confirmar selección"`).

- [ ] **Step 3: Fix the copy and the subject**

Edit `src/modules/mail/mail.service.ts`, replace:

```ts
export function galleryEmailText(clientName: string, galleryUrl: string) {
  return `Hola, ${clientName}.

Tu galeria de seleccion ya esta disponible:

${galleryUrl}

Puedes revisar las fotos, marcar tus favoritas y dejar comentarios si necesitas indicar algo especifico.

Cuando termines, presiona "Confirmar seleccion" para que pueda avanzar con la edicion final.

Gracias por confiar en Trashpanda Garage.

- Gormm`;
}
```

with:

```ts
export function galleryEmailText(clientName: string, galleryUrl: string) {
  return `Hola, ${clientName}.

Tu galería de selección ya está disponible:

${galleryUrl}

Puedes revisar las fotos, marcar tus favoritas y dejar comentarios si necesitas indicar algo específico.

Cuando termines, presiona "Confirmar selección" para que pueda avanzar con la edición final.

Gracias por confiar en Trashpanda Garage.

— Gormm`;
}
```

Then replace:

```ts
    subject: "Tu galeria esta lista - Trashpanda Garage",
```

with:

```ts
    subject: "Tu galería está lista — Trashpanda Garage",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- mail.service`
Expected: PASS (1/1).

- [ ] **Step 5: Commit**

```bash
git add src/modules/mail/mail.service.ts src/modules/mail/mail.service.test.ts
git commit -m "fix: correct gallery email subject and copy to match spec"
```

---

### Task 6: Add CSV export for the client's selection

**Files:**
- Modify: `src/modules/selections/selection.service.ts`
- Test: `src/modules/selections/selection.service.test.ts`
- Create: `src/app/admin/galleries/[id]/export/csv/route.ts`
- Modify: `src/app/admin/galleries/[id]/page.tsx`

**Interfaces:**
- Produces: `exportSelectionCsv(galleryId: string): Promise<string>` from `src/modules/selections/selection.service.ts`, consumed by the new CSV export route.

- [ ] **Step 1: Write the failing test for the CSV formatter**

Create `src/modules/selections/selection.service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("./selection.repository", () => ({
  selectionRepository: {
    selectedForGallery: vi.fn(async () => [
      { comment: "me gusta para perfil", photo: { filename: "IMG_2031.webp", baseName: "IMG_2031" } },
      { comment: null, photo: { filename: "IMG_2044.webp", baseName: "IMG_2044" } },
      { comment: 'con "comillas", y coma', photo: { filename: "IMG_2050.webp", baseName: "IMG_2050" } },
    ]),
  },
}));

const { exportSelectionCsv } = await import("./selection.service");

describe("exportSelectionCsv", () => {
  it("produces a header plus one escaped row per selected photo", async () => {
    const csv = await exportSelectionCsv("gallery_1");
    const lines = csv.split("\n");

    expect(lines[0]).toBe("filename,baseName,comment");
    expect(lines[1]).toBe("IMG_2031.webp,IMG_2031,me gusta para perfil");
    expect(lines[2]).toBe("IMG_2044.webp,IMG_2044,");
    expect(lines[3]).toBe('IMG_2050.webp,IMG_2050,"con ""comillas"", y coma"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- selection.service`
Expected: FAIL — `exportSelectionCsv` is not exported yet.

- [ ] **Step 3: Implement `exportSelectionCsv`**

Edit `src/modules/selections/selection.service.ts`, add at the end of the file:

```ts
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportSelectionCsv(galleryId: string): Promise<string> {
  const selected = await selectionRepository.selectedForGallery(galleryId);
  const header = "filename,baseName,comment";
  const rows = selected.map((item) =>
    [item.photo.filename, item.photo.baseName, csvEscape(item.comment ?? "")].join(",")
  );
  return [header, ...rows].join("\n");
}
```

Note: `csvEscape` is only applied to `comment` because `filename`/`baseName` come from validated import filenames (Task's `supportedImageExtensions` gate in `src/lib/validators.ts:31`) and never contain commas or quotes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- selection.service`
Expected: PASS (1/1).

- [ ] **Step 5: Add the CSV export route**

Create `src/app/admin/galleries/[id]/export/csv/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportSelectionCsv } from "@/modules/selections/selection.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const csv = await exportSelectionCsv(id);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="selection-${id}.csv"`,
    },
  });
}
```

- [ ] **Step 6: Add a CSV export link next to the existing TXT link**

Edit `src/app/admin/galleries/[id]/page.tsx`, replace:

```tsx
          <a className="button secondary text-center" href={`/admin/galleries/${id}/export`}>Exportar seleccion TXT</a>
```

with:

```tsx
          <a className="button secondary text-center" href={`/admin/galleries/${id}/export`}>Exportar seleccion TXT</a>
          <a className="button secondary text-center" href={`/admin/galleries/${id}/export/csv`}>Exportar seleccion CSV</a>
```

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev`, open a gallery with at least one selected photo with a comment, click "Exportar seleccion CSV".
Expected: downloads `selection-<id>.csv` with header `filename,baseName,comment` and one row per selected photo.

- [ ] **Step 8: Commit**

```bash
git add src/modules/selections/selection.service.ts src/modules/selections/selection.service.test.ts src/app/admin/galleries/\[id\]/export/csv/route.ts src/app/admin/galleries/\[id\]/page.tsx
git commit -m "feat: add CSV export for gallery selection"
```

---

### Task 7: Guard the READY_FOR_DELIVERY transition

**Files:**
- Modify: `src/modules/galleries/gallery.service.ts`
- Test: `src/modules/galleries/gallery.service.test.ts`
- Modify: `src/app/admin/galleries/[id]/page.tsx`

**Interfaces:**
- Produces: `assertReadyForDeliveryAllowed(data: { status?: GalleryStatus; deliveryDriveUrl?: string | null }): void` (throws `Error` on violation), consumed inside `updateGalleryFromForm` in `gallery.service.ts`.

- [ ] **Step 1: Write the failing test**

Edit `src/modules/galleries/gallery.service.test.ts`, add at the end of the file:

```ts
import { assertReadyForDeliveryAllowed } from "./gallery.service";

describe("assertReadyForDeliveryAllowed", () => {
  it("throws when moving to READY_FOR_DELIVERY without a delivery URL", () => {
    expect(() =>
      assertReadyForDeliveryAllowed({ status: GalleryStatus.READY_FOR_DELIVERY, deliveryDriveUrl: null })
    ).toThrow();
  });

  it("allows moving to READY_FOR_DELIVERY with a delivery URL set", () => {
    expect(() =>
      assertReadyForDeliveryAllowed({
        status: GalleryStatus.READY_FOR_DELIVERY,
        deliveryDriveUrl: "https://drive.google.com/x",
      })
    ).not.toThrow();
  });

  it("allows any other status regardless of delivery URL", () => {
    expect(() => assertReadyForDeliveryAllowed({ status: GalleryStatus.PROOFING, deliveryDriveUrl: null })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- gallery.service`
Expected: FAIL — `assertReadyForDeliveryAllowed` is not exported yet.

- [ ] **Step 3: Implement the guard and call it from `updateGalleryFromForm`**

Edit `src/modules/galleries/gallery.service.ts`, add this export after `isGalleryAccessible`:

```ts
export function assertReadyForDeliveryAllowed(data: {
  status?: GalleryStatus;
  deliveryDriveUrl?: string | null;
}): void {
  if (data.status === GalleryStatus.READY_FOR_DELIVERY && !data.deliveryDriveUrl) {
    throw new Error("Agrega el link de entrega de Google Drive antes de marcar como lista para entrega.");
  }
}
```

Then, in the same file, edit `updateGalleryFromForm`:

```ts
export async function updateGalleryFromForm(id: string, formData: FormData) {
  const data = cleanGalleryForm(formData);
  const gallery = await galleryRepository.update(id, data);
  await galleryRepository.event(id, "GALLERY_UPDATED", { status: data.status });
  revalidatePath(`/admin/galleries/${id}`);
  return gallery;
}
```

to:

```ts
export async function updateGalleryFromForm(id: string, formData: FormData) {
  const data = cleanGalleryForm(formData);
  assertReadyForDeliveryAllowed(data);
  const gallery = await galleryRepository.update(id, data);
  await galleryRepository.event(id, "GALLERY_UPDATED", { status: data.status });
  revalidatePath(`/admin/galleries/${id}`);
  return gallery;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- gallery.service`
Expected: PASS (all tests in the file, including Task 4's and Task 7's).

- [ ] **Step 5: Surface the error in the admin gallery detail page**

Edit `src/app/admin/galleries/[id]/page.tsx`, replace the function signature and the `update` action:

```tsx
export default async function GalleryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [gallery, clients] = await Promise.all([galleryRepository.find(id), clientRepository.list()]);
  if (!gallery) redirect("/admin/galleries");

  async function update(formData: FormData) {
    "use server";
    await updateGalleryFromForm(id, formData);
    redirect(`/admin/galleries/${id}`);
  }
```

with:

```tsx
export default async function GalleryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [gallery, clients] = await Promise.all([galleryRepository.find(id), clientRepository.list()]);
  if (!gallery) redirect("/admin/galleries");

  async function update(formData: FormData) {
    "use server";
    let redirectTarget = `/admin/galleries/${id}`;
    try {
      await updateGalleryFromForm(id, formData);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudo guardar la galeria";
      redirectTarget += `?error=${encodeURIComponent(message)}`;
    }
    redirect(redirectTarget);
  }
```

Then, right below the `<StatusBadge status={gallery.status} />` line, add the error banner:

```tsx
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{gallery.title}</h1>
          <p className="mt-2 text-zinc-500">{gallery.client.name}</p>
        </div>
        <StatusBadge status={gallery.status} />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">{error}</p>
      )}
```

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`, open a gallery, clear the "Google Drive entrega" field, set "Estado" to `READY_FOR_DELIVERY`, save.
Expected: redirected back with the red error banner "Agrega el link de entrega de Google Drive antes de marcar como lista para entrega." and the gallery status unchanged. Fill in the delivery URL and save again with the same status — expected: saves successfully, no error banner.

- [ ] **Step 7: Commit**

```bash
git add src/modules/galleries/gallery.service.ts src/modules/galleries/gallery.service.test.ts src/app/admin/galleries/\[id\]/page.tsx
git commit -m "feat: require a delivery URL before marking a gallery ready for delivery"
```

---

### Task 8: Show the GalleryEvent history in the admin panel

**Files:**
- Modify: `src/app/admin/galleries/[id]/page.tsx`

**Interfaces:**
- Consumes: `gallery.events` (already included by `galleryRepository.find`, see `src/modules/galleries/gallery.repository.ts:19`, ordered `createdAt desc`).

- [ ] **Step 1: Add the history section**

Edit `src/app/admin/galleries/[id]/page.tsx`, add this new `<section>` right after the existing "Fotos" `<section>` (before the closing `</AdminShell>`):

```tsx
      <section className="mt-8">
        <h2 className="text-xl font-bold">Historial</h2>
        <ul className="mt-4 grid gap-2 text-sm text-zinc-400">
          {gallery.events.map((event) => (
            <li key={event.id} className="rounded border border-zinc-800 p-2">
              <span className="font-mono text-xs text-zinc-500">{event.createdAt.toLocaleString()}</span>{" "}
              <strong className="text-zinc-200">{event.type}</strong>
              {event.metadata != null && (
                <pre className="mt-1 overflow-x-auto text-xs text-zinc-500">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              )}
            </li>
          ))}
          {gallery.events.length === 0 && <li className="text-zinc-500">Sin eventos todavia.</li>}
        </ul>
      </section>
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`, open a gallery that has already had photos imported and an email sent.
Expected: the new "Historial" section lists `PHOTOS_IMPORTED` and `EMAIL_SENT` events (and any others) with timestamps, most recent first.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/galleries/\[id\]/page.tsx
git commit -m "feat: show gallery event history in admin"
```

---

### Task 9: Extract the client-side gallery components

**Files:**
- Create: `src/components/gallery/gallery.types.ts`
- Create: `src/components/gallery/PhotoCommentBox.tsx`
- Create: `src/components/gallery/PhotoCard.tsx`
- Create: `src/components/gallery/GalleryGrid.tsx`
- Create: `src/components/gallery/PhotoLightbox.tsx`
- Create: `src/components/gallery/SelectionCounter.tsx`
- Create: `src/components/gallery/ConfirmSelectionButton.tsx`
- Create: `src/components/gallery/DeliveryDriveButton.tsx`
- Modify: `src/components/gallery/ClientGallery.tsx`

**Interfaces:**
- Produces: shared `Photo` type in `src/components/gallery/gallery.types.ts`, consumed by every component in this task and by `ClientGallery.tsx`.
- This is a pure refactor — no props change from `ClientGallery`'s external callers (`src/app/g/[token]/page.tsx`, already updated in Task 4, is unaffected).

- [ ] **Step 1: Extract the shared `Photo` type**

Create `src/components/gallery/gallery.types.ts`:

```ts
export type Photo = {
  id: string;
  filename: string;
  baseName: string;
  selected: boolean;
  comment: string;
  thumbUrl: string;
  previewUrl: string;
};
```

- [ ] **Step 2: Create `PhotoCommentBox`**

Create `src/components/gallery/PhotoCommentBox.tsx`:

```tsx
"use client";

export function PhotoCommentBox({ comment, onChange }: { comment: string; onChange: (comment: string) => void }) {
  return (
    <textarea
      className="mt-2 text-sm"
      rows={2}
      placeholder="Comentario"
      value={comment}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
```

- [ ] **Step 3: Create `PhotoCard`**

Create `src/components/gallery/PhotoCard.tsx`:

```tsx
"use client";

import type { Photo } from "./gallery.types";
import { PhotoCommentBox } from "./PhotoCommentBox";

export function PhotoCard({
  photo,
  onOpen,
  onToggleSelected,
  onCommentChange,
}: {
  photo: Photo;
  onOpen: (photo: Photo) => void;
  onToggleSelected: (photo: Photo) => void;
  onCommentChange: (photo: Photo, comment: string) => void;
}) {
  return (
    <article className={`rounded-lg border bg-[#141417] p-2 ${photo.selected ? "border-[#d9902f]" : "border-zinc-800"}`}>
      <button type="button" onClick={() => onOpen(photo)} className="block w-full overflow-hidden rounded-md border-0 bg-transparent p-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.thumbUrl} alt={photo.baseName} className="aspect-square w-full object-cover" />
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-sm text-zinc-300">{photo.baseName}</span>
        <button type="button" className={photo.selected ? "" : "secondary"} onClick={() => onToggleSelected(photo)}>
          {photo.selected ? "OK" : "Elegir"}
        </button>
      </div>
      <PhotoCommentBox comment={photo.comment} onChange={(comment) => onCommentChange(photo, comment)} />
    </article>
  );
}
```

- [ ] **Step 4: Create `GalleryGrid`**

Create `src/components/gallery/GalleryGrid.tsx`:

```tsx
"use client";

import type { Photo } from "./gallery.types";
import { PhotoCard } from "./PhotoCard";

export function GalleryGrid({
  photos,
  onOpen,
  onToggleSelected,
  onCommentChange,
}: {
  photos: Photo[];
  onOpen: (photo: Photo) => void;
  onToggleSelected: (photo: Photo) => void;
  onCommentChange: (photo: Photo, comment: string) => void;
}) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          onOpen={onOpen}
          onToggleSelected={onToggleSelected}
          onCommentChange={onCommentChange}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `PhotoLightbox`**

Create `src/components/gallery/PhotoLightbox.tsx`:

```tsx
"use client";

import type { Photo } from "./gallery.types";

export function PhotoLightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/90 p-4" onClick={onClose}>
      <div className="max-h-full max-w-5xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.previewUrl} alt={photo.baseName} className="max-h-[85vh] rounded-lg object-contain" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `SelectionCounter`**

Create `src/components/gallery/SelectionCounter.tsx`:

```tsx
export function SelectionCounter({
  selectedCount,
  selectionLimit,
}: {
  selectedCount: number;
  selectionLimit?: number | null;
}) {
  return (
    <strong>
      {selectedCount}
      {selectionLimit ? ` / ${selectionLimit}` : ""} seleccionadas
    </strong>
  );
}
```

- [ ] **Step 7: Create `ConfirmSelectionButton`**

Create `src/components/gallery/ConfirmSelectionButton.tsx`:

```tsx
"use client";

export function ConfirmSelectionButton({
  confirmed,
  pending,
  onConfirm,
}: {
  confirmed: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <button type="button" disabled={pending || confirmed} onClick={onConfirm}>
      {confirmed ? "Selección enviada" : "Confirmar selección"}
    </button>
  );
}
```

- [ ] **Step 8: Create `DeliveryDriveButton`**

Create `src/components/gallery/DeliveryDriveButton.tsx`:

```tsx
export function DeliveryDriveButton({ url }: { url: string }) {
  return (
    <a className="button" href={url} target="_blank" rel="noreferrer">
      Abrir entrega Drive
    </a>
  );
}
```

- [ ] **Step 9: Rewrite `ClientGallery` as the orchestrating container**

Replace the full contents of `src/components/gallery/ClientGallery.tsx` with:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { ConfirmSelectionButton } from "./ConfirmSelectionButton";
import { DeliveryDriveButton } from "./DeliveryDriveButton";
import { GalleryGrid } from "./GalleryGrid";
import { PhotoLightbox } from "./PhotoLightbox";
import { SelectionCounter } from "./SelectionCounter";
import type { Photo } from "./gallery.types";

export function ClientGallery({
  token,
  title,
  clientName,
  selectionLimit,
  photos,
  deliveryDriveUrl,
  canShowDelivery,
  alreadyConfirmed,
}: {
  token: string;
  title: string;
  clientName?: string;
  selectionLimit?: number | null;
  photos: Photo[];
  deliveryDriveUrl?: string | null;
  canShowDelivery: boolean;
  alreadyConfirmed: boolean;
}) {
  const [items, setItems] = useState(photos);
  const [active, setActive] = useState<Photo | null>(null);
  const [confirmed, setConfirmed] = useState(alreadyConfirmed);
  const [pending, startTransition] = useTransition();
  const selectedCount = useMemo(() => items.filter((item) => item.selected).length, [items]);

  function updatePhoto(photo: Photo, selected: boolean, comment = photo.comment) {
    if (selected && !photo.selected && selectionLimit && selectedCount >= selectionLimit) return;
    setItems((current) => current.map((item) => (item.id === photo.id ? { ...item, selected, comment } : item)));
    startTransition(async () => {
      const response = await fetch(`/api/galleries/${token}/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, selected, comment }),
      });
      if (!response.ok) setItems(photos);
    });
  }

  function confirm() {
    startTransition(async () => {
      const response = await fetch(`/api/galleries/${token}/confirm`, { method: "POST" });
      if (response.ok) setConfirmed(true);
    });
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.35em] text-[#d9902f]">Trashpanda Garage</p>
        <h1 className="mt-3 text-4xl font-black">{title}</h1>
        {clientName && <p className="mt-2 text-zinc-400">{clientName}</p>}
        <p className="mt-6 max-w-2xl text-zinc-300">
          Selecciona tus fotos favoritas. Cuando termines, confirma tu selección para avanzar con la edición final.
        </p>
        <div className="sticky top-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-zinc-800 bg-[#09090b]/95 py-4">
          <SelectionCounter selectedCount={selectedCount} selectionLimit={selectionLimit} />
          <div className="flex gap-3">
            {canShowDelivery && deliveryDriveUrl && <DeliveryDriveButton url={deliveryDriveUrl} />}
            <ConfirmSelectionButton confirmed={confirmed} pending={pending} onConfirm={confirm} />
          </div>
        </div>
        {confirmed && (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-[#141417] p-4 text-zinc-200">
            Tu selección fue enviada. Gracias, pronto prepararé la entrega final.
          </p>
        )}
        <GalleryGrid
          photos={items}
          onOpen={setActive}
          onToggleSelected={(photo) => updatePhoto(photo, !photo.selected)}
          onCommentChange={(photo, comment) => updatePhoto(photo, photo.selected, comment)}
        />
      </section>
      {active && <PhotoLightbox photo={active} onClose={() => setActive(null)} />}
    </main>
  );
}
```

- [ ] **Step 10: Run the type checker and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 11: Manually verify in the browser**

Run: `npm run dev`, open `/g/<accessToken>` for a gallery with photos.
Expected: grid renders, clicking a thumbnail opens the lightbox, "Elegir/OK" toggles selection and updates the counter, typing in the comment box persists on blur/refresh, "Confirmar selección" works and shows the confirmation message, and (if the gallery is ready for delivery) the Drive button opens in a new tab. All behavior identical to before the refactor.

- [ ] **Step 12: Run the full test suite**

Run: `npm test`
Expected: all tests PASS (this task added no new tests — it's a pure UI refactor covered by manual verification).

- [ ] **Step 13: Commit**

```bash
git add src/components/gallery
git commit -m "refactor: extract client gallery UI into named components per spec"
```

---

### Task 10: Extract the admin-side components

**Files:**
- Create: `src/components/admin/AdminSidebar.tsx`
- Modify: `src/components/admin/AdminShell.tsx`
- Create: `src/components/admin/GalleryStatusBadge.tsx`
- Delete: `src/components/admin/StatusBadge.tsx`
- Create: `src/components/admin/GalleryTable.tsx`
- Create: `src/components/admin/ClientTable.tsx`
- Create: `src/components/admin/GalleryPhotoManager.tsx`
- Create: `src/components/admin/SelectedPhotoList.tsx`
- Create: `src/components/admin/SendGalleryEmailButton.tsx`
- Create: `src/components/admin/ExportSelectionButton.tsx`
- Modify: `src/app/admin/galleries/page.tsx`
- Modify: `src/app/admin/clients/page.tsx`
- Modify: `src/app/admin/galleries/[id]/page.tsx`

**Interfaces:**
- This is a pure refactor of Tasks 6/7/8's already-working page. No behavior changes; only extraction into named components.

- [ ] **Step 1: Extract `AdminSidebar` from `AdminShell`**

Create `src/components/admin/AdminSidebar.tsx`:

```tsx
import Link from "next/link";

export function AdminSidebar({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => Promise<void> }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-800 bg-[#101013] p-6 md:block">
      <Link href="/admin" className="block text-xl font-black uppercase tracking-wide">
        Trashpanda
      </Link>
      <p className="mt-1 text-xs text-zinc-500">Garage admin</p>
      <nav className="mt-10 grid gap-3 text-sm text-zinc-300">
        <Link href="/admin/clients">Clientes</Link>
        <Link href="/admin/galleries">Galerias</Link>
        <Link href="/">Sitio publico</Link>
      </nav>
      <form action={onLogout} className="absolute bottom-6 left-6 right-6">
        <p className="mb-3 truncate text-xs text-zinc-500">{adminEmail}</p>
        <button className="secondary w-full" type="submit">Salir</button>
      </form>
    </aside>
  );
}
```

Replace the full contents of `src/components/admin/AdminShell.tsx` with:

```tsx
import { logoutAdmin, requireAdmin } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  async function logout() {
    "use server";
    await logoutAdmin();
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4efe7]">
      <AdminSidebar adminEmail={admin.email} onLogout={logout} />
      <main className="mx-auto max-w-6xl p-5 md:ml-64 md:p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Rename `StatusBadge` to `GalleryStatusBadge`**

Create `src/components/admin/GalleryStatusBadge.tsx`:

```tsx
import type { GalleryStatus } from "@prisma/client";

const labels: Record<GalleryStatus, string> = {
  DRAFT: "Borrador",
  EMAIL_SENT: "Correo enviado",
  PROOFING: "Seleccion",
  SELECTION_CONFIRMED: "Confirmada",
  EDITING: "Editando",
  READY_FOR_DELIVERY: "Lista",
  DELIVERED: "Entregada",
  ARCHIVED: "Archivada",
};

export function GalleryStatusBadge({ status }: { status: GalleryStatus }) {
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
      {labels[status]}
    </span>
  );
}
```

Delete the old file: `src/components/admin/StatusBadge.tsx`.

- [ ] **Step 3: Extract `GalleryTable` and update the galleries list page**

Create `src/components/admin/GalleryTable.tsx`:

```tsx
import Link from "next/link";
import type { Client, Gallery, Photo, Selection } from "@prisma/client";
import { GalleryStatusBadge } from "./GalleryStatusBadge";

type GalleryListItem = Gallery & { client: Client; photos: Pick<Photo, "id">[]; selections: Selection[] };

export function GalleryTable({ galleries }: { galleries: GalleryListItem[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-800">
      {galleries.map((gallery) => (
        <Link
          key={gallery.id}
          href={`/admin/galleries/${gallery.id}`}
          className="grid gap-2 border-b border-zinc-800 bg-[#141417] p-4 last:border-b-0 md:grid-cols-[1fr_auto]"
        >
          <div>
            <strong>{gallery.title}</strong>
            <p className="text-sm text-zinc-500">
              {gallery.client.name} · {gallery.photos.length} fotos ·{" "}
              {gallery.selections.filter((s) => s.selected).length} seleccionadas
            </p>
          </div>
          <GalleryStatusBadge status={gallery.status} />
        </Link>
      ))}
      {galleries.length === 0 && <p className="p-4 text-zinc-500">No hay galerias todavia.</p>}
    </div>
  );
}
```

Replace the full contents of `src/app/admin/galleries/page.tsx` with:

```tsx
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryTable } from "@/components/admin/GalleryTable";
import { galleryRepository } from "@/modules/galleries/gallery.repository";

export const dynamic = "force-dynamic";

export default async function GalleriesPage() {
  const galleries = await galleryRepository.list();
  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black">Galerias</h1>
        <Link className="button" href="/admin/galleries/new">Nueva galeria</Link>
      </div>
      <GalleryTable galleries={galleries} />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Extract `ClientTable` and update the clients list page**

Create `src/components/admin/ClientTable.tsx`:

```tsx
import Link from "next/link";
import type { Client, Gallery } from "@prisma/client";

type ClientListItem = Client & { galleries: Pick<Gallery, "id">[] };

export function ClientTable({ clients }: { clients: ClientListItem[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-800">
      {clients.map((client) => (
        <Link
          key={client.id}
          href={`/admin/clients/${client.id}`}
          className="grid gap-1 border-b border-zinc-800 bg-[#141417] p-4 last:border-b-0"
        >
          <strong>{client.name}</strong>
          <span className="text-sm text-zinc-500">{client.email || "Sin email"} · {client.galleries.length} galerias</span>
        </Link>
      ))}
      {clients.length === 0 && <p className="p-4 text-zinc-500">No hay clientes todavia.</p>}
    </div>
  );
}
```

Replace the full contents of `src/app/admin/clients/page.tsx` with:

```tsx
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ClientTable } from "@/components/admin/ClientTable";
import { clientRepository } from "@/modules/clients/client.repository";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await clientRepository.list();
  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black">Clientes</h1>
        <Link className="button" href="/admin/clients/new">Nuevo cliente</Link>
      </div>
      <ClientTable clients={clients} />
    </AdminShell>
  );
}
```

- [ ] **Step 5: Extract `GalleryPhotoManager` and `SelectedPhotoList`**

Create `src/components/admin/GalleryPhotoManager.tsx`:

```tsx
import type { Photo, Selection } from "@prisma/client";

type PhotoWithSelection = Photo & { selection: Selection | null };

export function GalleryPhotoManager({ photos }: { photos: PhotoWithSelection[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Fotos</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {photos.map((photo) => (
          <article key={photo.id} className="rounded-lg border border-zinc-800 bg-[#141417] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${photo.id}?variant=thumb`}
              alt={photo.baseName}
              className="aspect-square w-full rounded object-cover"
            />
            <p className="mt-2 truncate text-sm">{photo.filename}</p>
            {photo.selection?.comment && <p className="mt-1 text-xs text-zinc-500">{photo.selection.comment}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
```

Create `src/components/admin/SelectedPhotoList.tsx`:

```tsx
import type { Photo, Selection } from "@prisma/client";

type SelectionWithPhoto = Selection & { photo: Photo };

export function SelectedPhotoList({ selections }: { selections: SelectionWithPhoto[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#141417] p-4">
      <h2 className="font-bold">Seleccionadas</h2>
      <p className="mt-1 text-sm text-zinc-500">{selections.length} fotos</p>
      <ul className="mt-4 grid gap-2 text-sm">
        {selections.map((selection) => (
          <li key={selection.id} className="rounded border border-zinc-800 p-2">
            <strong>{selection.photo.baseName}</strong>
            {selection.comment && <p className="mt-1 text-zinc-400">{selection.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Extract `SendGalleryEmailButton` and `ExportSelectionButton`**

Create `src/components/admin/SendGalleryEmailButton.tsx`:

```tsx
export function SendGalleryEmailButton({ onSend }: { onSend: () => Promise<void> }) {
  return (
    <form action={onSend}>
      <button className="secondary w-full" type="submit">Enviar correo</button>
    </form>
  );
}
```

Create `src/components/admin/ExportSelectionButton.tsx`:

```tsx
export function ExportSelectionButton({ galleryId }: { galleryId: string }) {
  return (
    <div className="grid gap-2">
      <a className="button secondary text-center" href={`/admin/galleries/${galleryId}/export`}>
        Exportar seleccion TXT
      </a>
      <a className="button secondary text-center" href={`/admin/galleries/${galleryId}/export/csv`}>
        Exportar seleccion CSV
      </a>
    </div>
  );
}
```

- [ ] **Step 7: Rewrite the gallery detail page to compose the extracted components**

Replace the full contents of `src/app/admin/galleries/[id]/page.tsx` with:

```tsx
import { GalleryStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryStatusBadge } from "@/components/admin/GalleryStatusBadge";
import { GalleryPhotoManager } from "@/components/admin/GalleryPhotoManager";
import { SelectedPhotoList } from "@/components/admin/SelectedPhotoList";
import { SendGalleryEmailButton } from "@/components/admin/SendGalleryEmailButton";
import { ExportSelectionButton } from "@/components/admin/ExportSelectionButton";
import { FormField } from "@/components/ui/FormField";
import { env } from "@/lib/env";
import { clientRepository } from "@/modules/clients/client.repository";
import { archiveGallery, updateGalleryFromForm } from "@/modules/galleries/gallery.service";
import { galleryRepository } from "@/modules/galleries/gallery.repository";
import { importGalleryPhotos } from "@/modules/photos/photo-import.service";
import { sendGalleryEmail } from "@/modules/mail/mail.service";

export const dynamic = "force-dynamic";

export default async function GalleryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [gallery, clients] = await Promise.all([galleryRepository.find(id), clientRepository.list()]);
  if (!gallery) redirect("/admin/galleries");

  async function update(formData: FormData) {
    "use server";
    let redirectTarget = `/admin/galleries/${id}`;
    try {
      await updateGalleryFromForm(id, formData);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "No se pudo guardar la galeria";
      redirectTarget += `?error=${encodeURIComponent(message)}`;
    }
    redirect(redirectTarget);
  }

  async function importPhotos() {
    "use server";
    await importGalleryPhotos(id);
    redirect(`/admin/galleries/${id}`);
  }

  async function sendEmail() {
    "use server";
    await sendGalleryEmail(id);
    redirect(`/admin/galleries/${id}`);
  }

  async function archive() {
    "use server";
    await archiveGallery(id);
    redirect("/admin/galleries");
  }

  const selected = gallery.selections.filter((selection) => selection.selected);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{gallery.title}</h1>
          <p className="mt-2 text-zinc-500">{gallery.client.name}</p>
        </div>
        <GalleryStatusBadge status={gallery.status} />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">{error}</p>
      )}

      <div className="mt-6 grid gap-4 rounded-lg border border-zinc-800 bg-[#141417] p-4 text-sm text-zinc-300">
        <p>Link privado: <Link className="text-[#d9902f]" href={`/g/${gallery.accessToken}`}>{env.APP_BASE_URL}/g/{gallery.accessToken}</Link></p>
        <p>Token: <span className="font-mono text-xs">{gallery.accessToken}</span></p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form action={update} className="grid gap-4 rounded-lg border border-zinc-800 bg-[#141417] p-5">
          <h2 className="text-xl font-bold">Datos</h2>
          <FormField label="Cliente">
            <select name="clientId" defaultValue={gallery.clientId}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </FormField>
          <FormField label="Titulo"><input name="title" defaultValue={gallery.title} required /></FormField>
          <FormField label="Slug"><input name="slug" defaultValue={gallery.slug} /></FormField>
          <FormField label="Estado">
            <select name="status" defaultValue={gallery.status}>{Object.values(GalleryStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
          </FormField>
          <FormField label="Limite seleccion"><input name="selectionLimit" type="number" min="1" defaultValue={gallery.selectionLimit ?? ""} /></FormField>
          <FormField label="Expira"><input name="expiresAt" type="date" defaultValue={gallery.expiresAt?.toISOString().slice(0, 10) ?? ""} /></FormField>
          <FormField label="Proofing local path"><input name="proofingLocalPath" defaultValue={gallery.proofingLocalPath ?? ""} /></FormField>
          <FormField label="Thumb local path"><input name="thumbnailLocalPath" defaultValue={gallery.thumbnailLocalPath ?? ""} /></FormField>
          <FormField label="Preview local path"><input name="previewLocalPath" defaultValue={gallery.previewLocalPath ?? ""} /></FormField>
          <FormField label="Google Drive carpeta"><input name="googleDriveFolderUrl" defaultValue={gallery.googleDriveFolderUrl ?? ""} /></FormField>
          <FormField label="Google Drive entrega"><input name="deliveryDriveUrl" defaultValue={gallery.deliveryDriveUrl ?? ""} /></FormField>
          <button type="submit">Guardar galeria</button>
        </form>

        <aside className="grid content-start gap-3">
          <form action={importPhotos}><button className="w-full" type="submit">Importar fotos</button></form>
          <SendGalleryEmailButton onSend={sendEmail} />
          <ExportSelectionButton galleryId={id} />
          <form action={archive}><button className="secondary w-full" type="submit">Archivar</button></form>
          <SelectedPhotoList selections={selected} />
        </aside>
      </div>

      <GalleryPhotoManager photos={gallery.photos} />

      <section className="mt-8">
        <h2 className="text-xl font-bold">Historial</h2>
        <ul className="mt-4 grid gap-2 text-sm text-zinc-400">
          {gallery.events.map((event) => (
            <li key={event.id} className="rounded border border-zinc-800 p-2">
              <span className="font-mono text-xs text-zinc-500">{event.createdAt.toLocaleString()}</span>{" "}
              <strong className="text-zinc-200">{event.type}</strong>
              {event.metadata != null && (
                <pre className="mt-1 overflow-x-auto text-xs text-zinc-500">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              )}
            </li>
          ))}
          {gallery.events.length === 0 && <li className="text-zinc-500">Sin eventos todavia.</li>}
        </ul>
      </section>
    </AdminShell>
  );
}
```

- [ ] **Step 8: Run the type checker and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 9: Manually verify in the browser**

Run: `npm run dev`. Visit `/admin/clients`, `/admin/galleries`, and an individual `/admin/galleries/<id>`.
Expected: identical appearance and behavior to before this task — client/gallery tables render, gallery detail page shows form, both export links, send-email button, archive button, selected list, photo grid, and event history, all still working.

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: all tests still PASS (no test touched this task's files directly, but this confirms nothing else regressed).

- [ ] **Step 11: Commit**

```bash
git add src/components/admin src/app/admin/galleries/page.tsx src/app/admin/clients/page.tsx src/app/admin/galleries/\[id\]/page.tsx
git commit -m "refactor: extract admin UI into named components per spec"
```

---

### Task 11: Harden Docker and Docker Compose

**Files:**
- Create: `prisma/migrations/` (generated, not hand-written)
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

**Interfaces:** none — infra-only changes.

- [ ] **Step 1: Generate the initial Prisma migration against a real dev database**

Prerequisite: `docker-compose.yml` still has the `db` service's `ports: ["5432:5432"]` mapping at this point (removed later in Step 4) — this step relies on it to reach Postgres from the host.

Run: `docker compose up -d db`
Run: `npm run prisma:migrate -- --name init` (this is `prisma migrate dev --name init` per `package.json:11`)
Expected: creates `prisma/migrations/<timestamp>_init/migration.sql` and `prisma/migrations/migration_lock.toml`, and reports the migration applied successfully against the local `db` container.

- [ ] **Step 2: Verify the migration matches the current schema with no drift**

Run: `npx prisma migrate status`
Expected: "Database schema is up to date!" with no pending migrations.

- [ ] **Step 3: Commit the generated migration**

```bash
git add prisma/migrations
git commit -m "chore: add initial Prisma migration"
```

- [ ] **Step 4: Switch Docker Compose to `migrate deploy` and stop publishing Postgres's port**

Replace the full contents of `docker-compose.yml` with:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - /mnt/trashpanda/photos:/data/photos
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://trashpanda:trashpanda_password@db:5432/trashpanda
      PHOTO_STORAGE_ROOT: /data/photos
    depends_on:
      - db
    command: sh -c "npx prisma migrate deploy && npm run start"

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: trashpanda
      POSTGRES_USER: trashpanda
      POSTGRES_PASSWORD: trashpanda_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

(The only changes from before: the `db` service's `ports` mapping is removed, and `app`'s `command` uses `prisma migrate deploy` instead of `prisma db push`.)

- [ ] **Step 5: Run a non-root user in the production image**

Edit `Dockerfile`, replace the `runner` stage:

```dockerfile
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "run", "start"]
```

with:

```dockerfile
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
```

- [ ] **Step 6: Rebuild and verify the stack still starts correctly**

Run: `docker compose down`
Run: `docker compose up --build`
Expected: `app` logs show `prisma migrate deploy` applying the `init` migration (or reporting it already applied) followed by Next.js starting on port 3000; `db` is reachable only from `app` (not from the host on port 5432 anymore — confirm with `docker compose exec db pg_isready`, not by connecting from the host). Open `http://localhost:3000/admin/login` and confirm login still works end-to-end.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "chore: run container as non-root, stop publishing postgres port, use migrate deploy"
```

---

## Self-Review Notes

- **Spec coverage:** every item from `docs/superpowers/specs/2026-07-08-v1-closeout-hardening-design.md` sections 1–6 maps to a task: §1.1→Task 4, §1.2→Task 2, §1.3→Task 3, §2.1→Task 11 Step 5, §2.2→Task 11 Step 4, §2.3→Task 11 Steps 1–4, §3.1→Task 5, §3.2→Task 6, §3.3→Task 7, §3.4→Task 8, §4→Tasks 9–10, §5→Tasks 1–7 (each adds its own tests as it goes).
- **Placeholder scan:** no TBD/TODO; every step shows literal code or an exact command with expected output.
- **Type consistency:** `isGalleryAccessible(gallery: { status: GalleryStatus; expiresAt: Date | null })` (Task 4) is reused with the same shape in `photo-access.service.ts`'s `AccessCheckGallery` and in `selection.service.ts`/`g/[token]/page.tsx` call sites — verified consistent across tasks. `Photo` type (Task 9) is defined once in `gallery.types.ts` and imported everywhere it's used, never redeclared.
- **Task ordering:** Tasks 9 and 10 (componentization) are deliberately last among the app-code tasks because they touch the same files (`ClientGallery.tsx`, `admin/galleries/[id]/page.tsx`) that Tasks 4/6/7/8 modify first — this avoids merge conflicts between functional fixes and pure refactors.
