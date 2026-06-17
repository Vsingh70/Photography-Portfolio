/**
 * ContactForm — editorial treatment.
 *
 * Behaviorally identical to the previous form (react-hook-form validation,
 * Turnstile, /api/contact submit). Visually rewritten to match the editorial
 * vocabulary: mono small-caps labels, underline-only inputs, segmented chips,
 * pill submit.
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Turnstile } from '@marsidev/react-turnstile';
import { ContactFormData, ContactFormResponse } from '@/types/contact';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        {children}
      </span>
      {required && (
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted opacity-60">
          · Required
        </span>
      )}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-red-700 dark:text-red-400">
      {message}
    </p>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="mt-7 mb-3 md:mt-10">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        § {num}
      </span>
      <h2 className="mt-1.5 font-display text-2xl font-light italic leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
        {title}
      </h2>
    </div>
  );
}

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ContactFormData>({
    defaultValues: { preferredContactMethod: 'email' },
  });

  const preferred = watch('preferredContactMethod');

  const onSubmit = async (data: ContactFormData) => {
    if (!turnstileToken) {
      setSubmitStatus({ type: 'error', message: 'Please complete the security check.' });
      return;
    }
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, turnstileToken }),
      });
      const result: ContactFormResponse = await response.json();

      if (result.success) {
        setSubmitStatus({
          type: 'success',
          message:
            result.message ||
            "Thank you for your message — I'll get back to you within 24–48 hours.",
        });
        reset();
        setTurnstileToken('');
      } else {
        setSubmitStatus({
          type: 'error',
          message: result.error || 'Something went wrong. Please try again.',
        });
      }
    } catch {
      setSubmitStatus({
        type: 'error',
        message: 'Failed to send message. Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <SectionHeader num="01" title="Tell me who you are" />
      <div className="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <Label required>Name</Label>
          <input
            type="text"
            placeholder="Your name"
            disabled={isSubmitting}
            {...register('name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'At least 2 characters' },
            })}
            className={`editorial-field ${errors.name ? 'error' : ''}`}
          />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label required>Email</Label>
          <input
            type="email"
            placeholder="you@example.com"
            disabled={isSubmitting}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email',
              },
            })}
            className={`editorial-field ${errors.email ? 'error' : ''}`}
          />
          <FieldError message={errors.email?.message} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <Label required={preferred === 'phone'}>Phone</Label>
          <input
            type="tel"
            placeholder={preferred === 'phone' ? 'Required' : 'Optional'}
            disabled={isSubmitting}
            {...register('phone', {
              required:
                preferred === 'phone'
                  ? 'Phone is required when phone is your preferred contact method'
                  : false,
            })}
            className={`editorial-field ${errors.phone ? 'error' : ''}`}
          />
          <FieldError message={errors.phone?.message} />
        </div>
        <div>
          <Label>Best reply via</Label>
          <div className="mt-2.5 flex gap-2">
            {(['email', 'phone'] as const).map((opt) => {
              const active = preferred === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isSubmitting}
                  aria-pressed={active}
                  onClick={() => setValue('preferredContactMethod', opt)}
                  className={`
                    cursor-pointer rounded-full border px-[18px] py-2 font-display text-[12px] uppercase tracking-[0.18em]
                    transition-colors duration-300
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${
                      active
                        ? 'border-ink bg-ink text-paper'
                        : 'border-hair bg-transparent text-ink-soft hover:border-muted'
                    }
                  `}
                  style={{ transitionTimingFunction: EASE }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <input type="hidden" {...register('preferredContactMethod')} />
        </div>
      </div>

      <SectionHeader num="02" title="Tell me what we'd make" />
      <div className="mt-2">
        <Label>Subject</Label>
        <input
          type="text"
          placeholder="One-line summary"
          disabled={isSubmitting}
          {...register('subject')}
          className="editorial-field"
        />
      </div>

      <div className="mt-6">
        <Label required>The full thing</Label>
        <textarea
          rows={6}
          placeholder="When, where, who, what mood — anything that helps me picture it."
          disabled={isSubmitting}
          {...register('message', {
            required: 'Message is required',
            minLength: { value: 10, message: 'At least 10 characters' },
          })}
          className={`editorial-field ${errors.message ? 'error' : ''}`}
        />
        <FieldError message={errors.message?.message} />
      </div>

      <div className="mt-8 flex justify-center md:justify-start">
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
          onSuccess={(token) => setTurnstileToken(token)}
          onError={() => setTurnstileToken('')}
          onExpire={() => setTurnstileToken('')}
          options={{ theme: 'auto', size: 'normal' }}
        />
      </div>

      {submitStatus.type && (
        <p
          role="status"
          className={`mt-6 font-display italic ${
            submitStatus.type === 'success'
              ? 'text-ink'
              : 'text-red-700 dark:text-red-400'
          }`}
        >
          {submitStatus.message}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3.5 border-t border-hair pt-5 md:mt-11">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
          Reply within 24–48 hours · Protected by Turnstile
        </span>
        <button
          type="submit"
          disabled={isSubmitting}
          className="
            group inline-flex cursor-pointer items-center gap-3 rounded-full border border-ink px-6 py-3
            font-display text-[13px] uppercase tracking-[0.18em] text-ink transition-colors duration-300
            hover:bg-ink hover:text-paper
            disabled:cursor-not-allowed disabled:opacity-50
            md:px-7
          "
        >
          {isSubmitting ? 'Sending…' : 'Send Inquiry'}
          <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      </div>
    </form>
  );
}
