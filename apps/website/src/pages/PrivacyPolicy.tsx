import { Link } from 'react-router-dom';
import { TERMS_EFFECTIVE_DATE } from '@dadei/ui/lib/platform/legal/constants';
import { LegalPageShell } from '@/components/legal/LegalPageShell';

export default function PrivacyPolicy() {
  return (
    <LegalPageShell title="Privacy Policy">
      <p className="text-zinc-400">
        <strong className="text-zinc-200">Effective date:</strong> {TERMS_EFFECTIVE_DATE}
      </p>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Overview</h2>
        <p>
          dadei (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides a voice-first personal
          assistant that organizes context across your devices and helps you recall information,
          draft follow-ups, and complete tasks. This Privacy Policy explains what we collect, how we
          use it, and the choices you have.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Information we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-zinc-200">Account information</strong> — email address,
            authentication provider identifiers, and network settings such as timezone.
          </li>
          <li>
            <strong className="text-zinc-200">Voice and audio</strong> — microphone audio when you
            activate the assistant, issue voice commands, or when ambient capture is enabled on a
            device you control. Wake-word detection may run on-device before audio is sent for
            transcription.
          </li>
          <li>
            <strong className="text-zinc-200">Biometric voice data</strong> — with your explicit
            consent, voice samples used to recognize speakers in your network. You can decline
            biometric processing and still use password or OAuth sign-in.
          </li>
          <li>
            <strong className="text-zinc-200">Assistant context</strong> — conversations,
            interactions, episodic memories, proposed actions, and embeddings derived from your use
            of the service.
          </li>
          <li>
            <strong className="text-zinc-200">Connected accounts</strong> — when you link Google,
            Microsoft, or other providers, we access only the scopes you authorize (for example
            mail, calendar, or contacts).
          </li>
          <li>
            <strong className="text-zinc-200">Billing</strong> — subscription status and Stripe
            customer identifiers when you upgrade. We do not store full payment card numbers.
          </li>
          <li>
            <strong className="text-zinc-200">Technical data</strong> — app version, device
            identifiers needed for realtime sync, and standard server logs for security and
            reliability.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">How we use information</h2>
        <p>We use collected information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, secure, and improve the assistant experience</li>
          <li>Transcribe speech, extract memories, and execute actions you request</li>
          <li>Enforce subscription limits and memory retention policies for your plan</li>
          <li>Send service-related communications and respond to support requests</li>
          <li>Detect abuse, fraud, and violations of our Terms of Service</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Retention</h2>
        <p>
          We retain account data while your account is active. Episodic memories may expire
          automatically when a per-memory TTL is set, or when your subscription tier defines a
          memory retention window. When a retention limit applies, memories older than that window
          are deleted on a scheduled basis.
        </p>
        <p>
          You may delete individual memories in the app. Account deletion removes your network and
          associated data subject to our deletion process and any legal obligations to retain
          certain records.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Sharing</h2>
        <p>
          We do not sell your personal information. We share data only with service providers that
          help us operate dadei (for example cloud hosting, speech and language models, email and
          calendar APIs, and payment processing), when required by law, or to protect rights and
          safety. Connected-provider data is accessed only according to the permissions you grant.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Security</h2>
        <p>
          We use encryption in transit, access controls, and industry-standard practices to protect
          your data. No method of transmission or storage is completely secure; please use a strong
          password and keep your devices updated.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Your choices</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Revoke OAuth scopes or disconnect integrations in Settings</li>
          <li>Disable ambient capture or microphone access at the OS level</li>
          <li>Request account deletion from the app or by contacting support</li>
          <li>Where applicable law provides rights of access, correction, or portability, contact us to exercise them</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Children</h2>
        <p>
          dadei is not directed to children under 13 (or the minimum age in your jurisdiction). We
          do not knowingly collect personal information from children.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Changes</h2>
        <p>
          We may update this policy from time to time. Material changes will be reflected by an
          updated effective date and, where required, additional notice or re-acceptance in the
          product.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-primary text-xl text-zinc-100">Contact</h2>
        <p>
          Questions about privacy:{' '}
          <a
            href="https://dadei.app/support"
            className="text-emerald-300 underline decoration-emerald-500/40 hover:text-emerald-200"
          >
            dadei.app/support
          </a>
          . See also our{' '}
          <Link to="/terms" className="text-emerald-300 underline decoration-emerald-500/40 hover:text-emerald-200">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
