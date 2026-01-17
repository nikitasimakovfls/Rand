import axios from 'axios';

/**
 * Generates a random string: 5 letters followed by 5 digits.
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

/**
 * Waits for a welcome email on Mailsac and extracts the temporary password.
 * Logic: 4 attempts with a 15s interval before each poll (60s total timeout).
 */
export async function waitForWelcomeEmail(email: string) {
  const MAILSAC_API_KEY = process.env.MAILSAC_API_KEY;
  if (!MAILSAC_API_KEY) throw new Error('🛑 MAILSAC_API_KEY is missing');

  const maxAttempts = 4;
  const interval = 15000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n[Mailsac] Attempt ${attempt}/${maxAttempts}: Waiting 15s before polling ${email}...`);
    await new Promise(res => setTimeout(res, interval));

    try {
      const response = await axios.get(`https://mailsac.com/api/addresses/${email}/messages`, {
        headers: { 'Mailsac-Key': MAILSAC_API_KEY }
      });

      // Display remaining monthly API operations
      const remaining = response.headers['x-usage-limit-remaining'];
      console.log(`[Mailsac] API Status: ${response.status}. Remaining Ops: ${remaining}`);

      if (response.data && response.data.length > 0) {
        const welcomeEmail = response.data.find((m: any) => 
          m.subject.toLowerCase().includes('welcome')
        );

        if (welcomeEmail) {
          console.log(`[Mailsac] Email found! Fetching body...`);
          const msgResponse = await axios.get(
            `https://mailsac.com/api/text/${email}/${welcomeEmail._id}`, 
            { headers: { 'Mailsac-Key': MAILSAC_API_KEY } }
          );
          
          const passwordMatch = msgResponse.data.match(/temporary password:\s*([^\s]+)/i);
          if (passwordMatch) return passwordMatch[1].trim().replace(/[.,!]$/, '');
        }
      } else {
        console.log(`[Mailsac] Inbox is empty.`);
      }

    } catch (error: any) {
      if (error.response) {
        // Handle server errors (e.g., 429 Rate Limit or 401 Unauthorized)
        console.error(`[Mailsac Error] Status: ${error.response.status}`);
        console.error(`[Mailsac Error] Data:`, error.response.data);
        
        if (error.response.status === 429) {
            console.error('🛑 ATTENTION: API Rate Limit exceeded!');
        }
      } else {
        console.error(`[Mailsac Error] Network/Unknown error: ${error.message}`);
      }
    }
  }

  throw new Error(`[Mailsac] Timeout: Email did not arrive after 4 attempts.`);
}