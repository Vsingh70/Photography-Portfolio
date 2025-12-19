/**
 * AboutSection Component
 *
 * Introduction section for the photographer.
 * Appears below the hero content with smooth scroll animation.
 */

'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/ui';

export function AboutSection() {
  return (
    <section className="bg-primary-50 py-20">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="mb-6 font-display text-3xl font-bold text-primary-900 md:text-4xl lg:text-5xl">
            About
          </h2>
          <div className="space-y-4 text-lg leading-relaxed text-primary-700">
            <p>
              Welcome to my photography portfolio. I specialize in capturing authentic
              moments that tell compelling stories through the art of visual storytelling.
            </p>
            <p>
              With years of experience in portrait, event, and artistic photography, I bring
              a unique perspective to every shoot. My work is driven by passion, creativity,
              and a commitment to delivering images that you&apos;ll treasure forever.
            </p>
            <p>
              Whether it&apos;s a milestone celebration, a professional headshot, or an artistic
              vision, I&apos;m here to bring your story to life through stunning imagery.
            </p>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
