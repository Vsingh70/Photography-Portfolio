/**
 * AboutContent Component
 *
 * Client component for the about page with fade-in animations
 * - Matches HeroContent animation pattern
 * - Desktop: Text left, Image right
 * - Mobile: Title top, Image middle, Text bottom
 * - Uses Canela font for title and text
 * - Theme-aware styling
 * - OPTIMIZED: Uses pre-generated static image
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

export function AboutContent({ imageData }: AboutContentProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="px-4 pt-24 pb-8 sm:px-6 sm:pt-28 sm:pb-10 lg:px-8 lg:pt-32 lg:pb-12"
    >

      {/* Content Container - Desktop: Text left, Image right | Mobile: Image then Text */}
      <div className="flex flex-col items-center gap-12 md:flex-row md:items-center md:justify-between md:gap-8 lg:gap-16">
        {/* Text Content with FAQs - Left on desktop, bottom on mobile */}
        <div className="order-2 max-w-2xl md:order-1 md:flex-1 space-y-8">
          {/* About Me Paragraph */}
          <div className="space-y-4">
            <p className="font-display font-light leading-relaxed text-primary-900 dark:text-primary-100 text-lg sm:text-xl lg:text-2xl">
              My name is Viraj, and I have a fascination with creating.
            </p>
            <p className="font-display font-light leading-relaxed text-primary-900 dark:text-primary-100 text-sm sm:text-base lg:text-lg">
              I picked up my first camera in middle school, but it wasn't until high school that I became serious about photography, eventually shooting professionally in college. Beyond the lens, I study computer science at Virginia Tech (I built this website), I enjoy lifting, coffee, fashion, and exploring new creative endeavours.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-primary-200 dark:border-primary-700" />

          {/* FAQs Section */}
          <div>
            <h3 className="font-display font-light italic text-primary-900 dark:text-white text-2xl sm:text-3xl mb-6">
              FAQs:
            </h3>
            <ul className="list-disc list-inside space-y-3 font-display font-light text-primary-700 dark:text-primary-300 text-lg sm:text-xl">
              <li>Though I am open to travel, I primarily shoot in the Greater DMV area</li>
              <li>I specialize and typically shoot portraits and group events (you are welcome to submit an inquiry about other photography related projects)</li>
              <li>I respond to all inquiries on all platforms, however, the form on the contact page is the best way to reach me</li>
            </ul>
          </div>
        </div>

        {/* Image - Right on desktop, middle on mobile */}
        <div className="order-1 w-full md:order-2 md:w-auto md:max-w-md">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
            <Image
              src={imageData.path}
              alt="About Viraj Singh"
              width={imageData.width}
              height={imageData.height}
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
              priority
              placeholder="blur"
              blurDataURL={imageData.blurDataURL}
            />
          </div>
        </div>
      </div>
    </motion.section>
  );
}
