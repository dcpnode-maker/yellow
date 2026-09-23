import { FormEvent, useState } from "react";
import { motion } from "framer-motion";

type Home = Readonly<{ title: string; meta: string; image: string; href: string }>;

const homes: readonly Home[] = [
  { title: "One Bedroom Residence", meta: "Light-filled living for two", image: "https://framerusercontent.com/images/jjVKwmdLrgxDdEnONxWsdWDs2s.jpg?height=900&width=1100", href: "/client/locanda-homes/stays/one-bedroom" },
  { title: "Two Bedroom Residence", meta: "A calmer way to share the city", image: "https://framerusercontent.com/images/cxLvSQQ10c1zuTYWjvsklqOtig.jpg?height=900&width=1100", href: "/client/locanda-homes/stays/two-bedroom" },
  { title: "Penthouse Residence", meta: "More room for Riyadh evenings", image: "https://framerusercontent.com/images/skGxDvW97BO1LMF8jlMfqR25RI.png?height=900&width=1100", href: "/client/locanda-homes/stays/two-bedroom" },
];

const heroImage = `${import.meta.env.BASE_URL}media/locanda-riyadh-hero.png`;

const reveal = { hidden: { opacity: 0, y: 18 }, shown: { opacity: 1, y: 0 } };

export function App() {
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const checkIn = String(form.get("checkIn") ?? "");
    const checkOut = String(form.get("checkOut") ?? "");
    if (!checkIn || !checkOut || new Date(checkIn) >= new Date(checkOut)) {
      setNotice("Choose a valid check-in and check-out date to explore homes.");
      return;
    }
    window.location.assign(`/client/locanda-homes/stays?${new URLSearchParams(form as never)}`);
  }

  return <main className="locanda" id="top">
    <header className="nav-shell">
      <a className="wordmark" href="#top" aria-label="Locanda Homes home">LOCANDA HOMES <small>Jareed Riyadh</small></a>
      <nav className={menuOpen ? "nav open" : "nav"} aria-label="Primary navigation">
        <a href="#homes" onClick={() => setMenuOpen(false)}>Homes</a>
        <a href="#location" onClick={() => setMenuOpen(false)}>Location</a>
        <a href="#experience" onClick={() => setMenuOpen(false)}>Experience</a>
        <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
      </nav>
      <div className="nav-tools"><span>En⌄</span><a href="#stay">Book with confidence</a></div>
      <button className="menu" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><i /><i /></button>
    </header>

    <section className="hero" aria-label="Locanda Homes">
      <img src={heroImage} alt="A Locanda residence at dusk" fetchPriority="high" />
      <div className="hero-shade" />
      <motion.div className="hero-copy" initial="hidden" animate="shown" variants={reveal} transition={{ duration: .7, ease: "easeOut" }}>
        <h1>A more considered<br />way to stay</h1><p>Jareed Riyadh</p>
      </motion.div>
      <p className="manifesto">SPACES<br />FOR PEOPLE<br />IN PLACES<br />WITH PURPOSE</p>
    </section>

    <form className="stay-search" id="stay" onSubmit={search}>
      <label><span>Check in</span><input name="checkIn" type="date" required /></label>
      <label><span>Check out</span><input name="checkOut" type="date" required /></label>
      <label><span>Guests</span><select name="guests" defaultValue="2"><option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option><option value="5">5 guests</option></select></label>
      <button type="submit">Search homes <b>→</b></button>
      {notice ? <p className="search-note" role="status">{notice}</p> : null}
    </form>

    <motion.section className="residences" id="homes" initial="hidden" whileInView="shown" viewport={{ once: true, amount: .18 }} variants={reveal} transition={{ duration: .55 }}>
      <div className="residence-intro"><div><p>Jareed Riyadh</p><h2>Distinctive homes in a remarkable setting</h2><i /></div><div><span>Refined serviced apartments in the heart of Jareed. Contemporary living, effortlessly handled.</span><a href="/client/locanda-homes/stays">Explore homes&nbsp; →</a></div></div>
      <div className="residence-grid">{homes.map((home) => <a className="residence" key={home.title} href={home.href}><img src={home.image} alt="" loading="lazy" /><strong>{home.title}</strong><em>{home.meta}</em></a>)}<a className="location-card" href="#location"><div><b>●</b><strong>Jareed<br />Riyadh</strong></div><span>View location&nbsp; →</span></a></div>
    </motion.section>

    <section className="location" id="location"><div className="location-image"><img src="https://framerusercontent.com/images/skGxDvW97BO1LMF8jlMfqR25RI.png?height=900&width=1200" alt="Jareed Compound" loading="lazy" /></div><div><p>THE SETTING</p><h2>Riyadh, within easy reach.</h2><span>Jareed Compound sits within easy reach of the city and King Khalid International Airport. A private place to settle in, with the essentials of Riyadh close by.</span><a href="/client/locanda-homes/stays">Find your stay&nbsp; →</a></div></section>
    <section className="experience" id="experience"><p>LOCANDA LIVING</p><h2>Premium living,<br />handled with care.</h2><div>{["Comfort, considered", "Professional management", "Flexible by design"].map((item, index) => <article key={item}><b>0{index + 1}</b><h3>{item}</h3><span>{index === 0 ? "Homes designed for ease, quality and the rhythm of city living." : index === 1 ? "Every property is managed with structure and responsive hospitality." : "A fitting base for a quick visit, a family stay or a longer-term home."}</span></article>)}</div></section>
    <section className="about" id="about"><p>FOR RESIDENTS AND OWNERS</p><h2>One standard of care,<br />at every touchpoint.</h2><span>At Locanda, property care and guest experience are inseparable. We create better-run homes for residents, owners and partners.</span></section>
    <footer><a className="wordmark" href="#top">LOCANDA HOMES <small>Jareed Riyadh</small></a><span>Uthman Ibn Affan Road, Al Narjis, Riyadh</span><span>© 2026 Locanda Homes</span></footer>
  </main>;
}
