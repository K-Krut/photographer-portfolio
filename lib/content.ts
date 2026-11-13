import { loadCollections } from "./collections";
import type { Locale } from "./i18n";

export type Localized<T = string> = Record<Locale, T>;

export type Photo = {
  src: string;
  width: number;
  height: number;
  alt: Localized;
};

export type CategorySlug = string;

export type Category = {
  slug: CategorySlug;
  name: Localized;
  description?: Localized;
  cover: Photo;
  photos: Photo[];
  featured?: boolean;
};

export type PriceItem = {
  duration: Localized;
  amount: number;
};

export type SocialLink = {
  label: string;
  href: string;
};

export type Texts = {
  meta: {
    title: string;
    description: string;
    galleryTitle: (categoryName: string) => string;
    galleryDescription: (categoryName: string) => string;
    portfolioTitle: string;
    portfolioDescription: string;
    bookingTitle: string;
    bookingDescription: string;
    bookingCancelTitle: string;
  };
  nav: {
    portfolio: string;
    price: string;
    contact: string;
    booking: string;
  };
  menu: {
    open: string;
    close: string;
  };
  headings: {
    portfolio: string;
    price: string;
    contact: string;
    booking: string;
  };
  role: string;
  bio: string;
  photoCount: (count: number) => string;
  viewAll: string;
  priceConditions: string[];
  back: string;
  viewer: ViewerLabels;
  booking: BookingTexts;
};

export type BookingTexts = {
  bookSession: string;
  timeZoneNote: string;
  notConfigured: string;
  calendar: {
    label: string;
    previousMonth: string;
    nextMonth: string;
  };
  duration: {
    label: string;
    hours: (hours: number) => string;
  };
  price: string;
  times: {
    label: string;
    chooseDay: string;
    loading: string;
    none: string;
    error: string;
    retry: string;
  };
  form: {
    heading: string;
    day: string;
    time: string;
    name: string;
    email: string;
    phone: string;
    telegram: string;
    sessionType: string;
    sessionTypeNone: string;
    comment: string;
    submit: string;
    submitting: string;
  };
  errors: {
    name: string;
    nameInvalid: string;
    email: string;
    emailInvalid: string;
    phone: string;
    phoneInvalid: string;
    telegram: string;
    sessionType: string;
    comment: string;
    slotTaken: string;
    tooMany: string;
    failed: string;
  };
  confirmation: {
    heading: string;
    contact: string;
    emailSent: (email: string) => string;
    cancel: string;
    time: string;
    sessionType: string;
    telegram: string;
  };
  cancel: {
    heading: string;
    invalid: string;
    alreadyCancelled: string;
    tooLate: string;
    started: string;
    confirm: string;
    confirming: string;
    cancelled: string;
    failed: string;
    backToBooking: string;
  };
};

export type ViewerLabels = {
  label: string;
  photos: string;
  position: string;
  previous: string;
  next: string;
  close: string;
  zoomIn: string;
  zoomOut: string;
};

function localized(en: string, pl: string): Localized {
  return { en, pl };
}

function siteUrlFromEnv(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (value || "http://localhost:3000").replace(/\/+$/, "");
}

export const site = {
  name: "Viktor Rowan",
  city: localized("Kraków", "Kraków"),
  country: localized("Poland", "Polska"),
  email: "hello@example.com",
  phone: "",
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/example" },
    { label: "Telegram", href: "https://t.me/example" },
  ] satisfies SocialLink[],
  url: siteUrlFromEnv(),
};

export const portrait: Photo = {
  src: "/photos/hero.jpg",
  width: 2000,
  height: 3000,
  alt: localized(
    "Studio portrait of a bearded man in a dark knitted sweater on a black background",
    "Portret studyjny mężczyzny z brodą w ciemnym swetrze z dzianiny na czarnym tle",
  ),
};

export const ogImage: Photo = {
  src: "/photos/og.jpg",
  width: 1200,
  height: 630,
  alt: localized(
    "Viktor Rowan — photographer in Kraków, Poland",
    "Viktor Rowan — fotograf w Krakowie",
  ),
};

const reloadCollections = process.env.NODE_ENV === "development";

let loadedCategories: Category[] | undefined;

export function getCategories(): Category[] {
  if (reloadCollections) return loadCollections();
  return (loadedCategories ??= loadCollections());
}

export const featuredLimit = 4;

export function selectFeatured<T extends { featured?: boolean }>(
  items: readonly T[],
  limit = featuredLimit,
): T[] {
  const featured = items.filter((item) => item.featured);
  return (featured.length > 0 ? featured : items).slice(0, limit);
}

export function getFeaturedCategories(): Category[] {
  return selectFeatured(getCategories());
}

export function getCategory(slug: string): Category | undefined {
  return getCategories().find((category) => category.slug === slug);
}

export const currency = "PLN";

export const priceItems: PriceItem[] = [
  { duration: localized("First hour", "Pierwsza godzina"), amount: 350 },
  { duration: localized("Each additional hour", "Każda kolejna godzina"), amount: 250 },
];

const plPlural = new Intl.PluralRules("pl");

export const texts: Record<Locale, Texts> = {
  en: {
    meta: {
      title: "Viktor Rowan — Photographer in Kraków, Poland",
      description:
        "Personal, business and event photography in Kraków, Poland. Portrait sessions, corporate headshots and event coverage by photographer Viktor Rowan.",
      galleryTitle: (categoryName) => `${categoryName} in Kraków — Viktor Rowan`,
      galleryDescription: (categoryName) =>
        `${categoryName} by Viktor Rowan, photographer in Kraków, Poland.`,
      portfolioTitle: "Portfolio — Viktor Rowan, Photographer in Kraków",
      portfolioDescription:
        "All photo collections by Viktor Rowan, photographer in Kraków, Poland: personal, business and event photography, plus behind the scenes.",
      bookingTitle: "Book a Photo Session in Kraków — Viktor Rowan",
      bookingDescription:
        "Pick a day and time for a photo session with Viktor Rowan, photographer in Kraków, Poland. See the free hours and reserve online.",
      bookingCancelTitle: "Cancel a Reservation — Viktor Rowan",
    },
    nav: { portfolio: "Portfolio", price: "Price", contact: "Contact", booking: "Booking" },
    menu: { open: "Menu", close: "Close menu" },
    headings: { portfolio: "Portfolio", price: "Price", contact: "Contact", booking: "Booking" },
    role: "Photographer",
    bio: "I'm Viktor, a portrait and event photographer in Kraków. I started out shooting concerts and backstage, and I still love the energy of a live event as much as the calm of a studio. On a shoot I take care of the light, the poses and the mood, so all you have to do is be yourself. Write to me with any idea, from a quiet portrait to a full-day event, and together we will make photos you will want to come back to.",
    photoCount: (count) => `${count} ${count === 1 ? "photo" : "photos"}`,
    viewAll: "View all",
    priceConditions: [
      "40–50 edited photos per hour of shooting",
      "12 of them fully retouched",
      "Delivery within 5 days",
    ],
    back: "Back",
    viewer: {
      label: "Photo viewer",
      photos: "Photos",
      position: "{index} of {total}",
      previous: "Previous photo",
      next: "Next photo",
      close: "Close photo",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
    },
    booking: {
      bookSession: "Book a session",
      timeZoneNote: "All times are in Warsaw time (Europe/Warsaw).",
      notConfigured: "Online booking is not available right now. To arrange a session, write to",
      calendar: {
        label: "Calendar",
        previousMonth: "Previous month",
        nextMonth: "Next month",
      },
      duration: {
        label: "Duration",
        hours: (hours) => `${hours} ${hours === 1 ? "hour" : "hours"}`,
      },
      price: "Price",
      times: {
        label: "Start time",
        chooseDay: "Choose a day to see the free hours.",
        loading: "Loading…",
        none: "No free hours for this duration.",
        error: "Could not load the free hours.",
        retry: "Try again",
      },
      form: {
        heading: "Your booking",
        day: "Day",
        time: "Time",
        name: "Name",
        email: "E-mail",
        phone: "Phone",
        telegram: "Telegram (optional)",
        sessionType: "Session type (optional)",
        sessionTypeNone: "Not sure yet",
        comment: "Comment (optional)",
        submit: "Reserve",
        submitting: "Reserving…",
      },
      errors: {
        name: "Please enter your name.",
        nameInvalid: "Please enter your name with at least two letters.",
        email: "Please enter your e-mail address.",
        emailInvalid: "Please enter a valid e-mail like name@example.com.",
        phone: "Please enter your phone number.",
        phoneInvalid: "Please enter a phone number with 7 to 15 digits; + is allowed only at the start.",
        telegram:
          "Please enter a Telegram username: 5 to 32 letters, digits or underscores, starting with a letter and not ending with an underscore.",
        sessionType: "Please choose a session type from the list.",
        comment: "The comment is too long.",
        slotTaken: "This time is no longer available. Please choose another one.",
        tooMany: "Too many reservations from your network. Please try again later.",
        failed: "The reservation could not be made. Please try again.",
      },
      confirmation: {
        heading: "Your session is reserved",
        contact: "I will contact you shortly to confirm the details.",
        emailSent: (email) => `A confirmation has been sent to ${email}.`,
        cancel: "Cancel the reservation",
        time: "Time",
        sessionType: "Session type",
        telegram: "Telegram",
      },
      cancel: {
        heading: "Cancel the reservation",
        invalid: "This link is not valid.",
        alreadyCancelled: "This reservation has already been cancelled.",
        tooLate:
          "The session starts in less than 24 hours, so it can only be cancelled through the photographer. Please write to",
        started:
          "The session has already started. This link can cancel the reservation only until the start of the session.",
        confirm: "Cancel the reservation",
        confirming: "Cancelling…",
        cancelled: "The reservation is cancelled.",
        failed: "The reservation could not be cancelled. Please try again.",
        backToBooking: "Back to booking",
      },
    },
  },
  pl: {
    meta: {
      title: "Viktor Rowan — Fotograf Kraków, Polska",
      description:
        "Sesje indywidualne, biznesowe i fotografia eventowa w Krakowie. Fotograf Viktor Rowan — portrety, zdjęcia firmowe i reportaże z wydarzeń w Krakowie i całej Polsce.",
      galleryTitle: (categoryName) => `${categoryName} Kraków — Viktor Rowan`,
      galleryDescription: (categoryName) =>
        `${categoryName} — Viktor Rowan, fotograf w Krakowie.`,
      portfolioTitle: "Portfolio — Viktor Rowan, fotograf Kraków",
      portfolioDescription:
        "Wszystkie kolekcje zdjęć Viktora Rowana, fotografa w Krakowie: sesje indywidualne, biznesowe, fotografia eventowa i zdjęcia zza kulis.",
      bookingTitle: "Rezerwacja sesji zdjęciowej Kraków — Viktor Rowan",
      bookingDescription:
        "Wybierz dzień i godzinę sesji zdjęciowej z Viktorem Rowanem, fotografem w Krakowie. Sprawdź wolne godziny i zarezerwuj online.",
      bookingCancelTitle: "Anulowanie rezerwacji — Viktor Rowan",
    },
    nav: { portfolio: "Portfolio", price: "Cennik", contact: "Kontakt", booking: "Rezerwacja" },
    menu: { open: "Menu", close: "Zamknij menu" },
    headings: { portfolio: "Portfolio", price: "Cennik", contact: "Kontakt", booking: "Rezerwacja" },
    role: "Fotograf",
    bio: "Nazywam się Viktor i jestem fotografem portretowym i eventowym w Krakowie. Zaczynałem od zdjęć z koncertów i zza kulis i do dziś tak samo lubię energię wydarzeń na żywo, jak spokój studia. Podczas sesji dbam o światło, pozy i nastrój, a Ty możesz po prostu być sobą. Napisz do mnie z każdym pomysłem, od spokojnego portretu po całodniowe wydarzenie, a razem zrobimy zdjęcia, do których zechcesz wracać.",
    photoCount: (count) => {
      const form = plPlural.select(count);
      const word = form === "one" ? "zdjęcie" : form === "few" ? "zdjęcia" : "zdjęć";
      return `${count} ${word}`;
    },
    viewAll: "Zobacz wszystkie",
    priceConditions: [
      "40–50 obrobionych zdjęć za każdą godzinę sesji",
      "12 z nich w pełnym retuszu",
      "Realizacja do 5 dni",
    ],
    back: "Wstecz",
    viewer: {
      label: "Podgląd zdjęcia",
      photos: "Zdjęcia",
      position: "{index} z {total}",
      previous: "Poprzednie zdjęcie",
      next: "Następne zdjęcie",
      close: "Zamknij zdjęcie",
      zoomIn: "Powiększ",
      zoomOut: "Pomniejsz",
    },
    booking: {
      bookSession: "Zarezerwuj sesję",
      timeZoneNote: "Wszystkie godziny podane są w czasie warszawskim (Europe/Warsaw).",
      notConfigured:
        "Rezerwacja online jest obecnie niedostępna. Aby umówić sesję, napisz na",
      calendar: {
        label: "Kalendarz",
        previousMonth: "Poprzedni miesiąc",
        nextMonth: "Następny miesiąc",
      },
      duration: {
        label: "Czas trwania",
        hours: (hours) => {
          const form = plPlural.select(hours);
          const word = form === "one" ? "godzina" : form === "few" ? "godziny" : "godzin";
          return `${hours} ${word}`;
        },
      },
      price: "Cena",
      times: {
        label: "Godzina rozpoczęcia",
        chooseDay: "Wybierz dzień, aby zobaczyć wolne godziny.",
        loading: "Ładowanie…",
        none: "Brak wolnych godzin dla tego czasu trwania.",
        error: "Nie udało się wczytać wolnych godzin.",
        retry: "Spróbuj ponownie",
      },
      form: {
        heading: "Twoja rezerwacja",
        day: "Dzień",
        time: "Godzina",
        name: "Imię i nazwisko",
        email: "E-mail",
        phone: "Telefon",
        telegram: "Telegram (opcjonalnie)",
        sessionType: "Rodzaj sesji (opcjonalnie)",
        sessionTypeNone: "Jeszcze nie wiem",
        comment: "Komentarz (opcjonalnie)",
        submit: "Zarezerwuj",
        submitting: "Rezerwowanie…",
      },
      errors: {
        name: "Podaj swoje imię.",
        nameInvalid: "Podaj imię zawierające co najmniej dwie litery.",
        email: "Podaj swój adres e-mail.",
        emailInvalid: "Podaj poprawny adres e-mail, np. imie@example.com.",
        phone: "Podaj swój numer telefonu.",
        phoneInvalid: "Podaj numer telefonu zawierający od 7 do 15 cyfr; znak + jest dozwolony tylko na początku.",
        telegram:
          "Podaj nazwę użytkownika Telegram: od 5 do 32 liter, cyfr lub podkreśleń, zaczynając od litery i nie kończąc podkreśleniem.",
        sessionType: "Wybierz rodzaj sesji z listy.",
        comment: "Komentarz jest za długi.",
        slotTaken: "Ta godzina nie jest już dostępna. Wybierz inną.",
        tooMany: "Zbyt wiele rezerwacji z Twojej sieci. Spróbuj ponownie później.",
        failed: "Nie udało się dokonać rezerwacji. Spróbuj ponownie.",
      },
      confirmation: {
        heading: "Sesja zarezerwowana",
        contact: "Wkrótce skontaktuję się z Tobą, aby potwierdzić szczegóły.",
        emailSent: (email) => `Potwierdzenie zostało wysłane na ${email}.`,
        cancel: "Anuluj rezerwację",
        time: "Godzina",
        sessionType: "Rodzaj sesji",
        telegram: "Telegram",
      },
      cancel: {
        heading: "Anulowanie rezerwacji",
        invalid: "Ten link jest nieprawidłowy.",
        alreadyCancelled: "Ta rezerwacja została już anulowana.",
        tooLate:
          "Do sesji zostało mniej niż 24 godziny, więc anulować ją może tylko fotograf. Napisz na",
        started:
          "Sesja już się rozpoczęła. Ten link pozwala anulować rezerwację tylko do rozpoczęcia sesji.",
        confirm: "Anuluj rezerwację",
        confirming: "Anulowanie…",
        cancelled: "Rezerwacja została anulowana.",
        failed: "Nie udało się anulować rezerwacji. Spróbuj ponownie.",
        backToBooking: "Wróć do rezerwacji",
      },
    },
  },
};
