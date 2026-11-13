# Online booking

The `/en/booking` and `/pl/booking` pages show the visitor a calendar, the free hours of the chosen day and a contact form. The chosen time is reserved at once and disappears for everyone else. The visitor gets a confirmation e-mail; the photographer gets an e-mail with the contacts, the time and a cancellation link.

Below is the complete setup from scratch: Google Cloud, Google Calendar, Gmail, Vercel, the checks, and what to do when something does not work. Nothing has to be paid for and Google Workspace is not needed: a regular Gmail account is enough.

The Google screens are described with their English labels. If your Google account is in another language, the buttons are in the same places.

## Contents

- [How it works](#how-it-works)
- [What you need](#what-you-need)
- [Step 1. Google Cloud: a project](#step-1-google-cloud-a-project)
- [Step 2. Enable the Google Calendar API](#step-2-enable-the-google-calendar-api)
- [Step 3. Service account and key](#step-3-service-account-and-key)
- [Step 4. The "Bookings" calendar](#step-4-the-bookings-calendar)
- [Step 5. Your own calendars](#step-5-your-own-calendars)
- [Step 6. Gmail app password](#step-6-gmail-app-password)
- [Step 7. Secret for cancellation links](#step-7-secret-for-cancellation-links)
- [Step 8. Telegram](#step-8-telegram)
- [Step 9. Add the variables to Vercel](#step-9-add-the-variables-to-vercel)
- [Step 10. Check](#step-10-check)
- [Blocking time](#blocking-time)
- [What reservations look like](#what-reservations-look-like)
- [Cancelling a reservation](#cancelling-a-reservation)
- [When something does not work](#when-something-does-not-work)
- [Variables](#variables)
- [Security and replacing keys](#security-and-replacing-keys)

## How it works

Everything lives in Google Calendar; there is no separate admin panel.

- Every day is open for booking within the daily window. The window is the same for all days and is set in the site settings (the `BOOKING_WINDOW` variable), 08:00–22:00 by default.
- Time is blocked by calendar events. The site looks in two places: the **photographer's own calendars** (work, personal plans, whatever already exists) and a separate **Bookings** calendar, where the site writes reservations itself. Any event in these calendars makes the time busy, whatever its title.
- A session starts on the hour (18:00, 19:00, but not 18:30), lasts 1, 2 or 3 hours, must fit entirely inside the window and must not overlap any event. There is no buffer between sessions: an event until 18:30 leaves 19:00 as the first start on the hour, and a reservation until 20:00 lets the next one start at 20:00.
- Bookings can be made no less than 24 hours and no more than a year ahead.
- All times are Warsaw time (`Europe/Warsaw`); the visitor's time zone is ignored. The Google calendars are best kept in the Warsaw time zone too.
- Calendar changes reach the site within a minute.

The site reads and writes the calendars through a Google **service account**: a technical user with its own e-mail of the form `...@...iam.gserviceaccount.com`. It gets access to calendars just like a person does, through the calendar's "Settings and sharing". The site sends e-mail from the photographer's Gmail with an app password.

```
Visitor ─► site on Vercel ─┬─► Google Calendar API (service account)
                           │     ├─ reads free/busy of the photographer's own calendars
                           │     └─ reads and writes the Bookings calendar
                           └─► smtp.gmail.com (app password)
                                 └─ e-mails to the visitor and the photographer
```

## What you need

- The photographer's Google account: the one whose Calendar holds the schedule and whose Gmail will send the e-mails. Everything below is done while signed in to it.
- A phone for Google 2-Step Verification (step 6).
- Access to the project on https://vercel.com (step 9).
- About 30–40 minutes.

It helps to keep a note and collect the values in it as you go; at the end they go into Vercel:

```
BOOKING_GOOGLE_CLIENT_EMAIL=
BOOKING_GOOGLE_PRIVATE_KEY=
BOOKING_CALENDAR_ID=
BOOKING_BLOCKING_CALENDAR_IDS=
BOOKING_GMAIL_ADDRESS=
BOOKING_GMAIL_APP_PASSWORD=
BOOKING_TOKEN_SECRET=
NEXT_PUBLIC_SITE_URL=
```

Do not share or forward this note: it contains the mail password and the key to the calendars. Delete it after step 9.

## Step 1. Google Cloud: a project

Google Cloud is the console where technical access to Google services is created. A project there is free and needs no bank card.

1. Open https://console.cloud.google.com signed in as the photographer. The account is shown by the avatar in the top right corner.
2. On the first visit Google asks for a country and to accept the Terms of Service: tick it and press "Agree and continue". If it offers a Free trial that asks for a card, close it; it is not needed.
3. At the top left, next to the Google Cloud logo, open the project picker (it says "Select a project" or the name of the current project) → "New project" in the window that opens.
4. Any name, for example `Booking`. Leave "Location" as it is ("No organization"). Press "Create".
5. Wait a few seconds until the bell at the top right says the project is created, and **select this project** in the same picker at the top. Everything else is done inside it: its name must be visible at the top of the page.

## Step 2. Enable the Google Calendar API

Without this the site gets the error "Google Calendar API has not been used in project … or it is disabled".

1. Left menu (☰) → "APIs & Services" → "Library". Or go straight to https://console.cloud.google.com/apis/library/calendar-json.googleapis.com.
2. Search for `Google Calendar API` and open the card with exactly that name (not "CalDAV API").
3. Press "Enable". If the button says "Manage", the API is already enabled.

The OAuth consent screen that the console may suggest setting up is **not needed**: the service account works without it. The "Create credentials to use this API" banner can be ignored too; the credentials are created in the next step.

## Step 3. Service account and key

1. Left menu → "IAM & Admin" → "Service Accounts". Or https://console.cloud.google.com/iam-admin/serviceaccounts. Check that the project from step 1 is selected at the top.
2. "Create service account".
3. First screen: a name, for example `booking-site`. The ID is filled in automatically. The description is optional. "Create and continue".
4. Second screen, "Permissions": **select nothing**, no role is needed. Calendar access is not granted here but in Calendar itself. "Continue".
5. Skip the third screen as well. "Done".
6. The list now shows an account with an e-mail like `booking-site@booking-123456.iam.gserviceaccount.com`. Click that e-mail.
7. "Keys" tab → "Add key" → "Create new key" → type **JSON** → "Create". A file like `booking-123456-1a2b3c4d5e6f.json` is downloaded.
8. Open the file in any text editor (TextEdit, Notepad, VS Code). It contains JSON. Two fields are needed:

   | Field in the file | Where it goes |
   | --- | --- |
   | `client_email` | `BOOKING_GOOGLE_CLIENT_EMAIL`. The service account's e-mail, the same as in the list from item 6. You will need it again in steps 4 and 5. |
   | `private_key` | `BOOKING_GOOGLE_PRIVATE_KEY`. A long quoted string from `-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----\n`. Copy **what is between the quotes**, in full, with every `\n` inside; the site turns them into line breaks. Do not copy the quotes themselves. |

The key file is a password to the calendars. Do not forward it, put it in the project or upload it to a cloud drive. Once the values are in Vercel and everything works, delete the file: if the key is needed again, it is simpler to create a new one (see [Security and replacing keys](#security-and-replacing-keys)).

If item 7 shows "Service account key creation is disabled", the Google account belongs to an organization (a work or school Google Workspace) whose administrator has forbidden keys. The simplest way out is to start again with a personal Gmail account; otherwise the administrator has to lift the `iam.disableServiceAccountKeyCreation` policy for this project.

## Step 4. The "Bookings" calendar

A separate calendar keeps the site's reservations apart from everything else and lets the site write only there. This is done in Google Calendar in a desktop browser; the mobile app does not have these settings.

1. Open https://calendar.google.com with the same account.
2. On the left, next to "Other calendars", press "+" → "Create new calendar".
3. Name: `Bookings`. Time zone: Warsaw ("Central European Time — Warsaw"). "Create calendar".
4. In the "My calendars" list on the left, hover over `Bookings` → three dots → "Settings and sharing".
5. Section "Share with specific people or groups" → "Add people and groups".
6. Paste the service account's e-mail (`client_email` from step 3). Google may warn that the address is outside your organization or contacts; that is fine.
7. In the permissions list choose **"Make changes to events"**. Not "See all event details": with read-only access the site cannot create reservations. "Send".
8. Scroll down to "Integrate calendar" and copy the **"Calendar ID"**, a string like `c_1a2b3c...@group.calendar.google.com`. This is `BOOKING_CALENDAR_ID`.

The service account does not need to "accept" anything: access works right after "Send".

The site creates events only in this calendar, but it also counts this calendar as busy: an event added to Bookings by hand blocks the time just like a reservation.

## Step 5. Your own calendars

The site needs to know when the photographer is busy, but not with what. So the photographer's own calendars only share free/busy.

1. Decide which calendars should block time. Usually that is the main calendar (named after the owner) and, if there are any, separate ones like "Work" or "Family". Holidays, birthdays and calendars subscribed from others are usually not needed.
2. For each such calendar: hover over it on the left → three dots → "Settings and sharing".
3. "Share with specific people or groups" → "Add people and groups" → the service account's e-mail → permission **"See only free/busy (hide details)"**. "Send".
4. Under "Integrate calendar", copy the "Calendar ID". For the main calendar it is simply the Gmail address (`name@gmail.com`); for the others it is `...@group.calendar.google.com`.
5. All these IDs, comma-separated without spaces, are `BOOKING_BLOCKING_CALENDAR_IDS`. For example: `name@gmail.com,c_9f8e7d...@group.calendar.google.com`. Do not add the Bookings calendar here; it is counted automatically. At least one calendar is required.

If a calendar is missing from the list, the site does not see its events and keeps offering that time. A calendar the site has no access to, on the other hand, breaks booking entirely: the page shows an error until access is granted or the ID is removed from the list.

A calendar owned by another account (for example a work calendar shared with the photographer) can be connected only if its owner gives the service account free/busy access as in items 2–3.

## Step 6. Gmail app password

E-mails are sent from the photographer's Gmail address over SMTP. For that the site needs not the regular password but a separate "app password": 16 letters that work only for mail and can be revoked without changing the main password.

1. Open https://myaccount.google.com/security with the same account.
2. Under "How you sign in to Google", open **"2-Step Verification"** and turn it on if it is off: Google asks to confirm a phone number with an SMS code. App passwords are not available without 2-Step Verification.
3. Open https://myaccount.google.com/apppasswords (the "App passwords" page can also be found with the search box at the top of the account page).
4. Enter a name, for example `Booking site` → "Create".
5. Google shows a password like `abcd efgh ijkl mnop` once. Copy it **without spaces** (`abcdefghijklmnop`); this is `BOOKING_GMAIL_APP_PASSWORD`. It cannot be shown again, only replaced with a new one.
6. The full address of this mailbox (`name@gmail.com`) is `BOOKING_GMAIL_ADDRESS`. It must be the same account the app password was created for.

Notifications for the photographer go to `BOOKING_GMAIL_ADDRESS`; to use another address, set it in `BOOKING_NOTIFY_EMAIL`. E-mails sent by the site are visible in Gmail under "Sent".

If the "App passwords" page is missing or says "The setting you are looking for is not available for your account":

- 2-Step Verification is not on yet (item 2);
- sign-in uses **only** passkeys or security keys: add a second method, such as SMS or Google Authenticator;
- Advanced Protection is on: app passwords do not work with it;
- it is a Google Workspace work account and the administrator has disabled app passwords.

A regular Gmail account sends at most about 500 e-mails a day. Each reservation sends 2, so there is plenty of headroom.

## Step 7. Secret for cancellation links

Cancellation links in the e-mails are signed with a secret so they cannot be forged. It is just a long random string.

- On a Mac or Linux: open Terminal and run `openssl rand -hex 32`. You get 64 characters of digits and letters a–f.
- Without a terminal: any password generator (for example in a password manager) set to 40+ letters and digits.

This is `BOOKING_TOKEN_SECRET`. **Do not change it** while there are future reservations: after a change, every cancellation link already sent stops working.

## Step 8. Telegram

**Not working yet**: the site already understands the Telegram variables, but sending messages is not implemented (see `SPEC-telegram.md`). For now all notifications arrive by e-mail only. The bot can be created in advance; once sending is added, it will be enough to set two variables.

1. In Telegram open @BotFather → `/newbot`. Choose any name and a username (Latin letters, ending in `bot`, for example `photo_booking_bot`). BotFather sends a **token** like `123456789:AAF...`; this is `BOOKING_TELEGRAM_BOT_TOKEN`. The token is a password too; do not share it.
2. Open your new bot and press "Start" (or send it anything); otherwise the bot cannot write first.
3. Find your **chat id**, a number, in one of these ways:
   - open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser (with the token from item 1 in place of `<TOKEN>`, without the brackets) and find `"chat":{"id":123456789` in the response; that number is it. If the response is `{"ok":true,"result":[]}`, send the bot another message and reload the page;
   - or message @userinfobot, which replies with your `Id`.

   This is `BOOKING_TELEGRAM_CHAT_ID`.

Both variables are needed together: with only one of them, Telegram counts as not configured. Telegram does not affect booking, now or later.

## Step 9. Add the variables to Vercel

1. Open https://vercel.com → the site's project → "Settings" tab → "Environment Variables" on the left.
2. For each variable from the note: the name goes into "Key", the value into "Value". Under "Environments" tick **Production** (and **Preview** if booking should also work on branch preview links). "Save".

   Vercel lets you paste a whole block of `NAME=value` lines into the "Key" field and splits it into variables itself. Afterwards check that no value got cut off.
3. Things to watch in the values:
   - `BOOKING_GOOGLE_PRIVATE_KEY`: paste it as one line exactly as it is between the quotes in the JSON, with `\n`. **No** quotes around it: in Vercel the quotes become part of the value and the key can no longer be read.
   - `BOOKING_GMAIL_APP_PASSWORD`: 16 letters without spaces.
   - `BOOKING_BLOCKING_CALENDAR_IDS`: comma-separated, without spaces and without a trailing comma.
   - `NEXT_PUBLIC_SITE_URL`: the site address without a trailing `/`, for example `https://example.pl`. It is shown under "Settings" → "Domains".
   - Do **not** add `BOOKING_FAKE` to Vercel: it is a mode for automated tests that replaces the calendar and mail with fakes.
4. **Redeploy** the site: "Deployments" tab → three dots on the topmost deployment marked "Production" → "Redeploy" → "Redeploy". Variables are picked up only by a new build; without this step the site keeps showing "write to us" instead of the calendar.

**On a computer** (for development and for the check in step 10): create a `.env.local` file in the project root with the same variables, one per line: `BOOKING_CALENDAR_ID=c_abc123@group.calendar.google.com`. Here, unlike Vercel, the private key goes **in double quotes**: `BOOKING_GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`. `NEXT_PUBLIC_SITE_URL` can be left out on a computer. `.env.example` is a template with every name. `.env.local` is not committed and is never sent anywhere. `npm run dev` picks it up; restart the server after editing it.

## Step 10. Check

### Checking the calendars from a computer

If the project is on your computer and `.env.local` is filled in, calendar access is checked with one command from the project root:

```
node --env-file=.env.local scripts/check-booking-calendar.ts
```

The script prints which calendars it sees and the busy intervals for the coming week, then creates a test reservation `Test Visitor (delete me)` in Bookings 7 days ahead at 12:00, finds it and deletes it right away. It sends no e-mail. A successful check ends with a line like:

```
3 busy interval(s) read, create/read/delete OK.
```

Compare the busy intervals with the calendar: if there are events this week but the script says `0 interval(s)`, some calendar is missing from `BOOKING_BLOCKING_CALENDAR_IDS` or its events are marked "Free" (see [Blocking time](#blocking-time)). If the script fails with an error, look up its text in the [table below](#when-something-does-not-work).

### Checking on the site

1. Open `https://<site>/en/booking`. There must be no "write to …" text instead of the calendar; if there is, Vercel does not see some required variable or the site has not been redeployed.
2. Pick a day with an event in your own calendar and make sure that time is unavailable.
3. Book a free time from a second e-mail address of yours (or the same one, it does not matter).
4. Check that:
   - an event with the name and the session type appeared in the Bookings calendar;
   - the visitor's address received a confirmation e-mail;
   - `BOOKING_NOTIFY_EMAIL` (or `BOOKING_GMAIL_ADDRESS`) received the photographer's e-mail; if not, look in Spam;
   - the buttons in the e-mails lead to the real site address, not `localhost`.
5. Cancel the test reservation with the button in the photographer's e-mail and confirm. The event must disappear from Bookings and the visitor must get a cancellation e-mail.

## Blocking time

There are no settings on the site: busy time is just ordinary events in your own calendars.

- **A recurring schedule.** A "Work" event on Monday 08:00–17:00 repeating "Weekly" → on Mondays the site offers only times from 17:00. For "busy Mon and Wed 08:00–17:00", use one event repeating on Mondays and Wednesdays (the repeat settings let you tick several days). Delete one occurrence to open one day; delete the whole series to open them all.
- **A whole day.** An "All day" event blocks the day completely, but only if its "Show as" is set to **"Busy"**: Google creates all-day events as "Free" by default, and the site does not see such an event in the photographer's own calendars. So when creating an all-day event, open "More options" and set "Show as" to "Busy" (the calendar settings can also make this the default). A recurring all-day "Busy" event on Sundays makes every Sunday a day off. A holiday is one all-day "Busy" event over the dates. In the Bookings calendar this setting does not matter: the site reads it in full, and any all-day event there blocks the day.
- **Part of a day.** Any timed event: a doctor at 12:00–13:30, a meeting at 19:00. The site does not see titles or details. If such an event in your own calendar is manually set to "Show as: Free", it does not block time.
- **The daily window.** `BOOKING_WINDOW` sets the limits that booking never goes beyond on any day: `08:00-22:00` means the last one-hour session starts at 21:00 and the last two-hour one at 20:00. Without standard working hours there is no need to change the window; just block the extra time with events. But if shoots are never before 10:00 or after 20:00, it is simpler to set `10:00-20:00` than to add morning and evening events every day. The window is changed in Vercel and takes effect after a redeploy; a value in the wrong format turns booking off completely.

Opening time = deleting the event. The site reflects it within a minute.

## What reservations look like

Every reservation is an event in the Bookings calendar at the booked time:

- **Title**: the visitor's name and the session type, for example `Anna Kowalska — Personal Photosessions`.
- **Description**: e-mail, phone, Telegram, the visitor's comment, the page language (en/pl) and the price.

Everything is readable right in the Calendar app; nothing else needs to be opened. The same details arrive in the e-mail together with the cancellation link.

The site changes and deletes only events it created itself. It never touches the photographer's own events, in any calendar including Bookings.

If you add your own event at the same time as an existing reservation, the reservation stays and its cancellation links keep working; only new bookings for that time are blocked. If the session will not happen, the reservation has to be cancelled separately (see below).

## Cancelling a reservation

There are two ways, and they differ in whether the visitor is told.

1. **With the link from the notification e-mail.** It opens a page with the reservation details and a confirmation button; after confirming, the event is deleted and the visitor gets an apology e-mail with the site's contacts. The link works until the session starts. Just opening the link without pressing the button cancels nothing.
2. **Delete the event in the calendar by hand.** The time frees up on the site within a minute, but the visitor **gets nothing**: write to them yourself; the contacts are in the event description.

The visitor can also cancel with the link from their own e-mail, but no later than 24 hours before the start. Closer to the session only the photographer can cancel, so a late cancellation always goes through a conversation. The photographer gets an e-mail when a visitor cancels.

## When something does not work

The error text is in the output of the check script (step 10) or in Vercel: project → "Logs" tab, lines `Booking provider failed` or `Booking … e-mail failed`.

| What you see | Cause | What to do |
| --- | --- | --- |
| The booking page shows "write to …" instead of the calendar | A required variable is missing, `BOOKING_WINDOW` has the wrong format, or the site was not redeployed | Compare the variables with the [table](#variables), including the Production environment, and redeploy (step 9, item 4). The check script says `Booking is not configured for Google Calendar` in this case. |
| The calendar is on the page, but the free hours do not load | The site cannot read the calendars | Find the error text in Vercel → "Logs" and look it up below. |
| `Google Calendar API has not been used in project … or it is disabled` | The API is not enabled, or is enabled in another project | Step 2, in the same project as the service account. Wait a couple of minutes after enabling. |
| `Google token request failed: … invalid_grant` and `Invalid JWT Signature` | The key was deleted in Google Cloud or the wrong one was copied | Create a new key (step 3, item 7) and replace `BOOKING_GOOGLE_PRIVATE_KEY`. |
| `Google token request failed: … invalid_grant` and `Token must be a short-lived token` | The computer's clock is off | Turn on automatic time in the system settings. |
| `DECODER routines::unsupported`, `PEM`, `bad base64` and the like | The private key was copied partly or with extra quotes | Copy `private_key` again, from `-----BEGIN` to `-----END PRIVATE KEY-----\n`. In Vercel without quotes, in `.env.local` in double quotes. |
| `Google token request failed: … invalid_client` / `account not found` | A typo in `BOOKING_GOOGLE_CLIENT_EMAIL`, or the service account was deleted | Copy `client_email` from the JSON file again. |
| `Not Found` when reading or creating a reservation | The Bookings calendar is not shared with the service account, or `BOOKING_CALENDAR_ID` is wrong | Step 4: check the e-mail under "Share with specific people or groups" and copy the ID again. |
| `You need to have writer access to this calendar` / `Forbidden` | Bookings is shared view-only | Step 4, item 7: change the permission to "Make changes to events". |
| `Free/busy query failed for calendar …: notFound` | This own calendar is not shared with the service account, or the ID is wrong | Step 5 for this calendar, or remove it from `BOOKING_BLOCKING_CALENDAR_IDS`. |
| A time is free although the calendar has an event | The calendar is not in `BOOKING_BLOCKING_CALENDAR_IDS`, or the event is "Show as: Free" | Add the ID (step 5) or change the event's "Show as" to "Busy". |
| `Invalid login: 535-5.7.8 Username and Password not accepted` | The app password is wrong, has spaces or was revoked, or `BOOKING_GMAIL_ADDRESS` is a different account | Step 6: create a new app password and enter it without spaces. |
| E-mails are sent but never arrive | They land in the recipient's spam | Ask them to mark it "Not spam". Sent e-mails are visible in the photographer's Gmail under "Sent". |
| `Daily user sending limit exceeded` | The daily Gmail limit is exceeded | Wait a day. |
| The buttons in the e-mails lead to `localhost:3000` | `NEXT_PUBLIC_SITE_URL` is not set | Set it in Vercel and redeploy. |
| Every old cancellation link says the link is invalid | `BOOKING_TOKEN_SECRET` was changed | Restore the old value if you still have it; otherwise cancel such reservations in the calendar by hand and write to the visitors yourself. |

## Variables

| Variable | What it is | Where it comes from |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Required on the site. The site address without a trailing `/`, for example `https://example.pl`. It builds the buttons in the e-mails (cancel the reservation, "book again"), the links for Google and the link previews in messengers. Without it the e-mail links lead to `http://localhost:3000` and do not open for clients. It can be left out on a computer. | The site address on Vercel: "Settings" → "Domains". |
| `BOOKING_GOOGLE_CLIENT_EMAIL` | Required. The service account's e-mail. | `client_email` from the JSON key (step 3). |
| `BOOKING_GOOGLE_PRIVATE_KEY` | Required. The service account's private key, one line with `\n`. | `private_key` from the JSON key (step 3). |
| `BOOKING_CALENDAR_ID` | Required. The Bookings calendar the site writes reservations to. | "Calendar ID" (step 4). |
| `BOOKING_BLOCKING_CALENDAR_IDS` | Required. Your own calendars whose events block time, comma-separated. | The "Calendar ID" of each (step 5). |
| `BOOKING_WINDOW` | Optional. The daily booking window as `HH:MM-HH:MM`, Warsaw time. Defaults to `08:00-22:00`. | [Blocking time](#blocking-time). |
| `BOOKING_GMAIL_ADDRESS` | Required. The Gmail address the e-mails are sent from. | Step 6. |
| `BOOKING_GMAIL_APP_PASSWORD` | Required. The app password for that address, 16 letters without spaces. | Step 6. |
| `BOOKING_NOTIFY_EMAIL` | Optional. Where the photographer's notifications go. Defaults to `BOOKING_GMAIL_ADDRESS`. | Any address. |
| `BOOKING_TOKEN_SECRET` | Required. The secret that signs cancellation links. Changing it breaks every cancellation link already sent. | Step 7. |
| `BOOKING_TELEGRAM_BOT_TOKEN` | Optional, not used yet. The bot token. | Step 8. |
| `BOOKING_TELEGRAM_CHAT_ID` | Optional, not used yet. The photographer's chat id. | Step 8. |
| `BOOKING_FAKE` | Automated tests only. Replaces the calendar and mail with fakes. **Never set it in Vercel.** | — |

Until every required variable is set, the booking page shows an invitation to write to the site's contact e-mail instead of the calendar. The build does not fail because of it.

## Security and replacing keys

- **Who sees what.** In the photographer's own calendars the service account sees only "busy from … to …", without titles or details. In Bookings it sees and changes everything, so do not put personal events with details there.
- **The service account key leaked or was lost.** Google Cloud → "IAM & Admin" → "Service Accounts" → the account → "Keys": create a new JSON key, put its `private_key` into Vercel, redeploy, check booking, and only then delete the old key with the trash icon in the same list. Until the old key is deleted, it keeps working.
- **The app password leaked or is no longer needed.** https://myaccount.google.com/apppasswords → delete it. The site stops sending e-mail until a new one is set. Changing the main Google password also revokes every app password; after that, create a new one and put it into Vercel.
- **Disconnecting the site from the calendars completely.** Remove the service account under "Share with specific people or groups" in Bookings and in all your own calendars. The booking page will start showing an error; to show "write to us" instead, delete the `BOOKING_*` variables in Vercel and redeploy.
- **Do not**: rename or delete the Bookings calendar, change its ID, copy reservation events between calendars, or change `BOOKING_TOKEN_SECRET` while there are future reservations.
