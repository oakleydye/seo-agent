import Portkey from 'portkey-ai';

let _client: Portkey | null = null;

export function getPortkeyClient(): Portkey {
  if (_client) return _client;

  const apiKey = process.env['PORTKEY_API_KEY'];
  if (!apiKey) {
    throw new Error('PORTKEY_API_KEY environment variable is required');
  }

  _client = new Portkey({ apiKey });
  return _client;
}
