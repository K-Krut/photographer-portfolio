"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Duration } from "@/lib/booking/slots";
import { contactError, stripTelegramPrefix, type ContactField } from "@/lib/booking/validation";
import type { BookingTexts } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { SessionTypeSelect } from "./SessionTypeSelect";

export type SessionTypeOption = { slug: string; name: string };

export type Reservation = {
  id: string;
  start: string;
  end: string;
  duration: Duration;
  price: number;
  locale: Locale;
  name: string;
  email: string;
  phone: string;
  telegram?: string;
  sessionType?: string;
  comment?: string;
};

export type Confirmed = { reservation: Reservation; cancelUrl: string };

type FieldName = "name" | "email" | "phone" | "telegram" | "sessionType" | "comment";
type ErrorKey = keyof BookingTexts["errors"];
type Errors = { fields: Partial<Record<FieldName, ErrorKey>>; general?: ErrorKey };

export type FormValues = Record<FieldName, string>;

export const emptyFormValues: FormValues = {
  name: "",
  email: "",
  phone: "",
  telegram: "",
  sessionType: "",
  comment: "",
};

const fieldNames: FieldName[] = ["name", "email", "phone", "telegram", "sessionType", "comment"];
const contactFields: ContactField[] = ["name", "email", "phone", "telegram"];

function isContactField(name: FieldName): name is ContactField {
  return (contactFields as FieldName[]).includes(name);
}

const boxClass =
  "min-h-11 w-full rounded-none border border-current bg-background py-2 text-base text-foreground";
const inputClass = `mt-2 block px-3 ${boxClass}`;
const telegramClass = `block pl-8 pr-3 ${boxClass}`;
const labelClass = "block text-xs uppercase tracking-[0.25em] text-muted";

function parseErrors(body: unknown, errors: BookingTexts["errors"]): Errors {
  const { error, fields } = (body ?? {}) as { error?: unknown; fields?: unknown };
  if (error === "validation" && fields && typeof fields === "object") {
    const picked: Errors["fields"] = {};
    for (const name of fieldNames) {
      const key = (fields as Record<string, unknown>)[name];
      if (typeof key === "string") picked[name] = key in errors ? (key as ErrorKey) : name;
    }
    if (Object.keys(picked).length > 0) return { fields: picked };
  }
  return { fields: {}, general: error === "tooMany" ? "tooMany" : "failed" };
}

function Field({
  id,
  label,
  required,
  error,
  labelledControl,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  labelledControl?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        {...(labelledControl
          ? { id: `${id}-label`, onClick: () => document.getElementById(id)?.focus() }
          : { htmlFor: id })}
        className={labelClass}
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} data-field-error className="mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function BookingForm({
  locale,
  start,
  duration,
  labels,
  sessionTypes,
  values,
  onValueChange,
  onConfirmed,
  onSlotTaken,
}: {
  locale: Locale;
  start: string;
  duration: Duration;
  labels: { form: BookingTexts["form"]; errors: BookingTexts["errors"] };
  sessionTypes: SessionTypeOption[];
  values: FormValues;
  onValueChange: (name: FieldName, value: string) => void;
  onConfirmed: (confirmed: Confirmed) => void;
  onSlotTaken: () => void;
}) {
  const shownAt = useRef(0);
  const pressingSubmit = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({ fields: {} });

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const validate = (name: FieldName, value: string) => {
    if (!isContactField(name)) return;
    const key = contactError(name, value) ?? undefined;
    setErrors((current) =>
      current.fields[name] === key
        ? current
        : { ...current, fields: { ...current.fields, [name]: key } },
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const local: Errors["fields"] = {};
    for (const name of contactFields) {
      const key = contactError(name, values[name]);
      if (key) local[name] = key;
    }
    const firstInvalid = contactFields.find((name) => local[name]);
    if (firstInvalid) {
      setErrors({ fields: local });
      form.querySelector<HTMLElement>(`#booking-${firstInvalid}`)?.focus();
      return;
    }
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const optional = (name: string) => text(name) || undefined;
    setSubmitting(true);
    setErrors({ fields: {} });
    try {
      const response = await fetch("/api/booking/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start,
          duration,
          locale,
          name: text("name"),
          email: text("email"),
          phone: text("phone"),
          telegram: optional("telegram"),
          sessionType: optional("sessionType"),
          comment: optional("comment"),
          website: String(data.get("website") ?? ""),
          elapsedMs: Math.round(performance.now() - shownAt.current),
        }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 201 && body?.reservation && typeof body.cancelUrl === "string") {
        onConfirmed(body as Confirmed);
        return;
      }
      if (response.status === 409) {
        onSlotTaken();
        return;
      }
      setErrors(parseErrors(body, labels.errors));
    } catch {
      setErrors({ fields: {}, general: "failed" });
    }
    setSubmitting(false);
  };

  const fieldProps = (name: FieldName) => {
    const key = errors.fields[name];
    return {
      id: `booking-${name}`,
      name,
      value: values[name],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value =
          name === "telegram" ? stripTelegramPrefix(event.target.value) : event.target.value;
        onValueChange(name, value);
        if (key) validate(name, value);
      },
      onBlur: (event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (!pressingSubmit.current) validate(name, event.target.value);
      },
      "aria-invalid": key ? true : undefined,
      "aria-describedby": key ? `booking-${name}-error` : undefined,
    };
  };
  const fieldError = (name: FieldName) => {
    const key = errors.fields[name];
    return key && labels.errors[key];
  };

  return (
    <form data-booking-form noValidate onSubmit={submit} className="relative mt-8 grid gap-6 md:grid-cols-2">
      <Field id="booking-name" label={labels.form.name} required error={fieldError("name")}>
        <input
          {...fieldProps("name")}
          type="text"
          inputMode="text"
          autoComplete="name"
          autoCapitalize="words"
          required
          className={inputClass}
        />
      </Field>
      <Field id="booking-email" label={labels.form.email} required error={fieldError("email")}>
        <input
          {...fieldProps("email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={inputClass}
        />
      </Field>
      <Field id="booking-phone" label={labels.form.phone} required error={fieldError("phone")}>
        <input
          {...fieldProps("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          className={inputClass}
        />
      </Field>
      <Field id="booking-telegram" label={labels.form.telegram} error={fieldError("telegram")}>
        <div className="relative mt-2">
          <span
            aria-hidden="true"
            data-telegram-prefix
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted"
          >
            @
          </span>
          <input
            {...fieldProps("telegram")}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={telegramClass}
          />
        </div>
      </Field>
      <Field
        id="booking-sessionType"
        label={labels.form.sessionType}
        error={fieldError("sessionType")}
        labelledControl
      >
        <SessionTypeSelect
          id="booking-sessionType"
          name="sessionType"
          labelId="booking-sessionType-label"
          value={values.sessionType}
          options={[
            { value: "", label: labels.form.sessionTypeNone },
            ...sessionTypes.map((type) => ({ value: type.slug, label: type.name })),
          ]}
          onChange={(value) => onValueChange("sessionType", value)}
          invalid={Boolean(errors.fields.sessionType)}
          describedBy={errors.fields.sessionType ? "booking-sessionType-error" : undefined}
          className={boxClass}
        />
      </Field>
      <div className="md:col-span-2">
        <Field id="booking-comment" label={labels.form.comment} error={fieldError("comment")}>
          <textarea {...fieldProps("comment")} rows={4} maxLength={1000} className={inputClass} />
        </Field>
      </div>
      <div aria-hidden="true" className="absolute -left-[10000px] top-0 h-px w-px overflow-hidden">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <div className="flex flex-col items-start gap-4 md:col-span-2">
        {errors.general && (
          <p role="alert" data-booking-error={errors.general}>
            {labels.errors[errors.general]}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          onPointerDown={() => {
            pressingSubmit.current = true;
          }}
          onPointerUp={() => setTimeout(() => (pressingSubmit.current = false))}
          onPointerCancel={() => {
            pressingSubmit.current = false;
          }}
          onPointerLeave={() => {
            pressingSubmit.current = false;
          }}
          aria-busy={submitting || undefined}
          className="min-h-11 border border-current px-6 text-sm uppercase tracking-[0.2em] transition-[opacity,background-color,color] can-hover:hover:enabled:opacity-60 disabled:opacity-30"
        >
          {submitting ? labels.form.submitting : labels.form.submit}
        </button>
      </div>
    </form>
  );
}
