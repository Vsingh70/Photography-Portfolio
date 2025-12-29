'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Turnstile } from '@marsidev/react-turnstile';
import { ContactFormData, ContactFormResponse } from '@/types/contact';

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
  } = useForm<ContactFormData>();

  const onSubmit = async (data: ContactFormData) => {
    // Check if Turnstile token exists
    if (!turnstileToken) {
      setSubmitStatus({
        type: 'error',
        message: 'Please complete the security check.',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          turnstileToken,
        }),
      });

      const result: ContactFormResponse = await response.json();

      if (result.success) {
        setSubmitStatus({
          type: 'success',
          message: result.message || 'Thank you for your message! We\'ll get back to you soon.',
        });
        reset();
        setTurnstileToken(''); // Reset token
      } else {
        setSubmitStatus({
          type: 'error',
          message: result.error || 'Something went wrong. Please try again.',
        });
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: 'Failed to send message. Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Name Field */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-primary-900 dark:text-white mb-2">
          Name <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <input
          type="text"
          id="name"
          {...register('name', {
            required: 'Name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
          })}
          className={`w-full px-4 py-2.5 rounded-md border ${
            errors.name
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-primary-200 dark:border-primary-700 focus:border-primary-900 dark:focus:border-white focus:ring-primary-900 dark:focus:ring-white'
          } bg-white dark:bg-black text-primary-900 dark:text-white placeholder:text-primary-700 dark:placeholder:text-primary-300 focus:ring-1 focus:ring-offset-0 transition-colors`}
          placeholder="Your name"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-primary-900 dark:text-white mb-2">
          Email <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <input
          type="email"
          id="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Please enter a valid email address',
            },
          })}
          className={`w-full px-4 py-2.5 rounded-md border ${
            errors.email
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-primary-200 dark:border-primary-700 focus:border-primary-900 dark:focus:border-white focus:ring-primary-900 dark:focus:ring-white'
          } bg-white dark:bg-black text-primary-900 dark:text-white placeholder:text-primary-700 dark:placeholder:text-primary-300 focus:ring-1 focus:ring-offset-0 transition-colors`}
          placeholder="your.email@example.com"
          disabled={isSubmitting}
        />
        {errors.email && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
        )}
      </div>

      {/* Phone Field (Optional) */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-primary-900 dark:text-white mb-2">
          Phone <span className="text-primary-700 dark:text-primary-300 font-normal">(Optional)</span>
        </label>
        <input
          type="tel"
          id="phone"
          {...register('phone')}
          className="w-full px-4 py-2.5 rounded-md border border-primary-200 dark:border-primary-700 bg-white dark:bg-black text-primary-900 dark:text-white placeholder:text-primary-700 dark:placeholder:text-primary-300 focus:border-primary-900 dark:focus:border-white focus:ring-1 focus:ring-primary-900 dark:focus:ring-white focus:ring-offset-0 transition-colors"
          placeholder="+1 (555) 123-4567"
          disabled={isSubmitting}
        />
      </div>

      {/* Subject Field (Optional) */}
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-primary-900 dark:text-white mb-2">
          Subject <span className="text-primary-700 dark:text-primary-300 font-normal">(Optional)</span>
        </label>
        <input
          type="text"
          id="subject"
          {...register('subject')}
          className="w-full px-4 py-2.5 rounded-md border border-primary-200 dark:border-primary-700 bg-white dark:bg-black text-primary-900 dark:text-white placeholder:text-primary-700 dark:placeholder:text-primary-300 focus:border-primary-900 dark:focus:border-white focus:ring-1 focus:ring-primary-900 dark:focus:ring-white focus:ring-offset-0 transition-colors"
          placeholder="What is this regarding?"
          disabled={isSubmitting}
        />
      </div>

      {/* Message Field */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-primary-900 dark:text-white mb-2">
          Message <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <textarea
          id="message"
          rows={6}
          {...register('message', {
            required: 'Message is required',
            minLength: { value: 10, message: 'Message must be at least 10 characters' },
          })}
          className={`w-full px-4 py-2.5 rounded-md border ${
            errors.message
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-primary-200 dark:border-primary-700 focus:border-primary-900 dark:focus:border-white focus:ring-primary-900 dark:focus:ring-white'
          } bg-white dark:bg-black text-primary-900 dark:text-white placeholder:text-primary-700 dark:placeholder:text-primary-300 focus:ring-1 focus:ring-offset-0 transition-colors resize-none`}
          placeholder="Tell me about your photography needs..."
          disabled={isSubmitting}
        />
        {errors.message && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.message.message}</p>
        )}
      </div>

      {/* Cloudflare Turnstile */}
      <div className="flex justify-center">
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
          onSuccess={(token) => setTurnstileToken(token)}
          onError={() => setTurnstileToken('')}
          onExpire={() => setTurnstileToken('')}
          options={{
            theme: 'auto',
            size: 'normal',
          }}
        />
      </div>

      {/* Status Message */}
      {submitStatus.type && (
        <div
          className={`p-4 rounded-md border ${
            submitStatus.type === 'success'
              ? 'bg-primary-50 dark:bg-primary-900/10 text-primary-900 dark:text-white border-primary-200 dark:border-primary-700'
              : 'bg-red-50 dark:bg-red-900/10 text-red-900 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}
        >
          <p className="text-sm">{submitStatus.message}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 !bg-[#212529] dark:!bg-white !text-white dark:!text-[#212529] font-medium rounded-md hover:!bg-[#495057] dark:hover:!bg-primary-100 shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Sending...
          </span>
        ) : (
          'Send Message'
        )}
      </button>
    </form>
  );
}
