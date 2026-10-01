import LegalFooter from "../components/LegalFooter";
import { isContactConfigured, siteConfig } from "../lib/siteConfig";

const policies = {
  privacy: {
    title: "Privacy Policy",
    intro: "This notice explains how the school portal is intended to handle personal information used to administer school operations.",
    sections: [
      ["Information we may handle", "Depending on the feature used, the portal may process student and guardian details, contact information, attendance records, fee records, payment information, and staff account information. Only information needed for the relevant school function should be entered."],
      ["How information is used", "Information is used to administer student records, attendance, school fees, receipts, reports, staff access, and payment processing. Payment card details are handled by the payment provider rather than stored directly by this portal."],
      ["Access and security", "Access is role-based. Staff should only receive access required for their duties. Staff credentials must remain private and accounts should be disabled when authorisation ends."],
      ["Third parties", "The portal uses Supabase for application data and authentication and Paystack for payment processing. Optional analytics or advertising scripts should not be added without reviewing privacy and consent requirements first."],
      ["Privacy contact", isContactConfigured ? "For privacy questions, contact " + (siteConfig.privacyEmail || siteConfig.email || siteConfig.phone) + "." : "The privacy contact has not yet been configured. Set VITE_PRIVACY_EMAIL or VITE_SCHOOL_EMAIL before production launch."]
    ]
  },
  terms: {
    title: "Terms of Use",
    intro: "By using this portal, users agree to use it only for legitimate school administration and payment purposes.",
    sections: [
      ["Authorised use", "Staff accounts are personal to the authorised staff member. Do not share passwords or use another person's account."],
      ["Accuracy", "Users are responsible for entering accurate information and reporting incorrect records to an authorised school administrator."],
      ["Payments", "Payments are processed through the payment provider shown at checkout. A payment is not treated as final in school records until the portal verifies the transaction."],
      ["Availability", "The school may temporarily restrict access for maintenance, security, or operational reasons."],
      ["Contact details", isContactConfigured ? "Current contact details: " + [siteConfig.email, siteConfig.phone, siteConfig.address].filter(Boolean).join(" · ") : "School contact details must be configured before this portal is treated as production-ready."]
    ]
  },
  refund: {
    title: "Refund Policy",
    intro: "Refund decisions must follow the school's actual approved fee and refund rules. This portal must not invent or imply a refund entitlement that the school has not approved.",
    sections: [
      ["Before payment", "Parents or guardians should confirm the fee, student account, and amount before completing payment."],
      ["Refund eligibility", "Eligibility, exclusions, approval authority, timelines, and refund method must be supplied by school administration. No additional rule is created by this portal."],
      ["How to request a refund", isContactConfigured ? "Submit the request through the school's official contact channel: " + [siteConfig.email, siteConfig.phone].filter(Boolean).join(" or ") + "." : "Configure the school's official email or phone before publishing refund instructions."],
      ["Production requirement", "The school administrator must approve the actual refund terms before this page is considered complete."]
    ]
  },
  cookies: {
    title: "Cookies & Tracking",
    intro: "The current application does not intentionally load advertising or analytics trackers. It may use browser storage or technical mechanisms required for authentication and application operation.",
    sections: [
      ["Essential technology", "Technical storage may be used to keep an authenticated session or application state. These mechanisms support the requested service."],
      ["Optional tracking", "No optional analytics, advertising, social-media tracking, or behavioural profiling script is intentionally included in the current application. If one is added later, review privacy and consent requirements before deployment."],
      ["Third-party services", "Supabase and Paystack are used for core application functions. Their own privacy and cookie practices may apply when their services are used."],
      ["Consent", "Because optional tracking is not currently enabled, this application does not display a marketing-cookie consent banner. Adding optional tracking changes this requirement."]
    ]
  },
  accessibility: {
    title: "Accessibility Statement",
    intro: "MEKA School uses keyboard access, readable contrast, semantic labels, responsive layouts, and reduced-motion support as baseline accessibility requirements.",
    sections: [
      ["Keyboard access", "Interactive controls should be reachable and usable with a keyboard. Visible focus indicators are enabled globally."],
      ["Forms", "Form controls should have explicit labels, useful input types, and clear error messages. Placeholder text must not replace labels."],
      ["Colour and contrast", "Interactive text and controls use contrast-safe colours where possible. Colour must not be the only way to communicate meaning."],
      ["Images and media", "Informative images should have meaningful alternative text; decorative images should use empty alt text."],
      ["Feedback", "Report an accessibility barrier to the school using its configured contact channel."]
    ]
  }
};

export default function LegalPage({ type }) {
  const policy = policies[type] || policies.privacy;

  return (
    <main className="legal-page">
      <a className="skip-link" href="#legal-content">Skip to content</a>
      <div className="legal-shell" id="legal-content">
        <header className="legal-header">
          <a href="/" className="legal-brand" aria-label="MEKA School home">MEKA School</a>
          <a href="/pay" className="legal-payment-link">Go to payment</a>
        </header>

        <article className="legal-card">
          <p className="legal-kicker">{siteConfig.name}</p>
          <h1>{policy.title}</h1>
          <p className="legal-intro">{policy.intro}</p>

          {policy.sections.map(([heading, body]) => (
            <section key={heading} className="legal-section">
              <h2>{heading}</h2>
              <p>{body}</p>
            </section>
          ))}

          {!isContactConfigured && (
            <aside className="legal-warning" role="note">
              <strong>Production configuration required:</strong> school contact details are not configured. Add the VITE_SCHOOL_* environment variables before publishing this portal for real users.
            </aside>
          )}
        </article>

        <LegalFooter />
      </div>
    </main>
  );
}
