import { siteConfig } from "../lib/siteConfig";

export default function LegalFooter() {
  return (
    <footer className="legal-footer" aria-label="Legal and accessibility links">
      <div>
        <strong>{siteConfig.name}</strong>
        <span>School management and fee payment portal</span>
      </div>
      <nav className="legal-footer-links" aria-label="Legal">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/refund">Refunds</a>
        <a href="/cookies">Cookies</a>
        <a href="/accessibility">Accessibility</a>
      </nav>
    </footer>
  );
}
