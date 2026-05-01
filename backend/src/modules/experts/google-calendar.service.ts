import { Injectable } from '@nestjs/common';

export type UserCalendarConfig = {
  refreshToken: string;
  calendarId?: string;
  timezone?: string;
  googleEmail?: string;
};

type OAuthTokenExchangeResult = {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
  scope?: string;
  tokenType?: string;
};

type CreateMeetingInput = {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmails: string[];
  organizer?: UserCalendarConfig | null;
};

type CalendarMeetingResult = {
  eventId: string;
  htmlLink?: string;
  meetLink?: string;
  organizerCalendarId: string;
};

@Injectable()
export class GoogleCalendarService {
  async createMeeting(
    input: CreateMeetingInput,
  ): Promise<CalendarMeetingResult> {
    const config = this.resolveCalendarConfig(input.organizer);
    const accessToken = await this.getAccessToken(config.refreshToken);
    const timezone =
      config.timezone ||
      process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ||
      process.env.APP_TIMEZONE?.trim() ||
      'America/Lima';
    const calendarId = config.calendarId || 'primary';

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          summary: input.title,
          description: input.description,
          start: {
            dateTime: input.startDateTime,
            timeZone: timezone,
          },
          end: {
            dateTime: input.endDateTime,
            timeZone: timezone,
          },
          attendees: input.attendeeEmails.map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: {
                type: 'hangoutsMeet',
              },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Google Calendar API error: ${message || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      conferenceData?: {
        entryPoints?: Array<{ uri?: string }>;
      };
    };

    return {
      eventId: data.id ?? crypto.randomUUID(),
      htmlLink: data.htmlLink,
      meetLink:
        data.hangoutLink ??
        data.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri,
      organizerCalendarId: calendarId,
    };
  }

  async verifyCalendarConnection(
    connection: UserCalendarConfig,
  ): Promise<{
    calendarId: string;
    calendarName?: string;
    timezone?: string;
  }> {
    const config = this.resolveCalendarConfig(connection);
    const accessToken = await this.getAccessToken(config.refreshToken);
    const calendarId = config.calendarId || 'primary';
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `No se pudo validar el calendario del experto: ${message || response.statusText}`,
      );
    }

    const payload = (await response.json()) as {
      id?: string;
      summary?: string;
      timeZone?: string;
    };

    return {
      calendarId: payload.id || calendarId,
      calendarName: payload.summary,
      timezone: payload.timeZone || config.timezone,
    };
  }

  async getBusyWindows(input: {
    startDateTime: string;
    endDateTime: string;
    organizer?: UserCalendarConfig | null;
  }): Promise<Array<{ start: string; end: string }>> {
    const config = this.resolveCalendarConfig(input.organizer);
    const accessToken = await this.getAccessToken(config.refreshToken);
    const calendarId = config.calendarId || 'primary';
    const timezone =
      config.timezone ||
      process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ||
      process.env.APP_TIMEZONE?.trim() ||
      'America/Lima';
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/freeBusy',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          timeMin: input.startDateTime,
          timeMax: input.endDateTime,
          timeZone: timezone,
          items: [{ id: calendarId }],
        }),
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `No se pudo consultar disponibilidad en Google Calendar: ${message || response.statusText}`,
      );
    }

    const payload = (await response.json()) as {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    };

    return payload.calendars?.[calendarId]?.busy ?? [];
  }

  async createEventCopy(input: {
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    attendeeEmails?: string[];
    meetLink?: string;
    organizer?: UserCalendarConfig | null;
  }): Promise<CalendarMeetingResult> {
    const config = this.resolveCalendarConfig(input.organizer);
    const accessToken = await this.getAccessToken(config.refreshToken);
    const timezone =
      config.timezone ||
      process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ||
      process.env.APP_TIMEZONE?.trim() ||
      'America/Lima';
    const calendarId = config.calendarId || 'primary';
    const descriptionWithMeet = input.meetLink?.trim()
      ? `${input.description}\n\nGoogle Meet: ${input.meetLink.trim()}`
      : input.description;

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          summary: input.title,
          description: descriptionWithMeet,
          start: {
            dateTime: input.startDateTime,
            timeZone: timezone,
          },
          end: {
            dateTime: input.endDateTime,
            timeZone: timezone,
          },
          attendees: (input.attendeeEmails || []).map((email) => ({ email })),
        }),
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Google Calendar API error: ${message || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      id?: string;
      htmlLink?: string;
    };

    return {
      eventId: data.id ?? crypto.randomUUID(),
      htmlLink: data.htmlLink,
      organizerCalendarId: calendarId,
    };
  }

  async appendAttendeesToEvent(input: {
    eventId: string;
    attendeeEmails: string[];
    organizer?: UserCalendarConfig | null;
  }): Promise<void> {
    if (!input.attendeeEmails.length) {
      return;
    }

    const config = this.resolveCalendarConfig(input.organizer);
    const accessToken = await this.getAccessToken(config.refreshToken);
    const calendarId = config.calendarId || 'primary';
    const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}?sendUpdates=all`;

    const eventResponse = await fetch(eventUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!eventResponse.ok) {
      const message = await eventResponse.text();
      throw new Error(
        `No se pudo leer el evento grupal en Google Calendar: ${message || eventResponse.statusText}`,
      );
    }

    const eventPayload = (await eventResponse.json()) as {
      attendees?: Array<{ email?: string }>;
    };

    const currentEmails = new Set(
      (eventPayload.attendees || [])
        .map((attendee) => attendee.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );

    input.attendeeEmails.forEach((email) => currentEmails.add(email.trim().toLowerCase()));

    const patchResponse = await fetch(eventUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        attendees: Array.from(currentEmails).map((email) => ({ email })),
      }),
    });

    if (!patchResponse.ok) {
      const message = await patchResponse.text();
      throw new Error(
        `No se pudo actualizar asistentes en Google Calendar: ${message || patchResponse.statusText}`,
      );
    }
  }

  async updateEvent(input: {
    eventId: string;
    title?: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    attendeeEmails?: string[];
    organizer?: UserCalendarConfig | null;
  }): Promise<CalendarMeetingResult> {
    const config = this.resolveCalendarConfig(input.organizer);
    const accessToken = await this.getAccessToken(config.refreshToken);
    const calendarId = config.calendarId || 'primary';
    const timezone =
      config.timezone ||
      process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ||
      process.env.APP_TIMEZONE?.trim() ||
      'America/Lima';
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}?sendUpdates=all`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...(input.title ? { summary: input.title } : {}),
          ...(input.description ? { description: input.description } : {}),
          start: {
            dateTime: input.startDateTime,
            timeZone: timezone,
          },
          end: {
            dateTime: input.endDateTime,
            timeZone: timezone,
          },
          ...(input.attendeeEmails
            ? { attendees: input.attendeeEmails.map((email) => ({ email })) }
            : {}),
        }),
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `No se pudo actualizar el evento en Google Calendar: ${message || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      conferenceData?: {
        entryPoints?: Array<{ uri?: string }>;
      };
    };

    return {
      eventId: data.id ?? input.eventId,
      htmlLink: data.htmlLink,
      meetLink:
        data.hangoutLink ??
        data.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri,
      organizerCalendarId: calendarId,
    };
  }

  async deleteEvent(input: {
    eventId: string;
    organizer?: UserCalendarConfig | null;
  }): Promise<void> {
    const config = this.resolveCalendarConfig(input.organizer);
    const accessToken = await this.getAccessToken(config.refreshToken);
    const calendarId = config.calendarId || 'primary';
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (response.status === 404 || response.status === 410) {
      return;
    }

    if (!response.ok && response.status !== 204) {
      const message = await response.text();
      throw new Error(
        `No se pudo cancelar el evento en Google Calendar: ${message || response.statusText}`,
      );
    }
  }

  async exchangeAuthorizationCode(code: string): Promise<OAuthTokenExchangeResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Google OAuth no configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_OAUTH_REDIRECT_URI.',
      );
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `No se pudo completar la autorizacion con Google: ${message || response.statusText}`,
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    if (!payload.access_token || !payload.refresh_token) {
      throw new Error(
        'Google no devolvio un refresh token. Vuelve a autorizar la aplicacion con acceso offline.',
      );
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiryDate: payload.expires_in
        ? Date.now() + payload.expires_in * 1000
        : undefined,
      scope: payload.scope,
      tokenType: payload.token_type,
    };
  }

  async getAuthenticatedUserEmail(accessToken: string): Promise<string | undefined> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as { email?: string };
    return payload.email?.trim().toLowerCase();
  }

  private resolveCalendarConfig(
    organizer?: UserCalendarConfig | null,
  ): UserCalendarConfig {
    const mode = (process.env.GOOGLE_CALENDAR_MODE?.trim() || 'real').toLowerCase();
    if (mode === 'disabled' || mode === 'mock') {
      throw new Error(
        'Google Calendar esta desactivado. Define GOOGLE_CALENDAR_MODE=real para crear eventos reales.',
      );
    }

    const refreshToken =
      organizer?.refreshToken?.trim() ||
      process.env.GOOGLE_REFRESH_TOKEN?.trim();
    const calendarId =
      organizer?.calendarId?.trim() ||
      process.env.GOOGLE_CALENDAR_ID?.trim() ||
      'primary';
    const timezone =
      organizer?.timezone?.trim() ||
      process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ||
      process.env.APP_TIMEZONE?.trim() ||
      'America/Lima';
    const googleEmail = organizer?.googleEmail?.trim();

    if (!refreshToken) {
      throw new Error(
        'El experto aun no conecto Google Calendar y tampoco existe una configuracion global de respaldo.',
      );
    }

    return {
      refreshToken,
      calendarId,
      timezone,
      googleEmail,
    };
  }

  private async getAccessToken(refreshToken: string): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Google Calendar no configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN.',
      );
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `No se pudo obtener token de Google: ${message || response.statusText}`,
      );
    }

    const payload = (await response.json()) as { access_token?: string };

    if (!payload.access_token) {
      throw new Error('Google no devolvio access_token para Calendar.');
    }

    return payload.access_token;
  }
}
