# Photo collections

Each collection is one file `content/collections/*.json` and one folder of photos `public/photos/<slug>/`.

`<slug>` is a short Latin name from the `"slug"` field inside the file. It sets the page address and the photo folder: `"slug": "wedding"` → the pages `/en/portfolio/wedding` and `/pl/portfolio/wedding`, photos in `public/photos/wedding/`. Only lowercase Latin letters, digits and single hyphens (`family`, `wedding-2025`). Two collections cannot share a `slug`.

The file name can be anything (`wedding.json`, `Weddings 2025.json`); it does not affect the site. The file can be renamed freely and the page address stays the same. To avoid confusion, it is convenient to name the file after the `slug`.

Photo sizes (width and height) do not need to be written down: the site reads them from the files.

## Example file

```json
{
  "slug": "personal",
  "order": 1,
  "featured": true,
  "name": { "en": "Personal Photosessions", "pl": "Sesje indywidualne" },
  "description": {
    "en": "Relaxed personal photoshoots in Kraków — Old Town, Kazimierz and the Vistula boulevards.",
    "pl": "Sesje indywidualne w Krakowie — Stare Miasto, Kazimierz i bulwary wiślane."
  },
  "cover": "01.jpg",
  "photos": [
    { "file": "01.jpg", "alt": { "en": "Woman on a Kraków street", "pl": "Kobieta na krakowskiej ulicy" } },
    { "file": "02.jpg", "alt": { "en": "Couple by the Vistula", "pl": "Para nad Wisłą" } }
  ]
}
```

| Field | What it is |
| --- | --- |
| `slug` | Required. The collection's address and the name of its photo folder: `"slug": "personal"` → `/en/portfolio/personal` and `public/photos/personal/`. |
| `redirectFrom` | Optional. A list of the collection's old addresses, for example `["behind-the-scenes"]`. Anyone who opens an old address lands on the current one (a permanent 301 redirect, so Google moves the page to the new address too). See "Changing a collection's address". |
| `order` | A number: the collection's place in the list (1, 2, 3…). Lower comes first. Equal numbers are ordered by `slug`. |
| `featured` | `true` shows the collection on the landing page (at most the first 4 by `order`). Can be left out, which means `false`. If no collection is marked, the landing page shows the first 4. |
| `name` | The collection's name in English (`en`) and Polish (`pl`). Both are required. |
| `description` | The collection's description for search engines, in `en` and `pl`. It is not shown on the site: it becomes the page description in Google and the link preview in messengers and social networks. 120–160 characters work best, with the city and the type of shoot. Can be left out, and the description is then built from the name; if the field is present, both languages are required. |
| `cover` | The file name of the cover, one of the photos in `photos`. Can be left out, and the first photo becomes the cover. |
| `photos` | The list of photos. The order in the list is the order on the page. |
| `photos[].file` | The file name in the `public/photos/<slug>/` folder. |
| `photos[].alt` | The photo's description in `en` and `pl` (for blind visitors and search engines). Both are required. |

## Adding a collection

1. Pick a `slug` (for example `wedding`) and put the photos into a new folder `public/photos/<slug>/` (for example `public/photos/wedding/01.jpg`).
2. Create a file in `content/collections/` (for example `wedding.json`) following the example above, with `"slug": "wedding"` in it.
3. Set `order` and, to show it on the landing page, `"featured": true`.
4. Build the site (`npm run build`). The collection page, its card on the "Portfolio" page and its sitemap entry appear on their own.

## Changing a collection's address

The old address may already be in Google, in bookmarks or in shared links. To keep them from leading to a 404 page, the old address moves to `redirectFrom`:

1. Rename the photo folder: `public/photos/bts/` → `public/photos/behind-the-scenes/`.
2. In the collection file, change `slug` to the new one and add the old one to `redirectFrom`:

   ```json
   {
     "slug": "behind-the-scenes",
     "redirectFrom": ["bts"],
     ...
   }
   ```

3. If the address is changing again, do not remove the old addresses from `redirectFrom`; just add another one: `["bts", "backstage"]`.

Now `/en/portfolio/bts` and `/pl/portfolio/bts` open `/en/portfolio/behind-the-scenes` and `/pl/portfolio/behind-the-scenes`. An old address cannot be given to another collection while it is in `redirectFrom`: an address is either live or a redirect, and the build tells you if they clash.

The `.json` file itself can be renamed at any time; nothing else needs to be done for that.

## Adding, removing or reordering photos

- Add: put the file into the collection folder and add a line to `photos`.
- Remove: delete the line from `photos` (the file in the folder can stay or go). If it was the cover, change `cover`.
- Reorder: swap the lines in `photos`.
- Change the cover: put the name of another file from `photos` into `cover`.

Any code editor (VS Code, PyCharm) is convenient for editing: it highlights JSON mistakes. Common mistakes: a missing comma between lines, an extra comma after the last line, typographic quotes (`“ ”` or `« »`) instead of `"`.

## Previewing changes before a build

`npm run dev` runs the site on your computer (http://localhost:3000). It does not need a restart after edits: new, changed, renamed and deleted collection files and photos are picked up the next time a page is opened or reloaded. If a file has a mistake, the page is replaced with the same list of problems the build shows.

## Build errors

If something is wrong in the files, the build stops and shows a list of problems, each with the file name and the field:

```
Error: Invalid collection content (4 problems):
  - content/collections/wedding.json: "redirectFrom[0]": "Old Wedding" is not a valid address (use lowercase latin letters, digits and single hyphens, e.g. "wedding-2025")
  - content/collections/wedding.json: "name.pl" is missing or empty
  - content/collections/wedding.json: "photos[2].file": public/photos/wedding/03.jpg does not exist
  - content/collections/wedding.json: "cover": "10.jpg" is not in "photos"
```

`photos[2]` is the third photo in the list (counting from zero), and `redirectFrom[0]` is the first old address.

While the `slug` is empty, invalid or taken, the collection's photos are not checked (it is unknown which folder to look in), so after fixing the `slug` the build may show new errors about the photos.

| Message | What it means and how to fix it |
| --- | --- |
| `invalid JSON: ... (line 7 column 1)` | A syntax error in the file: check the commas and quotes near the given line. |
| `"slug" is missing or empty` | The file has no `slug`: add one, for example `"slug": "wedding"`. |
| `"slug": "..." is not a valid address` | The `slug` has capital letters, spaces, non-Latin letters or double hyphens: keep only lowercase Latin letters, digits and single hyphens. |
| `"slug": "..." is already used by ...` | Another collection already has this `slug` (its file is named in the message): pick a different one. |
| `"slug": "..." is also in "redirectFrom" of ...` | This address is an old address of another collection (its file is named). Pick a different `slug` or remove the address from that collection's `redirectFrom`. |
| `"redirectFrom" must be a list of old addresses` | `redirectFrom` is not written as a list: it needs square brackets, `["old-slug"]`. |
| `"redirectFrom[N]": ... is not a valid address` | The old address has a mistake: the same rules as for `slug` apply. |
| `"redirectFrom[N]": "..." is listed more than once` | The same old address is listed twice. |
| `"redirectFrom[N]": "..." is already in "redirectFrom" of ...` | This old address already redirects to another collection (its file is named): keep it in only one. |
| `"redirectFrom[N]": "..." is this collection's own "slug"` | `redirectFrom` contains the collection's current address: remove it from there. |
| `"order" must be a number` | `order` is missing or is not a number (for example `"1"` in quotes): write `"order": 1`. |
| `"featured" must be true or false` | Write `true` or `false` without quotes. |
| `"name.en" is missing or empty` / `"name.pl" ...` | The name is missing in one of the languages. |
| `"photos[N].alt.pl" is missing or empty` | A photo has no description in one of the languages. |
| `"photos" must be a non-empty list` | The collection has no photos. |
| `"photos[N].file": ... does not exist` | There is no file with that name in `public/photos/<slug>/`: check the name and the letter case (`01.JPG` ≠ `01.jpg`) and that the folder is named the same as the `slug`. |
| `"photos[N].file": "..." is listed more than once` | The same photo is listed twice. |
| `"photos[N].file" must be a plain file name` | `file` contains a path: only the file name is needed, without folders. |
| `cannot read image size of ...` | The file is damaged or is not an image. |
| `"cover": "..." is not in "photos"` | The cover is not in the `photos` list. |
| `no collection files (*.json) found` | There are no collections in `content/collections/`. |

All other site texts (about, prices, contacts, social links, interface texts and SEO) are in `lib/content.ts`.

Online booking (Google Cloud, Google Calendar, Gmail, Vercel) is set up with the step-by-step guide in [BOOKING.md](BOOKING.md).

Adding, changing or removing collections with an AI agent from a photo archive: see [GUIDE.md](../GUIDE.md) (for people) and [IMPORT.md](IMPORT.md) (for agents).
