import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Dream Tree Stocks',
  description: 'Privacy policy for Dream Tree Stocks and related One Person Empire apps.',
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #0c1220 0%, #151b2e 45%, #0a0f18 100%)',
        color: '#e8eef7',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <p style={{ margin: 0, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8fa3bf' }}>
          Dream Tree Stocks
        </p>
        <h1 style={{ margin: '12px 0 8px', fontSize: 'clamp(2rem, 5vw, 2.75rem)', fontWeight: 600, lineHeight: 1.15 }}>
          Privacy Policy
        </h1>
        <p style={{ margin: '0 0 32px', color: '#9eb0c9', fontSize: 15 }}>
          Last updated: August 4, 2026
        </p>

        <div
          style={{
            display: 'grid',
            gap: 22,
            fontSize: 16,
            lineHeight: 1.65,
            color: '#d5deeb',
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          }}
        >
          <section>
            <h2 style={h2}>Who we are</h2>
            <p style={p}>
              This policy covers <strong>Dream Tree Stocks</strong> (including Flight Deck / scanner tools) and related
              services operated under One Person Empire, available at dreamtreestocks.com and onepersonempire.web.app
              (the &ldquo;Service&rdquo;).
            </p>
          </section>

          <section>
            <h2 style={h2}>Information we collect</h2>
            <ul style={ul}>
              <li>
                <strong>Google Sign-In:</strong> when you sign in, we receive your Google account email, name, profile
                picture URL, and Google account identifier needed to create a session.
              </li>
              <li>
                <strong>Access control:</strong> we store whether your email is approved for scanner access and your role
                (for example viewer or developer).
              </li>
              <li>
                <strong>Session cookies:</strong> we set an HTTP-only session cookie (<code>__session</code>) so you stay
                signed in.
              </li>
              <li>
                <strong>Product usage:</strong> we may store app preferences and operator data you enter in the Service
                (for example alert settings or journal entries you create).
              </li>
              <li>
                <strong>Security events:</strong> if Google sends Cross-Account Protection notices about your account, we
                may record a revocation so sessions can be locked.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>How we use information</h2>
            <ul style={ul}>
              <li>Authenticate you and keep you signed in</li>
              <li>Authorize access to scanner tools and developer features</li>
              <li>Operate product features you use (alerts, dashboards, saved settings)</li>
              <li>Protect the Service against unauthorized access and abuse</li>
              <li>Contact you about access or security issues when needed</li>
            </ul>
            <p style={p}>We do not sell your personal information.</p>
          </section>

          <section>
            <h2 style={h2}>Sharing</h2>
            <p style={p}>
              We use infrastructure providers that process data on our behalf (for example Google Cloud / Firebase for
              hosting, auth-related storage, and Google Identity for Sign-In). We do not share your account data with
              third parties for their advertising.
            </p>
          </section>

          <section>
            <h2 style={h2}>Data retention</h2>
            <p style={p}>
              Sessions expire after a limited period. Access records and security revocations are kept while needed to
              operate and secure the Service. You can request deletion of your access record by contacting us.
            </p>
          </section>

          <section>
            <h2 style={h2}>Your choices</h2>
            <ul style={ul}>
              <li>Sign out of the Service at any time</li>
              <li>Revoke Google access from your Google Account permissions</li>
              <li>Request removal of scanner access by contacting support</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>Children</h2>
            <p style={p}>The Service is not directed to children under 13, and we do not knowingly collect their data.</p>
          </section>

          <section>
            <h2 style={h2}>Contact</h2>
            <p style={p}>
              Questions about privacy or access: use the support email shown on the Google sign-in / consent screen for
              this app, or email{' '}
              <a href="mailto:alerts@dreamtreestocks.com" style={a}>
                alerts@dreamtreestocks.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 style={h2}>Changes</h2>
            <p style={p}>
              We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the top will change when
              we do.
            </p>
          </section>
        </div>

        <p style={{ marginTop: 40, fontSize: 14, color: '#8fa3bf', fontFamily: 'system-ui, sans-serif' }}>
          <Link href="/scanner" style={a}>
            Back to Dream Tree Stocks
          </Link>
        </p>
      </div>
    </main>
  );
}

const h2: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 18,
  fontWeight: 650,
  color: '#f2f6fc',
  fontFamily: 'Georgia, "Times New Roman", serif',
};

const p: CSSProperties = { margin: 0 };

const ul: CSSProperties = { margin: 0, paddingLeft: 20, display: 'grid', gap: 8 };

const a: CSSProperties = { color: '#9ec5ff', textDecoration: 'underline' };
