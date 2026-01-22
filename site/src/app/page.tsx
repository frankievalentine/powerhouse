import { Agents } from "@/components/agents";
import { Commands } from "@/components/commands";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Installation } from "@/components/installation";

export default function Home() {
	return (
		<main className="min-h-screen">
			<Header />
			<Hero />
			<Features />
			<Agents />
			<Commands />
			<Installation />
			<Footer />
		</main>
	);
}
