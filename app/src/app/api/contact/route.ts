import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { ContactFormData } from '@/types/contact';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json();
    const { name, email, subject, message, phone } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: `${process.env.NEXT_PUBLIC_SITE_NAME} Contact Form <onboarding@resend.dev>`,
      to: [process.env.CONTACT_EMAIL!],
      replyTo: email,
      subject: subject || `New Contact Form Submission from ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contact Form Submission</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #212529; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">

            <!-- Header -->
            <div style="text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid #e9ecef;">
              <h1 style="margin: 0 0 12px 0; font-size: 32px; font-weight: 300; font-style: italic; color: #212529; letter-spacing: -0.5px;">
                New Message Received
              </h1>
              <p style="margin: 0; font-size: 14px; color: #495057;">
                From your VFlics Photography contact form
              </p>
            </div>

            <!-- Contact Information -->
            <div style="margin-bottom: 32px;">
              <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 300; color: #212529; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                Contact Details
              </h2>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; font-size: 14px; color: #495057; width: 100px; vertical-align: top;">
                    Name
                  </td>
                  <td style="padding: 12px 0; font-size: 14px; color: #212529;">
                    ${name}
                  </td>
                </tr>

                <tr style="border-top: 1px solid #f1f3f5;">
                  <td style="padding: 12px 0; font-size: 14px; color: #495057; width: 100px; vertical-align: top;">
                    Email
                  </td>
                  <td style="padding: 12px 0; font-size: 14px;">
                    <a href="mailto:${email}" style="color: #212529; text-decoration: none; border-bottom: 1px solid #dee2e6;">
                      ${email}
                    </a>
                  </td>
                </tr>

                ${phone ? `
                <tr style="border-top: 1px solid #f1f3f5;">
                  <td style="padding: 12px 0; font-size: 14px; color: #495057; width: 100px; vertical-align: top;">
                    Phone
                  </td>
                  <td style="padding: 12px 0; font-size: 14px;">
                    <a href="tel:${phone}" style="color: #212529; text-decoration: none; border-bottom: 1px solid #dee2e6;">
                      ${phone}
                    </a>
                  </td>
                </tr>
                ` : ''}

                ${subject ? `
                <tr style="border-top: 1px solid #f1f3f5;">
                  <td style="padding: 12px 0; font-size: 14px; color: #495057; width: 100px; vertical-align: top;">
                    Subject
                  </td>
                  <td style="padding: 12px 0; font-size: 14px; color: #212529;">
                    ${subject}
                  </td>
                </tr>
                ` : ''}
              </table>
            </div>

            <!-- Message -->
            <div style="margin-bottom: 32px;">
              <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 300; color: #212529; padding-bottom: 12px; border-bottom: 1px solid #e9ecef;">
                Message
              </h2>
              <div style="padding: 20px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px;">
                <p style="margin: 0; white-space: pre-wrap; color: #212529; font-size: 14px; line-height: 1.7;">
                  ${message}
                </p>
              </div>
            </div>

            <!-- Quick Reply Notice -->
            <div style="padding: 16px 20px; background-color: #f8f9fa; border-left: 3px solid #212529; border-radius: 4px; margin-bottom: 32px;">
              <p style="margin: 0; font-size: 13px; color: #495057; line-height: 1.6;">
                <strong style="color: #212529;">Quick Reply:</strong> You can respond directly to this email to reach ${name} at ${email}
              </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding-top: 32px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #868e96;">
                Sent from
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color: #495057; text-decoration: none; border-bottom: 1px solid #dee2e6;">
                  ${process.env.NEXT_PUBLIC_SITE_NAME}
                </a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #adb5bd;">
                ${process.env.NEXT_PUBLIC_SITE_URL}
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Email sent successfully', data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
