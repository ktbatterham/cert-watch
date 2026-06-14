/**
 * EAS Metadata config for Cert Watch
 * Run: eas metadata:push
 * Docs: https://docs.expo.dev/eas/metadata/
 */

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  apple: {
    info: {
      'en-US': {
        title: 'Cert Watch',
        subtitle: 'TLS certificate expiry alerts',

        description: `Cert Watch keeps a silent eye on the TLS certificates of any domain you care about. Add a domain, let it check, and you get an instant snapshot of the certificate — issuer, expiry date, and how many days are left. From then on it checks automatically in the background and notifies you before anything lapses.

Expired certificates are embarrassing at best, catastrophic at worst. Visitors see a security warning, browsers block the page, and trust evaporates instantly. Cert Watch catches the problem days or weeks before it happens.

Add any domain you want to watch. Cert Watch checks the certificate transparency logs, finds the current certificate, and stores a baseline. Background checks run every 1, 6, or 24 hours depending on what you set. You get a push notification at 30, 14, 7, and 1 day before expiry — and again the moment a certificate is renewed or replaced.

The event log keeps a full history of every change, so you can see exactly when a certificate was renewed, who issued the new one, and whether anything unexpected happened.

Built for developers managing their own infrastructure, security engineers keeping tabs on third-party services, or anyone who has ever had a certificate lapse at the worst possible moment.

No account required. Everything runs on device.

──

Part of the SecURL suite — passive external security monitoring for the web.

• Header Watch (free) — monitor security headers for drift and get alerted when anything changes after a deployment or CDN update.
• SecURL (free, securl.online) — full external security posture scan: headers, TLS, DNS/email trust, third-party surface, and a scored grade from A+ to F.`,

        keywords: [
          'ssl',
          'tls',
          'certificate',
          'expiry',
          'monitor',
          'https',
          'alert',
          'domain',
          'security',
          'notification',
        ],

        whatsNew: 'Bug fixes and performance improvements.',
      },
    },
  },
};
