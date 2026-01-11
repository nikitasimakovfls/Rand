/**
 * Generates a random string: 5 lowercase letters followed by 5 digits.
 * Useful for unique Emails, REDCap IDs, and MRNs.
 */
export function generateRandomSuffix(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 5; i++) {
    result += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return result;
}