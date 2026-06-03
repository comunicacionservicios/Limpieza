import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add Google Calendar scopes
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initial auth state listener
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Load cached token from session if any (just for persistence during the session)
  const savedToken = sessionStorage.getItem('gcal_access_token');
  if (savedToken) {
    cachedAccessToken = savedToken;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        sessionStorage.removeItem('gcal_access_token');
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token');
    }

    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem('gcal_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Error in Google Sign In:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  sessionStorage.removeItem('gcal_access_token');
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken || sessionStorage.getItem('gcal_access_token');
};

// Help map task frequency to google calendar RRULE RFC5545
const mapFrequencyToRrule = (frecuencia: string): string[] | undefined => {
  const normalized = frecuencia.trim().toLowerCase();
  if (normalized.includes('diaria') || normalized.includes('diario') || normalized === 'cada día' || normalized === 'todos los días') {
    return ['RRULE:FREQ=DAILY'];
  }
  if (normalized.includes('semanal') || normalized.includes('semana')) {
    return ['RRULE:FREQ=WEEKLY'];
  }
  if (normalized.includes('mensual') || normalized.includes('mes')) {
    return ['RRULE:FREQ=MONTHLY'];
  }
  return undefined;
};

// Insert a task event to the user's Google Calendar
export const createGoogleCalendarEvent = async (
  accessToken: string,
  task: { titulo: string; descripcion?: string; frecuencia?: string; fecha_vencimiento?: string }
): Promise<any> => {
  try {
    const startDateTime = task.fecha_vencimiento 
      ? new Date(task.fecha_vencimiento).toISOString() 
      : new Date().toISOString();
    
    // Default duration is 1 hour
    const endDateTime = task.fecha_vencimiento 
      ? new Date(new Date(task.fecha_vencimiento).getTime() + 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const recurrence = task.frecuencia ? mapFrequencyToRrule(task.frecuencia) : undefined;

    const eventBody: any = {
      summary: `Higiene: ${task.titulo}`,
      description: `${task.descripcion || 'Sin descripción'}\n\nFrecuencia: ${task.frecuencia || 'Única'}\nSincronizado de la aplicación de limpieza.`,
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 15 },
          { method: 'email', minutes: 60 }
        ]
      }
    };

    if (recurrence) {
      eventBody.recurrence = recurrence;
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    throw error;
  }
};
