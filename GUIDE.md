# Site guide

This guide is for the photographer and anyone who runs the site day to day. It covers online bookings, portfolio collections, and how changes get published. You never need to edit code for any of it: bookings are handled in Google Calendar, and content changes are done by an AI agent (for example Claude Code) that you give instructions to.

| I want to… | Go to |
| --- | --- |
| Block time, cancel or move a booking, understand what a client sees | [Bookings](#bookings) |
| Add, change or remove a photo collection | [Portfolio collections](#portfolio-collections) |
| Change prices, the about text or contacts | [Other texts](#other-texts) |
| Get a change onto the live site, or undo one | [Publishing changes](#publishing-changes) |
| Set up booking for the first time (Google Cloud, calendars, Gmail, Vercel) | [content/BOOKING.md](content/BOOKING.md) |

Developers and AI agents follow [AGENTS.md](AGENTS.md) instead.

## Bookings

### How a client books

1. On `/en/booking` or `/pl/booking` the client chooses how long the session should be: 1, 2 or 3 hours. The price is shown next to it: 400 PLN for the first hour and 300 PLN for each further hour.
2. They pick a day in the calendar. Only days with free time for that duration can be clicked.
3. They pick a start time. Sessions always start on the hour. Hours where the whole session would not fit are greyed out.
4. They fill in name, e-mail and phone, and optionally a Telegram username, a session type (one of the portfolio collections) and a comment.
5. The booking is confirmed straight away. There is no approval step: the client is told that you will contact them.

Rules the site applies to every booking:

- All times are Warsaw time.
- A session can be booked at least 24 hours ahead and at most one year ahead.
- Sessions fit inside the daily booking window, 08:00–22:00 unless it was changed in the settings.
- There is no automatic break between sessions. Two bookings can follow each other directly.
- The same address can make at most 5 bookings per hour, to stop spam.
- Other visitors only see that a time is taken, never who took it.

### Your two calendars

The site works with two Google calendars:

- **Your own calendar** (or several). The site reads only when you are busy, not what the events are. Every busy event there closes that time for booking.
- **Bookings.** A separate calendar where the site writes each booking as an event. Any event you add to it by hand also closes that time.

**Every hour inside the daily window that is not covered by an event in these calendars is open for booking.** You do not mark free time anywhere; you only mark when you are not available.

Changes in the calendars appear on the site as soon as the booking page is reloaded.

### Close time when you are not available

**A single busy slot**, e.g. Tuesday 10:00–14:00: add a normal event to your own calendar. Timed events are "Busy" by default, so nothing else is needed.

**A regular schedule**, e.g. at another job every Monday and Wednesday 08:00–17:00: add one event and set it to repeat (in Google Calendar: **Does not repeat → Custom → Weekly on Monday, Wednesday**). The evenings of those days stay open.

**A whole day off or a holiday:** add an all-day event, then open it, choose **More options** and set **Show as: Busy**. Google creates all-day events as "Free" by default, and the site cannot see "Free" events in your own calendar. For a vacation, make the all-day event span several days.

Alternatively, put any of these events into the **Bookings** calendar instead. There every event blocks time, whatever its "Show as" setting.

**A break between sessions,** e.g. travel time after a session, is just another busy event. Because sessions start on the hour, a busy event from 14:00 to 14:30 closes the whole 14:00 hour.

**Changing the daily window** (for example to 10:00–20:00 for every day) is a setting, not a calendar event. Ask whoever maintains the site to change `BOOKING_WINDOW`; it takes effect after the next deployment.

### Open time again

Delete the busy event, or move it. The time becomes bookable as soon as the booking page is reloaded.

### When a client books

You get:

- an e-mail **"New reservation: {name}, {day}, {time}"** with the session details and the client's name, e-mail, phone, Telegram and comment. Pressing **Reply** writes straight to the client, and the phone, e-mail and Telegram are clickable. The e-mail has a **Cancel the reservation** button for you.
- an event in the **Bookings** calendar, titled with the client's name and session type, with all the details in its description.

The client gets an e-mail **"Your photo session is reserved"** with the details, a button to cancel, and a calendar file they can add to their own calendar.

The booked time disappears from the site for everyone else.

Notifications go to the Gmail address the site sends from, or to a separate address if one is set in `BOOKING_NOTIFY_EMAIL`.

### When the client cancels

The client can cancel with the button in their e-mail **until 24 hours before the start**. Opening the link alone does nothing; they have to confirm on the page.

When they confirm:

- the event disappears from your Bookings calendar;
- you get an e-mail **"Reservation cancelled by the client"** with their contacts;
- the client gets a confirmation;
- the time becomes bookable again.

Less than 24 hours before the start, the page tells the client that they can only cancel by writing to you, and shows the site's contact e-mail. The booking stays until you cancel it.

### When you cancel

**Recommended:** open your "New reservation" e-mail, press **Cancel the reservation**, and confirm on the page. This works until the session starts. Then:

- the event disappears from the Bookings calendar;
- the client gets an e-mail saying the session is cancelled, with an apology, your contact e-mail and a button to book another time;
- you get a confirmation e-mail;
- the time becomes bookable again.

**Deleting the event in Google Calendar** also frees the time, but **the client is not told anything**. Use it only if you contact the client yourself.

### Move a booking to another time or change its length

The site has no button for this. Agree on the new time with the client first, then:

1. In the **Bookings** calendar, drag the event to the new time, or open it and change the time. To make the session longer or shorter, change its end time.
2. The old time becomes bookable again, and the new time is blocked.
3. Tell the client yourself: they get no e-mail about the change, and the calendar file they added still shows the old time.

Good to know:

- Keep the same event; do not create a new one and delete the old one. The client's cancel link is tied to that event, keeps working after the move, and uses the new time for the 24-hour rule.
- The site does not check your changes for conflicts. Make sure the new time is free.
- The price in the event description and in later e-mails stays as it was booked. Agree on a new price with the client directly.

### Add a booking yourself

If a client books by phone or message, add an event to the **Bookings** calendar for that time. It blocks the time on the site. No e-mails are sent and there is no cancel link; you handle that booking yourself.

### When something overlaps

If you add a busy event over an existing booking, the booking stays. Cancel it with the button in your e-mail if you cannot make it, so the client is told.

### Do not

- rename, delete or unshare the **Bookings** calendar, or remove the site's access to your own calendars: booking stops working or starts offering times you are busy;
- edit the event's hidden data or copy booking events between calendars;
- change `BOOKING_TOKEN_SECRET`: every cancel link already sent stops working.

### Time zones

The site always works in Warsaw time. If your Google Calendar is set to another time zone, events there look shifted by an hour or more compared with the site and the e-mails. Check **Google Calendar → Settings → Time zone**.

### When something looks wrong

| What you see | Why, and what to do |
| --- | --- |
| The booking page shows "write to" an e-mail instead of the calendar | Booking is not configured on this deployment. See [content/BOOKING.md](content/BOOKING.md). |
| The calendar shows an error with a **Retry** button | The site could not reach Google Calendar. Retry; if it persists, check that the calendars are still shared with the site. |
| A time you blocked is still offered | The event is in your own calendar and set to "Free" (typical for all-day events). Set **Show as: Busy**, or move it to the Bookings calendar. |
| E-mails do not arrive | Check spam. If nothing arrives at all, the Gmail app password may have been revoked; see [content/BOOKING.md](content/BOOKING.md). |
| Buttons in e-mails open `localhost` | `NEXT_PUBLIC_SITE_URL` is not set on Vercel. Set it to the site's address and redeploy. |

## Portfolio collections

Collections are added, changed and removed by an AI agent from an archive of photos that you prepare. You do not edit any files yourself. The agent follows its technical instructions in [content/IMPORT.md](content/IMPORT.md).

### How it works in one minute

1. You put the photos into a `.zip` archive, one folder per collection.
2. You ask the agent to import the archive. It prepares the photos, writes the names, descriptions and photo captions in English and Polish, checks that the site builds, and saves everything on a separate branch.
3. You look at the result and ask the agent to push the branch to GitHub.
4. On GitHub you open a pull request and merge it into `main` (see [Publishing changes](#publishing-changes)).

### Prepare the archive

Make one folder per collection and zip them together. The folder name is the collection's name and can be in any language.

```
collections.zip
├── Weddings 2025/
│   ├── info.txt         (or info.md)
│   ├── 01.jpg
│   ├── 02.jpg
│   └── 03.heic
└── Business portraits/
    ├── info.txt
    ├── 01.jpg
    └── 02.jpg
```

**Photos**

- Formats: JPG, PNG, HEIC (iPhone), WebP or TIFF. RAW files (CR3, NEF, ARW, DNG) are not accepted: export them to JPG first.
- Any size is fine. The agent resizes them, turns them the right way up and removes hidden data such as camera details and GPS location.
- Photos appear on the site in the order of their file names. Name them `01.jpg`, `02.jpg`, `03.jpg` to control the order.
- A collection looks best with 6 to 30 photos.
- Only include photos you have the right to publish, and that the people in them agreed to have on the site.

**info.txt or info.md (optional)**

A text file inside the collection folder, either plain text (`info.txt`) or Markdown (`info.md`). You can skip it: the agent then uses the folder name as the title and writes the description and captions itself. You can write it in any language; the agent translates it into English and Polish.

In plain text it looks like this:

```
Name: Weddings 2025
Description: Wedding photography in Kraków and nearby, from getting ready to the first dance.
Cover: 02.jpg
Featured: yes
Order: 3
Slug: wedding-2025

Captions:
01.jpg: The bride by the window in an old house in Kazimierz
02.jpg: The couple on the Vistula boulevards at sunset
```

The same in Markdown, if you prefer headings and lists:

```markdown
# Weddings 2025

Wedding photography in Kraków and nearby, from getting ready to the first dance.

- **Cover:** 02.jpg
- **Featured:** yes
- **Order:** 3
- **Slug:** wedding-2025

## Captions

- `01.jpg`: The bride by the window in an old house in Kazimierz
- `02.jpg`: The couple on the Vistula boulevards at sunset
```

In Markdown the first `#` heading is the name and the paragraph under it is the description, unless you write `Name:` and `Description:` lines explicitly. Formatting such as bold, lists and backticks is ignored; only the text matters.

| Line | Meaning |
| --- | --- |
| `Name` | The collection title on the site. Defaults to the folder name. |
| `Description` | One or two sentences about the shoot. Not shown on the page; used by Google and by link previews in messengers. |
| `Cover` | The photo shown on the collection's card. Defaults to the first photo. |
| `Featured` | `yes` to show the collection on the home page. At most four collections fit there. |
| `Order` | Position in the list of collections: 1, 2, 3… Defaults to last. |
| `Slug` | The page address, e.g. `wedding-2025` gives `/en/portfolio/wedding-2025`. Lowercase latin letters, digits and single hyphens. Defaults to a short English version of the name. |
| `Captions` | Short descriptions of individual photos for blind visitors and search engines. The agent writes the missing ones by looking at the photos. |

### Change or remove a collection

To **change** an existing collection, name its folder after the collection's current address (or put that address in `Slug`), and add an `Action` line to its `info.txt` or `info.md`:

| `Action` | What happens |
| --- | --- |
| `replace photos` | All old photos are removed and the photos from the folder are used. This is also the default when the folder contains photos. |
| `add photos` | New photos are added after the existing ones. |
| `texts only` | Only the name, description, cover, order, featured flag or captions change. The folder can have no photos. |
| `change slug to new-slug` | The collection gets a new address, and the old one keeps working by redirecting to the new one. |

To **remove** collections, put a `delete.txt` or `delete.md` file in the root of the archive with one collection address per line, or simply tell the agent which collections to remove. A removed collection's page stops working.

The current addresses are the last part of each collection's URL on the site, e.g. `personal` in `/en/portfolio/personal`.

### Ask the agent to import it

Open the project in the agent at the root of the repository and write:

```
Start from the latest main. Read content/IMPORT.md and import ~/Downloads/collections.zip
```

The agent first shows you a plan: which collections it will add, change or remove, their addresses and how many photos each has. **Read it.** Removing a collection or replacing its photos only happens after you say yes.

When it is done, the agent reports what it created, which texts it wrote itself, and whether the checks passed.

### Look at the result

Before publishing, check the new or changed collections. Either ask the agent to start the site locally and open `http://localhost:3000/en/portfolio/<address>` and `/pl/portfolio/<address>`, or wait for the preview link on the pull request.

Check that every photo shows up, the order and cover are right, and the English and Polish titles read well. If something is off, tell the agent what to change; it will fix it on the same branch.

### Good to know

- Do one import at a time. Two agents changing collections on two branches at once may conflict.
- Keep your original archive. The site stores resized copies only.
- New collections appear automatically on the Portfolio page, on the home page if featured, in the sitemap for Google, and as a session type in the booking form.
- Removing a collection removes it from the booking form too. Bookings already made keep working; their cancellation page just stops showing the session type.

## Other texts

Prices, the about text, contacts, social links and page titles for Google are all in one file, `lib/content.ts`, in English and Polish. Ask the agent, for example:

```
Start from the latest main. Change the price of each additional hour to 350 PLN in both languages.
```

Then review and publish the change as described below.

## Publishing changes

Every change reaches the live site the same way. The agent never touches `main` directly: it does not commit to it, push to it or merge into it. Only you merge, on GitHub.

1. **Ask the agent to push its branch:** `Push your branch.` It pushes only its own branch, never `main`, and never force-pushes.
2. **Open a pull request.** Go to the repository on GitHub. A yellow banner offers **Compare & pull request** for the branch; click it. If the banner is gone, open **Pull requests → New pull request**, set *base* to `main` and *compare* to the agent's branch. Click **Create pull request**.
3. **Check the preview.** If the site is connected to Vercel, a bot comment with a **Preview** link appears after a few minutes. Open it and check the change on a real address.
4. **Merge.** Click **Merge pull request**, then **Confirm merge**, then **Delete branch**.
5. **Wait for the deployment.** Every merge into `main` publishes the site on Vercel automatically within a few minutes. You can watch it under **Deployments** in the Vercel dashboard. Nothing needs to be restarted.

If the repository is not connected to Vercel yet, connect it once: on vercel.com choose **Add New → Project**, import the GitHub repository, set the environment variables from [content/BOOKING.md](content/BOOKING.md), and deploy. From then on, merges publish by themselves.

**Undoing a change:** open the merged pull request on GitHub and click **Revert**. GitHub creates a new pull request that undoes it; merge that one and the previous version is published again.

If the agent says a check fails and it cannot fix it, do not merge. Send its message to whoever maintains the site.
