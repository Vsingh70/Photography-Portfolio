/**
 * Contact form data
 */
export interface ContactFormData {
  name: string;
  email: string;
  subject?: string;
  message: string;
  phone?: string;
}

/**
 * Contact form submission response
 */
export interface ContactFormResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Inquiry types for contact form
 */
export type InquiryType =
  | 'general'
  | 'booking'
  | 'print-sales'
  | 'licensing'
  | 'collaboration'
  | 'other';

/**
 * Extended contact form with inquiry type
 */
export interface ContactInquiry extends ContactFormData {
  inquiryType: InquiryType;
  budget?: string;
  eventDate?: string;
  preferredContactMethod?: 'email' | 'phone';
}
