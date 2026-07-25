import Link from "next/link";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicNav } from "@/components/public/PublicNav";
import { publicCategories, publicPortfolioItems } from "@/components/public/portfolio-data";

export default function WorkPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <PublicNav />
      <section className="px-5 py-12 md:px-12 md:py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mono mb-3 text-xs uppercase tracking-[0.1em] text-[var(--muted-2)]">Portfolio</p>
            <h1 className="text-5xl font-semibold">Work</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="pill bg-[var(--foreground)] text-[var(--background)]" href="/work">All</Link>
            {publicCategories.map((cat) => (
              <Link key={cat.key} className="pill" href={cat.href}>
                {cat.name.replace(" / Paint", "")}
              </Link>
            ))}
          </div>
        </div>

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {publicPortfolioItems.map((item) => (
            <Link key={item.title} href={`/work/${item.key}`} className="group mb-4 block break-inside-avoid">
              <div
                className="media-placeholder relative mb-3 overflow-hidden transition group-hover:border-white/25"
                style={{ aspectRatio: item.ratio }}
              >
                <img src={item.image} alt={item.alt} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                <span className="mono absolute left-3 top-3 rounded-[2px] border border-[var(--line-strong)] px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-[var(--muted-2)]">
                  {item.category}
                </span>
              </div>
              <div className="flex justify-between gap-4 px-0.5 text-sm">
                <span className="text-[#d8d6dd]">{item.title}</span>
                <span className="mono text-xs text-[var(--muted-2)]">{item.year}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
