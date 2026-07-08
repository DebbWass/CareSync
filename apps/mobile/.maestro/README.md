# CareSync — Maestro E2E suite (release gate)

These flows are the manual/automated **release gate** for the app: they drive the
real UI end-to-end and are run during the physical-device validation pass before
promoting `develop → main`.

> **They run on a build, not in CI.** Maestro needs the app installed on a device
> or emulator, so these are not part of the 8-job CI gate. Run them during the
> release validation pass on a **dev build** (Expo Go can't receive push or force
> RTL). The flows are authored against the current UI text/labels but must be
> **device-validated** each release — treat a first run as the validation, not a
> guarantee.

## Prerequisites

- A CareSync **dev build** installed (`eas build --profile development`), or the
  Expo Go client for the login/navigation flows only.
- The backend seeded with the standard accounts (`npm run db:reset` against the
  target stack). Seed logins: `patient@caresync.test` / `caregiver@caresync.test`,
  password `Password123!`.
- Maestro installed (`scripts/maestro-install.sh`).
- In `config.yaml`, set `appId` to your dev build's bundle id (`com.caresync.app`)
  instead of `host.exp.exponent` when running against a dev build.

## Credentials

Flows read caregiver/patient credentials from env vars:

```bash
export CAREGIVER_EMAIL=caregiver@caresync.test
export CAREGIVER_PASSWORD=Password123!
export PATIENT_EMAIL=patient@caresync.test
export PATIENT_PASSWORD=Password123!
```

## Running

```bash
cd apps/mobile
maestro test .maestro/                       # the whole suite
maestro test --include-tags release .maestro # only the tagged release flows
maestro test .maestro/06_caregiver_adherence.yaml   # a single flow
```

## Coverage

| Flow                                 | Covers                                      |
| ------------------------------------ | ------------------------------------------- |
| `01_caregiver_login.yaml`            | caregiver sign-in / sign-out                |
| `02_caregiver_add_medication.yaml`   | medication add + remove                     |
| `03_patient_login_home.yaml`         | patient home: reminder confirm or all-clear |
| `04_caregiver_alerts.yaml`           | alerts inbox                                |
| `05_patient_confirm_medication.yaml` | patient dose confirm                        |
| `06_caregiver_adherence.yaml`        | M10 adherence badge → trends screen         |

### Not yet covered (add during the device pass)

- **M9 messaging** — needs two participants (caregiver send → patient popup →
  receipt), awkward for a single-device flow; script as two coordinated runs.
- **M11 offline confirm** — toggle airplane mode after tapping "MEDICATION
  TAKEN", reconnect, and assert the dose syncs; Maestro's network control varies
  by platform, so validate manually first.
- **M6 Hebrew/RTL** — a settings → עברית → restart-prompt flow (also on the
  backlog).
