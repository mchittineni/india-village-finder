# Security Policy

This project is a **static website plus a data pipeline** — there is no server,
login, or user data. The realistic security surface is small, but we still take
reports seriously.

## Supported versions

The deployed site always tracks the latest commit on `main`. Only `main` is
supported; please report issues against the current version.

| Version             | Supported |
| ------------------- | --------- |
| `main` (latest)     | ✅        |
| older tags/releases | ❌        |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Instead, use **[GitHub Private Vulnerability Reporting](https://github.com/mchittineni/india-village-finder/security/advisories/new)**
(Security → Report a vulnerability), or contact the maintainer
[@mchittineni](https://github.com/mchittineni) privately.

When reporting, please include:

- A description of the issue and its potential impact
- Steps to reproduce (and a proof of concept if possible)
- The affected page/URL or file

We aim to acknowledge reports within a few days and to address confirmed issues
promptly. Examples relevant to this project include cross-site scripting (XSS) in
the map UI, dependency vulnerabilities, or a supply-chain issue in the build/
deploy workflows.

## Data accuracy ≠ security

Incorrect or outdated village/pincode data is **not** a security issue — please
file a [Data correction issue](../../issues/new?template=data_correction.yml)
instead. The data originates from the Government of India's Local Government
Directory and may lag recent administrative changes.
