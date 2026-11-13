# Proposals

The booking page sends every notification by e-mail from the photographer's Gmail. E-mail on a phone is easy to miss, and the photographer wants to hear about a new reservation or a cancellation as soon as it happens.

This follow-up duplicates every message the photographer receives as a Telegram message from a bot. Telegram's Bot API is free and plain HTTPS, so it needs no new dependency. Visitors keep getting e-mail only: a bot cannot start a conversation with a Telegram username, so the visitor's Telegram handle in the form stays a contact for the photographer.

*Note: postponed from the booking calendar spec. The configuration variables `BOOKING_TELEGRAM_BOT_TOKEN` and `BOOKING_TELEGRAM_CHAT_ID` and a `sendTelegram` method on the booking provider boundary already exist; the Google provider's `sendTelegram` throws "not implemented", and the fake records Telegram messages.*

# Design

## Messages

The photographer receives a Telegram message for each event that sends him an e-mail: a new reservation, a cancellation by the visitor, and the confirmation of his own cancellation. The message is plain text with the same facts as the e-mail, in the language of the page the visitor used, and includes the photographer cancel link where the e-mail does. The text builders in `lib/booking/messages.ts` are reused rather than duplicated.

## Delivery

Messages go to a single chat id from configuration through the Bot API `sendMessage` call, with the bot token from configuration. Telegram is optional: when either variable is missing, nothing is sent and booking still counts as configured. Telegram is sent alongside the e-mails, independently of them; a Telegram failure is logged and never affects the e-mails, the reservation or the cancellation.

## Setup

The Russian setup guide `content/BOOKING.md` already describes creating the bot with @BotFather, pressing Start, and finding the chat id. It is checked for accuracy and kept.

# Scenarios

## Scenario: Reservation notifies the photographer on Telegram
**Given** Telegram is configured and a visitor books from the English page
**When** the reservation succeeds
**Then** the photographer receives one Telegram message in English with the visitor's contacts, the comment, the session details and the photographer cancel link.

## Scenario: Polish page sends a Polish Telegram message
**Given** Telegram is configured and a visitor books from `/pl/booking`
**When** the reservation succeeds
**Then** the Telegram message is in Polish.

## Scenario: Cancellations notify the photographer on Telegram
**Given** Telegram is configured and a reservation exists
**When** the visitor cancels through their link, or the photographer cancels through his
**Then** the photographer receives a Telegram message matching the cancellation e-mail he receives.

## Scenario: Telegram not configured
**Given** the Telegram variables are not set
**When** a reservation is made or cancelled
**Then** e-mails are sent as before and no Telegram message is sent.

## Scenario: Telegram fails
**Given** the Bot API call fails
**When** a reservation is made
**Then** the reservation stands, both e-mails are sent, the visitor sees the confirmation, and the failure is logged.

# Tasks

- [ ] Add Telegram notifications to the photographer
  - [ ] Add the real Telegram implementation of the boundary in `lib/booking/google.ts` calling the Bot API with the token and chat id from configuration, treating missing Telegram configuration as "skip"
  - [ ] Send the photographer's reservation and cancellation messages in the page language alongside the e-mails, reusing `lib/booking/messages.ts`, ignoring failures
  - [ ] E2e tests asserting the recorded Telegram messages and that nothing is sent when Telegram is not configured
