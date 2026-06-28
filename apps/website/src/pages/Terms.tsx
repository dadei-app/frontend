import { Link } from 'react-router-dom';
import {
  TERMS_EFFECTIVE_DATE,
  TERMS_VERSION,
} from '@dadei/ui/lib/platform/legal/constants';
import { LegalPageShell } from '@/components/legal/LegalPageShell';

export default function Terms() {
  return (
    <LegalPageShell title="Terms of Service">
      <p className="text-zinc-400">
        <strong className="text-zinc-200">Effective date:</strong> {TERMS_EFFECTIVE_DATE}
      </p>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Agreement</h2>
        <p>
          By creating an account or using dadei, you agree to these Terms of Service and our{' '}
          <Link to="/privacy" className="text-emerald-300 underline decoration-emerald-500/40 hover:text-emerald-200">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">The service</h2>
        <p>
          dadei is a personal assistant that captures context from your day, answers recall
          questions, and helps with reminders, drafts, and integrations you connect. Features vary
          by platform and subscription tier. We may change or discontinue features with reasonable
          notice where practicable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Accounts and eligibility</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>You must provide accurate account information and keep credentials secure.</li>
          <li>You are responsible for activity under your account.</li>
          <li>You must be old enough to form a binding contract where you live.</li>
          <li>
            Password registration requires acceptance of these Terms and explicit consent to
            biometric voice processing where offered.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use dadei to violate law or third-party rights</li>
          <li>Attempt to probe, scrape, or disrupt our systems without authorization</li>
          <li>Upload malware or use the service to harass, spam, or impersonate others</li>
          <li>Circumvent subscription limits, retention controls, or security measures</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Voice, biometric, and third-party data</h2>
        <p>
          Microphone access and optional biometric voice features require your consent and
          device-level permissions. When you connect external accounts, you authorize dadei to
          access data within the scopes you approve. You represent that you have the right to provide
          any content or credentials you supply.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Subscriptions and billing</h2>
        <p>
          Paid plans are billed through Stripe according to the prices shown at purchase. Fees are
          non-refundable except where required by law. You may cancel renewal in accordance with
          in-app subscription controls; access may continue until the end of the current billing
          period.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Intellectual property</h2>
        <p>
          dadei and its branding, software, and documentation are owned by us or our licensors. You
          retain ownership of content you submit. You grant us a limited license to process that
          content solely to operate and improve the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. ASSISTANT OUTPUT
          MAY BE INACCURATE OR INCOMPLETE. YOU ARE RESPONSIBLE FOR REVIEWING ACTIONS, DRAFTS, AND
          SUGGESTIONS BEFORE RELYING ON THEM, ESPECIALLY FOR LEGAL, MEDICAL, OR FINANCIAL MATTERS.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL.
          OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF
          USD $100 OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Termination</h2>
        <p>
          You may stop using dadei at any time. We may suspend or terminate access for breach of
          these Terms or to protect the service. Provisions that by nature should survive termination
          (including disclaimers, limitations of liability, and dispute terms) will survive.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Changes</h2>
        <p>
          We may update these Terms. When we do, we will publish a new effective date and version.
          Continued use after changes become effective constitutes acceptance of the updated Terms
          where permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Contact</h2>
        <p>
          Questions about these Terms:{' '}
          <a
            href="https://dadei.app/support"
            className="text-emerald-300 underline decoration-emerald-500/40 hover:text-emerald-200"
          >
            dadei.app/support
          </a>
          .
        </p>
      </section>

      <footer className="border-t border-white/10 pt-6 text-sm text-zinc-500">
        Document version {TERMS_VERSION}
      </footer>
    </LegalPageShell>
  );
}
