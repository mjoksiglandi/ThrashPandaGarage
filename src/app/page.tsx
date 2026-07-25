import { FeaturedCarousel } from "@/components/public/HeroCarousel";
import { PublicNav } from "@/components/public/PublicNav";
import { publicPortfolioItems } from "@/components/public/portfolio-data";

export default function HomePage() {
  return <main><PublicNav active="home" /><FeaturedCarousel photos={publicPortfolioItems} /></main>;
}
