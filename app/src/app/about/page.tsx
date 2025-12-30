/**
 * About Page - Photography Portfolio
 *
 * Features:
 * - Centered title using Canela font
 * - Desktop: Text left, Image right
 * - Mobile: Title top, Image middle, Text bottom
 * - Fade-in animation matching home page
 * - Theme-aware colors
 * - Image from Google Drive About folder
 */

import { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Container } from '@/components/ui';
import { fetchImagesFromDrive } from '@/lib/google-drive';
import { AboutContent } from './AboutContent';

export const metadata: Metadata = {
  title: 'About | VFlics Photography',
  description: 'Learn more about Viraj Singh and VFlics Photography.',
};

export const revalidate = 3600; // Revalidate every 1 hour (ISR)

/**
 * Fetch about image from Google Drive
 */
async function getAboutImage() {
  try {
    const folderId = process.env.GOOGLE_DRIVE_ABOUT_FOLDER_ID;

    if (!folderId) {
      throw new Error('GOOGLE_DRIVE_ABOUT_FOLDER_ID not configured');
    }

    const images = await fetchImagesFromDrive(folderId, 'about');

    // Return first image from the about folder
    if (images.length > 0) {
      return {
        success: true,
        image: images[0],
      };
    }

    return {
      success: false,
      image: null,
    };
  } catch (error) {
    console.error('Error fetching about image:', error);
    return {
      success: false,
      image: null,
    };
  }
}

export default async function AboutPage() {
  const data = await getAboutImage();

  return (
    <>
      <Navbar visible={true} />
      <main className="min-h-screen bg-white dark:bg-black">
        <Container size="xl">
          <AboutContent image={data.image} />
        </Container>
      </main>
    </>
  );
}
