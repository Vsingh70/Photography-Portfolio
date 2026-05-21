/**
 * AboutContent — Editorial "Profile" spread.
 *
 * Magazine feature layout:
 *   - Big italic "Viraj" wordmark with pronunciation marginalia
 *   - Asymmetric two-column body: drop-cap bio + pull quote + "On the Record" list
 *     on the left, portrait + figure caption on the right
 *   - Mobile collapses to a single column with the photo above the body
 */

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface AboutImageData {
  filename: string;
  path: string;
  width: number;
  height: number;
  size: number;
  format: string;
  blurDataURL: string;
  originalFilename: string;
  generatedAt: string;
}

interface AboutContentProps {
  imageData: AboutImageData;
}

const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE_OUT },
});

export function AboutContent({ imageData }: AboutContentProps) {
  return (
    <section className="px-5 pt-24 pb-12 sm:px-8 sm:pt-28 md:px-12 md:pt-32 md:pb-16 lg:px-16 xl:pt-36">
      <div className="mx-auto max-w-[1180px]">
        <motion.div
          {...fadeUp(0)}
          className="flex flex-col items-start gap-2 pb-4 md:flex-row md:items-end md:justify-between md:gap-8 md:pb-6"
        >
          <h1 className="font-display text-[76px] font-light italic leading-[0.88] tracking-[-0.025em] text-primary-900 dark:text-primary-100 md:text-[120px] lg:text-[140px]">
            Viraj
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400 md:text-right md:pb-4">
            /vur-ahj/
          </span>
        </motion.div>

        <motion.div
          {...fadeUp(0.1)}
          className="h-px w-full bg-primary-200 dark:bg-primary-800"
        />

        <div className="grid gap-8 pt-7 md:grid-cols-[1.2fr_1fr] md:gap-12 md:pt-10 lg:gap-16">
          <motion.div {...fadeUp(0.3)} className="order-2 md:order-1">
            <p className="font-display text-[18px] leading-[1.5] text-primary-900 dark:text-primary-100 md:text-[20px] lg:text-[22px]">
              <span
                className="float-left mr-[10px] mt-1 -mb-1 font-display italic font-light leading-[0.85] text-primary-900 dark:text-primary-100"
                style={{ fontSize: '4em' }}
                aria-hidden
              >
                I
              </span>
              picked up my first camera in middle school, got serious about it
              in high school, and started shooting professionally once I got to
              college.
            </p>

            <p className="mt-4 font-display text-[15px] leading-[1.55] text-primary-700 dark:text-primary-300 md:text-[16px] lg:text-[17px]">
              Off camera, I study computer science at Virginia Tech and yes, I
              built this site myself. I also lift, brew espresso, care more
              about clothes than I should, and am always chasing the next
              creative adventure.
            </p>

            <div className="my-8 border-y border-primary-200 py-5 dark:border-primary-800 md:my-10 md:py-6">
              <p className="font-display text-[26px] font-light italic leading-[1.15] tracking-[-0.01em] text-primary-900 dark:text-primary-100 md:text-[32px] lg:text-[36px]">
                &ldquo;I have a fascination with creating.&rdquo;
              </p>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400">
              On the Record
            </p>
            <dl className="mt-3.5">
              {[
                ['Where', 'Greater DMV, Richmond, and NYC, open to travel by arrangement'],
                ['What', 'Portraits & group events. Inquiries welcome for other work.'],
                ['How', 'Inquiry form on contact page, or by email and instagram below.'],
              ].map(([k, v], i, arr) => (
                <div
                  key={k}
                  className={`grid grid-cols-[70px_1fr] items-baseline gap-4 py-3.5 ${
                    i < arr.length - 1
                      ? 'border-b border-primary-200 dark:border-primary-800'
                      : ''
                  }`}
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400">
                    {k}
                  </dt>
                  <dd className="font-display text-[16px] italic font-light leading-[1.4] text-primary-900 dark:text-primary-100 md:text-[18px]">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.figure
            {...fadeUp(0.2)}
            className="order-1 m-0 md:order-2 md:self-start"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden">
              <Image
                src={imageData.path}
                alt="Portrait of Viraj Singh"
                fill
                priority
                placeholder="blur"
                blurDataURL={imageData.blurDataURL}
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-2.5 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400">
                Fig. 01
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400">
                Self portrait
              </span>
            </figcaption>
          </motion.figure>
        </div>
      </div>
    </section>
  );
}
