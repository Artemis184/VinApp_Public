import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';

console.log('🟡 GOOGLE_CLIENT_ID:', config.GOOGLE_CLIENT_ID);

const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);

interface GoogleUserPayload {
  email: string;
  google_id: string;
  full_name?: string;
  profile_photo?: string;
}

export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleUserPayload> => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email || !payload.sub) {
    throw new Error('Google token inválido');
  }

  return {
    email: payload.email,
    google_id: payload.sub, // ESTE ES EL google_id
    full_name: payload.name,
    profile_photo: payload.picture,
  };
};
