# CareSync — User Guide (English draft)

> **Status: DRAFT for the project owner's review.** This is functional usage
> documentation (how the app works), not medical advice. It is written in
> English first; the **Hebrew translation and any wording for the patient's
> own reading are the owner's to approve** (per the project's Hebrew-copy and
> patient-facing approval rules). Personalise the patient section for the
> specific user before printing or sharing.

CareSync is one app with two sides. The **patient** side shows medication
reminders and is deliberately large, simple, and hard to get wrong. The
**caregiver** side is where medications, schedules, and alerts are managed
remotely.

---

## 1. Getting started (both roles)

1. Open CareSync. On first use, tap **Register** and create an account with an
   email and a password (at least 8 characters). Choose the correct role —
   **Patient** or **Caregiver** — when signing up.
2. To link a patient and caregiver: the **caregiver** adds the patient from the
   **Patients** screen. Once the link is active, the caregiver can manage that
   patient's medications and receives their alerts.
3. Forgot your password? On the login screen tap **Forgot password**, enter your
   email, and follow the link sent to your inbox.

The app remembers you — you normally stay signed in. If your session ever
expires, the app returns you to the login screen; just sign in again.

---

## 2. For the patient — taking your medications

You mostly don't need to do anything until it is time for a medication.

**When it's time for a dose:**

- Your phone shows a full-screen reminder with the medication name, the dose,
  and any instructions (for example, "take with food").
- Tap the large **MEDICATION TAKEN** button once you have taken it. That's it —
  the reminder goes away.
- Not ready yet? Tap **Remind me later** and choose 15, 30, or 60 minutes. The
  reminder will come back.

**If you miss the button:** tap the notification on your lock screen to open the
same reminder.

**No internet right now?** You can still tap **MEDICATION TAKEN**. The app
remembers your tap and the exact time, and quietly syncs it as soon as you are
back online — nothing is lost.

**History:** the **History** tab lists your past doses — taken (✓), missed (✗),
and snoozed (⏱) — so you and your caregiver can look back.

**Messages:** if your caregiver sends you an urgent message, it appears
full-screen with one **GOT IT** button. Reading it lets your caregiver know it
was delivered; tapping **GOT IT** lets them know you saw it.

---

## 3. For the patient — making the app comfortable

Open the **Settings** tab:

- **Language** — device language, עברית (Hebrew), or English.
- **High contrast** — stronger colours on a dark background, easier to read.
- **Text size** — make the text larger or smaller.

These settings are remembered. Switching between Hebrew and English changes the
screen direction (right-to-left for Hebrew) and may offer to restart the app to
apply it — restarting is safe, and declining just applies it next time you open
the app.

---

## 4. For the caregiver — the dashboard

After signing in you land on the **Dashboard**:

- Each **patient card** shows the patient and a small **adherence badge** — the
  share of doses taken over the last 30 days (green = doing well, amber = some
  missed, red = many missed). Tap the badge to open the **adherence trends**
  screen: the headline percentage plus a day-by-day bar trend.
- Tap a patient card to manage their **medications**. Tap the 💬 icon to open a
  **message thread** with them.
- The **bell** (top right) shows unread **alerts**; the number is how many are
  waiting.
- The bottom tabs cover **Medications**, **Schedules**, **Patients**, and
  **Alerts**. The gear icon (top left) opens **Settings**.

---

## 5. For the caregiver — everyday tasks

- **Add a medication:** Medications → add. Enter the name, dose, and any
  instructions.
- **Set when it's taken:** Schedules → add. Pick the medication, the times of
  day (for example 08:00 and 20:00), and which days. Times are the patient's
  local wall-clock times.
- **Watch for problems:** the **Alerts** inbox fills when a dose is missed or a
  patient snoozes too many times. Open an alert to mark it read.
- **Send an urgent message:** open the patient's message thread and type. Ticks
  next to your message show *sent*, *delivered*, and *read*. If you are offline,
  the message waits and sends automatically when you reconnect.
- **Check adherence:** the dashboard badge and the per-patient trends screen
  show how consistently doses are being taken.

---

## 6. About notifications & privacy

- Reminders and alerts arrive as phone notifications. For privacy, a
  notification **never** contains medication names or personal details — it
  simply brings you into the app, where the details are shown.
- On Android, allow notifications (and, if asked, "alarms & reminders" /
  full-screen notifications) so reminders can appear on the lock screen.

---

## 7. If something looks wrong

- **A screen shows an error with a "Try again" button:** tap it — the app
  recovers without losing your medication data.
- **You keep getting signed out:** your session may have expired (for example
  after changing your password). Sign in again.
- **A reminder seems stuck:** it stays visible until the dose is confirmed or
  the time passes — this is deliberate, so a dose is not silently forgotten.

---

## Owner's to-do before this ships

- Review and personalise the **patient** wording (§2–3) for the specific user.
- Approve the **Hebrew translation** (the app itself is already fully Hebrew;
  this guide is drafted in English first).
- Decide on distribution: printed one-pager for the patient vs. in-app help vs.
  a shared document for family caregivers.
