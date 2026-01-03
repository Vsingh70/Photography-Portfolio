/**
 * ContactContent Component
 *
 * Client component for the contact page with fade-in animations
 * - Matches HeroContent and AboutContent animation pattern
 * - Displays contact form and information sidebar
 * - Uses Canela font and theme-aware styling
 */

'use client';

import { motion } from 'framer-motion';
import ContactForm from '@/components/forms/ContactForm';

export function ContactContent() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="px-4 pt-24 pb-8 sm:px-6 sm:pt-28 sm:pb-10 lg:px-8 lg:pt-32 lg:pb-12"
    >
      {/* Header Section */}
      <div className="mb-10 sm:mb-12 lg:mb-16 text-center">
        <h1 className="font-display font-light italic text-primary-900 dark:text-white text-4xl sm:text-5xl lg:text-6xl mb-6">
          Let's Work Together
        </h1>
        <p className="text-base sm:text-lg text-primary-700 dark:text-primary-300 max-w-2xl mx-auto">
          Have a photography project in mind? I'd love to hear from you!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Contact Form - Takes 2 columns on large screens */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-black border border-primary-200 dark:border-primary-700 rounded-lg p-6 sm:p-8 lg:p-10">
            <h2 className="font-display font-light text-primary-900 dark:text-white text-2xl sm:text-3xl mb-8">
              Send a Message
            </h2>
            <ContactForm />
          </div>
        </div>

        {/* Contact Information Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          {/* Contact Details */}
          <div>
            <h3 className="font-display font-light text-primary-900 dark:text-white text-xl mb-6">
              Contact
            </h3>
            <div className="space-y-4">
              {/* Email */}
              <div>
                <p className="text-sm text-primary-700 dark:text-primary-300 mb-1">
                  Email
                </p>
                <a
                  href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}
                  className="text-primary-900 dark:text-white hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
                </a>
              </div>

              {/* Instagram */}
              {process.env.NEXT_PUBLIC_INSTAGRAM_URL && (
                <div>
                  <p className="text-sm text-primary-700 dark:text-primary-300 mb-1">
                    Instagram
                  </p>
                  <a
                    href={process.env.NEXT_PUBLIC_INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-900 dark:text-white hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    @_vflics
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-primary-200 dark:border-primary-700" />

          {/* Services */}
          <div>
            <h3 className="font-display font-light text-primary-900 dark:text-white text-xl mb-6">
              Services
            </h3>
            <ul className="space-y-2 text-primary-700 dark:text-primary-300">
              <li>Portrait Photography</li>
              <li>Event Photography</li>
              <li>Wedding Photography</li>
              <li>Graduation Photography</li>
              <li>Dance Photography</li>
            </ul>
          </div>

          {/* Divider */}
          <div className="border-t border-primary-200 dark:border-primary-700" />

          {/* Response Time */}
          <div>
            <h3 className="font-display font-light text-primary-900 dark:text-white text-xl mb-3">
              Response Time
            </h3>
            <p className="text-sm text-primary-700 dark:text-primary-300">
              I typically respond to all inquiries within 24-48 hours.
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
