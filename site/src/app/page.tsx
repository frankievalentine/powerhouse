import { Agents } from "@/components/agents";
import { Commands } from "@/components/commands";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Installation } from "@/components/installation";

export default function Home() {
	return (
		<main id="main-content" className="relative min-h-screen">
			{/* Global background - extends from hero and fades down */}
			<div className="pointer-events-none fixed inset-0 bg-mesh-gradient" aria-hidden="true" />
			<div className="pointer-events-none fixed inset-0 bg-dot-grid" aria-hidden="true" />
			<div className="pointer-events-none fixed top-0 left-0 right-0 h-[800px] bg-spotlight" aria-hidden="true" />
			
			{/* Content */}
			<div className="relative">
				<Header />
				<Hero />
				<Features />
				<Agents />
				<Commands />
				<Installation />
				<Footer />
			</div>
		</main>
	);
}
