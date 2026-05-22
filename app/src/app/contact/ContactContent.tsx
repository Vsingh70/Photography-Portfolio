/**
 * ContactContent — Editorial "Inquiry" treatment.
 *
 * Centered narrow form, § numbered sections with italic prompts.
 * No bordered card container. Underline-only fields. Segmented chip row
 * replaces the radio group. Editorial pill submit matching the hero CTA.
 */

'use client';

import { motion } from 'framer-motion';
import ContactForm from '@/components/forms/ContactForm';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
});

export function ContactContent() {
  return (
    <section className="mx-auto max-w-[720px] px-5 pb-16 pt-24 sm:px-8 sm:pt-28 md:px-10 md:pt-32 md:pb-20">
      <motion.div {...fadeUp(0)} className="flex items-baseline justify-between pb-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400">
          Inquiry
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400">
          File 03 / 04
        </span>
      </motion.div>
      <motion.div
        {...fadeUp(0.05)}
        className="h-px w-full bg-primary-200 dark:bg-primary-800"
      />

      <motion.h1
        {...fadeUp(0.1)}
        className="mt-6 font-display text-[56px] font-light italic leading-[0.95] tracking-[-0.02em] text-primary-900 dark:text-primary-100 md:mt-9 md:text-[96px]"
      >
        Get in touch.
      </motion.h1>
      <motion.p
        {...fadeUp(0.15)}
        className="mt-4 max-w-[520px] font-display text-[15px] italic leading-[1.5] text-primary-700 dark:text-primary-300 md:text-lg"
      >
        The form below reaches me directly. Take as much room as you need —
        there&apos;s no template to fit into.
      </motion.p>

      <motion.div
        {...fadeUp(0.2)}
        className="mt-7 h-px w-full bg-primary-200 dark:bg-primary-800 md:mt-10"
      />

      <motion.div {...fadeUp(0.25)}>
        <ContactForm />
      </motion.div>
    </section>
  );
}
