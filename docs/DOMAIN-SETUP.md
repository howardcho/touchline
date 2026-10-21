# Connect agedathletics.com through GoDaddy

GitHub repository: `howardcho/touchline`.
Public website source: `main` branch, `/docs` folder.
Custom domain: `agedathletics.com` (already declared in `docs/CNAME`).

## GoDaddy DNS records

In GoDaddy → Domain Portfolio → agedathletics.com → DNS, replace the existing website/parking A records for `@` with these four separate records:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | @ | 185.199.108.153 | Default or 1 hour |
| A | @ | 185.199.109.153 | Default or 1 hour |
| A | @ | 185.199.110.153 | Default or 1 hour |
| A | @ | 185.199.111.153 | Default or 1 hour |
| CNAME | www | howardcho.github.io | Default or 1 hour |

The CNAME value is the account hostname, with no `https://`, path, or repository name. Replace an existing `www` website record rather than creating a duplicate. Remove conflicting website A/AAAA/forwarding records for `@` or `www`; keep nameservers, MX, email-related TXT records, and unrelated subdomains unchanged. This replaces the website at the apex domain, not email hosting.

## GitHub Pages

Under repository **Settings → Pages**:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/docs**
- Custom domain: **agedathletics.com**
- **Enforce HTTPS** once GitHub provisions the certificate.

GitHub can only finish its DNS check and certificate provisioning after the GoDaddy records resolve correctly. Changes can take up to 24 hours to propagate, though they often appear sooner. Once configured, `www.agedathletics.com` redirects to the chosen apex domain.

Only `docs/` is published: the native app's UI, audio, source, and build files are not a public browser application. The new website is a single-page native-app showcase.

Official references: [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [GoDaddy A records](https://www.godaddy.com/help/add-or-edit-an-a-record-42546).
