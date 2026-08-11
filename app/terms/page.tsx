import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | Dream Tree Stocks',
  description: 'Terms of service for Dream Tree Stocks and related One Person Empire apps.',
};

export default function TermsPage() {
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
          Terms of Service
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
            <h2 style={h2}>Agreement</h2>
            <p style={p}>
              By using <strong>Dream Tree Stocks</strong> (including Flight Deck / scanner tools) and related services at
              dreamtreestocks.com and onepersonempire.web.app (the &ldquo;Service&rdquo;), you agree to these Terms of
              Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 style={h2}>The Service</h2>
            <p style={p}>
              The Service provides research, scanning, education, and related market tools for approved users. Access may
              require Google Sign-In and operator approval. Features may change, be limited, or be discontinued at any
              time.
            </p>
          </section>

          <section>
            <h2 style={h2}>Not investment advice</h2>
            <p style={p}>
              Nothing in the Service is investment, trading, tax, or legal advice. Market data, scores, agents, charts,
              and alerts are informational only. You are solely responsible for your own decisions and risk. Past
              performance does not guarantee future results. Securities trading involves substantial risk of loss.
            </p>
          </section>

          <section>
            <h2 style={h2}>Accounts and access</h2>
            <ul style={ul}>
              <li>You must use a Google account you are authorized to use.</li>
              <li>Access is limited to approved emails / roles; approval can be revoked.</li>
              <li>You must not share credentials, scrape the Service, or attempt unauthorized access.</li>
              <li>We may suspend or terminate access for abuse, security risk, or policy violations.</li>
            </ul>
          </section>

          <section>
            <h2 style={h2}>Acceptable use</h2>
            <p style={p}>
              You agree not to misuse the Service, interfere with its operation, reverse engineer it except where
              allowed by law, or use it for unlawful activity.
            </p>
          </section>

          <section>
            <h2 style={h2}>Intellectual property</h2>
            <p style={p}>
              The Service, branding, software, and content are owned by the operator or its licensors. You receive a
              limited, revocable right to use the Service for your personal or internal business use as approved — not
              ownership of the underlying materials.
            </p>
          </section>

          <section>
            <h2 style={h2}>Third-party services</h2>
            <p style={p}>
              Sign-in and hosting rely on Google and other providers. Their terms and privacy policies also apply to
              their portions of the stack.
            </p>
          </section>

          <section>
            <h2 style={h2}>Disclaimer of warranties</h2>
            <p style={p}>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind,
              express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We
              do not warrant that data is accurate, complete, timely, or uninterrupted.
            </p>
          </section>

          <section>
            <h2 style={h2}>Limitation of liability</h2>
            <p style={p}>
              To the maximum extent permitted by law, the operator is not liable for any indirect, incidental, special,
              consequential, or trading losses arising from your use of (or inability to use) the Service, even if
              advised of the possibility. Total liability for any claim relating to the Service is limited to the
              greater of (a) amounts you paid us for the Service in the prior 12 months, or (b) zero if the Service was
              provided without charge.
            </p>
          </section>

          <section>
            <h2 style={h2}>Privacy</h2>
            <p style={p}>
              How we handle personal information is described in our{' '}
              <Link href="/privacy" style={a}>
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 style={h2}>Changes</h2>
            <p style={p}>
              We may update these Terms from time to time. Continued use after changes means you accept the updated
              Terms. The &ldquo;Last updated&rdquo; date will change when we revise them.
            </p>
          </section>

          <section>
            <h2 style={h2}>Contact</h2>
            <p style={p}>
              Questions:{' '}
              <a href="mailto:alerts@dreamtreestocks.com" style={a}>
                alerts@dreamtreestocks.com
              </a>
              .
            </p>
          </section>
        </div>

        <p style={{ marginTop: 40, fontSize: 14, color: '#8fa3bf', fontFamily: 'system-ui, sans-serif' }}>
          <Link href="/scanner" style={a}>
            Back to Dream Tree Stocks
          </Link>
          {' · '}
          <Link href="/privacy" style={a}>
            Privacy Policy
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
