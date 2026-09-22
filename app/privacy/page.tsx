import Link from "next/link";

export const metadata = { title: "Privacy Policy · TCF Material" };

export default function PrivacyPage() {
  return (
    <div className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          TCF<span>Material</span>
        </Link>
        <div className="nav-actions">
          <Link className="nav-link" href="/">
            Home
          </Link>
        </div>
      </nav>
      <main className="legal-page">
        <header className="legal-header">
          <span className="eyebrow">LEGAL</span>
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: September 2026</p>
        </header>

        <section className="legal-section">
          <h2>What we collect</h2>
          <p>
            When you create an account, we collect your name, email address,
            and, if you sign in with Google, the basic profile information
            Google shares with us. If you contact us or fill in optional
            profile details, we may also store your phone number, country,
            and timezone.
          </p>
          <p>
            When you practise on the site, we store your test attempts,
            answers, scores, and progress so you can track your improvement
            over time. Speaking-module recordings you submit are stored so
            they can be played back and reviewed.
          </p>
        </section>

        <section className="legal-section">
          <h2>Payments</h2>
          <p>
            Payments are processed by Stripe. We do not receive or store your
            full card details — Stripe handles that directly. We keep a
            record of your transactions (amount, plan, and status) so we can
            manage your access and provide support.
          </p>
        </section>

        <section className="legal-section">
          <h2>How we use your information</h2>
          <p>
            We use your information to provide and improve the practice
            platform, manage your account and subscription, communicate with
            you about your account, and keep the service secure.
          </p>
        </section>

        <section className="legal-section">
          <h2>Sharing with third parties</h2>
          <p>
            We share information only where necessary to run the service:
            with Stripe to process payments, with Google for sign-in, and
            with our hosting and database providers to store your data
            securely. We do not sell your personal information.
          </p>
        </section>

        <section className="legal-section">
          <h2>Cookies</h2>
          <p>
            We use a small number of cookies required to keep you signed in
            and to remember your session. We do not use third-party
            advertising or tracking cookies.
          </p>
        </section>

        <section className="legal-section">
          <h2>Data retention</h2>
          <p>
            We keep your account and progress data for as long as your
            account is active. You can request that we delete your account
            and associated data at any time by contacting us.
          </p>
        </section>

        <section className="legal-section">
          <h2>Your choices</h2>
          <p>
            You can request access to, correction of, or deletion of your
            personal information at any time by contacting us using the
            details below.
          </p>
        </section>

        <section className="legal-section">
          <h2>Contact</h2>
          <p>
            Questions about this policy or your data can be sent to{" "}
            <a href="mailto:tcfmaterial@gmail.com">tcfmaterial@gmail.com</a>.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-mark">TM</span>
          <div>
            <strong>TCF Material</strong>
            <p>Focused French preparation for confident exam day performance.</p>
          </div>
        </div>
        <small>© 2026 TCF Material. Made for focused French learners.</small>
      </footer>
    </div>
  );
}
