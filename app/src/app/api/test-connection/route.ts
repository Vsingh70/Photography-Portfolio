/**
 * Test Connection API Route
 *
 * Simple endpoint to test that Phase 2 setup is working
 * Tests: API routes, imports, type definitions
 */

import { NextResponse } from 'next/server';
import { GALLERY_CATEGORIES } from '@/config/galleries';
import { verifyDriveConnection } from '@/lib/google-drive';

export async function GET() {
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: {
      apiRoute: { status: 'pass', message: 'API route is accessible' },
      galleryConfig: { status: 'unknown', message: '', data: null as { id: string; name: string; slug: string; hasEnvVar: boolean }[] | null },
      googleDriveCredentials: { status: 'unknown', message: '' },
      googleDriveConnection: { status: 'unknown', message: '' },
    },
  };

  // Test 1: Gallery Configuration
  try {
    if (GALLERY_CATEGORIES && GALLERY_CATEGORIES.length > 0) {
      testResults.tests.galleryConfig = {
        status: 'pass',
        message: `Found ${GALLERY_CATEGORIES.length} gallery categories`,
        data: GALLERY_CATEGORIES.map(g => ({
          id: g.id,
          name: g.name,
          slug: g.slug,
          hasEnvVar: !!process.env[g.folderIdEnvVar],
        })),
      };
    } else {
      testResults.tests.galleryConfig = {
        status: 'fail',
        message: 'No gallery categories found',
        data: null,
      };
    }
  } catch (error) {
    testResults.tests.galleryConfig = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      data: null,
    };
  }

  // Test 2: Google Drive Credentials
  try {
    const hasClientEmail = !!process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
    const hasPrivateKey = !!process.env.GOOGLE_DRIVE_PRIVATE_KEY;

    if (hasClientEmail && hasPrivateKey) {
      testResults.tests.googleDriveCredentials = {
        status: 'pass',
        message: 'Google Drive credentials are configured',
      };

      // Test 3: Google Drive Connection (only if credentials exist)
      try {
        const isConnected = await verifyDriveConnection();
        if (isConnected) {
          testResults.tests.googleDriveConnection = {
            status: 'pass',
            message: 'Successfully connected to Google Drive API',
          };
        } else {
          testResults.tests.googleDriveConnection = {
            status: 'fail',
            message: 'Could not connect to Google Drive API',
          };
        }
      } catch (error) {
        testResults.tests.googleDriveConnection = {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Connection test failed',
        };
      }
    } else {
      const missing = [];
      if (!hasClientEmail) missing.push('GOOGLE_DRIVE_CLIENT_EMAIL');
      if (!hasPrivateKey) missing.push('GOOGLE_DRIVE_PRIVATE_KEY');

      testResults.tests.googleDriveCredentials = {
        status: 'warning',
        message: `Missing: ${missing.join(', ')}`,
      };

      testResults.tests.googleDriveConnection = {
        status: 'skipped',
        message: 'Skipped - credentials not configured',
      };
    }
  } catch (error) {
    testResults.tests.googleDriveCredentials = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Count passes, fails, warnings
  const statusCounts = Object.values(testResults.tests).reduce(
    (acc, test) => {
      acc[test.status] = (acc[test.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({
    ...testResults,
    summary: {
      total: Object.keys(testResults.tests).length,
      ...statusCounts,
      overall: statusCounts.fail ? 'FAIL' : statusCounts.warning ? 'WARNING' : 'PASS',
    },
  });
}
