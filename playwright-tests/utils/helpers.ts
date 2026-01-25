//Random string (5 letters + 5 digits) generator

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

//API Mail.tm

export const MailApi = {
  baseUrl: 'https://api.mail.tm',

  async getFirstDomain() {
    const res = await fetch(`${this.baseUrl}/domains`);
    const data = await res.json();
    return data['hydra:member'][0].domain;
  },

  async createAccount(address: string, pass: string) {
    const res = await fetch(`${this.baseUrl}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password: pass }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Failed to create mail.tm account: ${JSON.stringify(err)}`);
    }
  },

  async getToken(address: string, pass: string) {
    const res = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password: pass }),
    });
    const data = await res.json();
    return data.token;
  },

  async waitForMessage(token: string, subject: string, expectedCount = 1, timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = await fetch(`${this.baseUrl}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const messages = data['hydra:member'] || [];

      const matchingMessages = messages
        .filter((m: any) => m.subject.toLowerCase().includes(subject.toLowerCase()))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (matchingMessages.length >= expectedCount) {
        const newestMsg = matchingMessages[0];
        const fullRes = await fetch(`${this.baseUrl}/messages/${newestMsg.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return await fullRes.json();
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error(`Subject "${subject}" not found with count ${expectedCount} within ${timeout}ms`);
  }
};