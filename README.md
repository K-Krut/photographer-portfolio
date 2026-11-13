# Viktor Rowan — photographer in Kraków

The portfolio and booking site of photographer Viktor Rowan. Visitors browse photo collections, see the price list and book a session in an online calendar. The site is in English and Polish.

Built with Next.js, React and Tailwind CSS. Photo collections are plain JSON files and folders of images. Bookings are stored in the photographer's Google Calendar, and e-mails are sent from their Gmail. There is no database.

## Pages

| Address | What it shows |
| --- | --- |
| `/en`, `/pl` | Landing: about, featured collections, prices, contacts |
| `/{locale}/portfolio` | All collections |
| `/{locale}/portfolio/{slug}` | One collection with a photo viewer |
| `/{locale}/booking` | Booking calendar and form |
| `/{locale}/booking/cancel?token=…` | Cancelling a booking from the link in an e-mail |

## Run it locally

You need Node.js 24 and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without booking configuration the site works fully, and the booking page shows the contact e-mail instead of the calendar.

To enable booking locally, copy `.env.example` to `.env.local` and fill in the values as described in [content/BOOKING.md](content/BOOKING.md). With a real `.env.local` the local site uses the real calendar and sends real e-mail.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build; also validates every collection |
| `npm run start` | Serves the production build |
| `npm run lint` | ESLint |
| `npm run test:unit` | Unit tests with `node --test` |
| `npm run test:e2e` | Playwright tests in Chrome, Safari and an iPhone viewport, against a fake booking backend |
| `npm run test:slow` | Playwright tests on a throttled network |

## Content and setup guides

| Guide | For |
| --- | --- |
| [content/README.md](content/README.md) | Editing collections by hand |
| [GUIDE.md](GUIDE.md) | Running the site: bookings and the calendar, portfolio collections, publishing changes |
| [content/IMPORT.md](content/IMPORT.md) | Instructions for an AI agent importing collections from a photo archive |
| [content/BOOKING.md](content/BOOKING.md) | Setting up booking: Google Calendar, Gmail, Vercel variables |
| `lib/content.ts` | All other texts: about, prices, contacts, interface, SEO |
| [content/CREDITS.md](content/CREDITS.md) | Sources and license of the photos in `public/photos/` |

## Deployment

The site is hosted on Vercel. Every merge into `main` deploys it to production, and every pull request gets a preview link. Booking needs the environment variables listed in `.env.example` to be set in the Vercel project, plus `NEXT_PUBLIC_SITE_URL` with the public address of the site, so that the links in e-mails point to it.

## Working on the code

Work happens on branches and reaches `main` through pull requests on GitHub. Rules for contributors and AI agents, including the commit message format, are in [AGENTS.md](AGENTS.md).
