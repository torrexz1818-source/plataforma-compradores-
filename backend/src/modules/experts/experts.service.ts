import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../auth/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/domain/user-role.enum';
import {
  GoogleCalendarService,
  UserCalendarConfig,
} from './google-calendar.service';

type AppointmentStatus = 'scheduled' | 'cancelled';

type ExpertAppointmentRecord = {
  id: string;
  buyerId: string;
  expertId: string;
  startsAt: Date;
  endsAt: Date;
  topic: string;
  status: AppointmentStatus;
  buyerEmail: string;
  expertEmail: string;
  expertName: string;
  buyerName: string;
  googleCalendarEventId?: string;
  googleCalendarHtmlLink?: string;
  buyerGoogleCalendarEventId?: string;
  buyerGoogleCalendarHtmlLink?: string;
  googleMeetLink?: string;
  emailSent: boolean;
  emailError?: string;
  createdAt: Date;
  updatedAt: Date;
};

type UserCalendarConnectionRecord = {
  id: string;
  userId: string;
  role: UserRole;
  googleEmail?: string;
  calendarId: string;
  calendarName?: string;
  timezone?: string;
  refreshToken: string;
  connectedAt: Date;
  updatedAt: Date;
};

type WeeklyAvailabilityItem = {
  day: string;
  enabled: boolean;
  slots: WeeklyAvailabilitySlot[];
};

type WeeklyAvailabilitySlot = {
  id: string;
  startTime: string;
  endTime: string;
};
const MAX_GROUP_PARTICIPANTS = 3;

const WEEKDAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
];
const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailabilityItem[] = [
  { day: 'Lunes', enabled: true, slots: [{ id: 'lunes-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Martes', enabled: true, slots: [{ id: 'martes-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Miercoles', enabled: true, slots: [{ id: 'miercoles-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Jueves', enabled: true, slots: [{ id: 'jueves-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Viernes', enabled: true, slots: [{ id: 'viernes-1', startTime: '09:00', endTime: '17:00' }] },
  { day: 'Sabado', enabled: false, slots: [{ id: 'sabado-1', startTime: '09:00', endTime: '13:00' }] },
  { day: 'Domingo', enabled: false, slots: [{ id: 'domingo-1', startTime: '09:00', endTime: '13:00' }] },
];
const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar',
];

@Injectable()
export class ExpertsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly databaseService: DatabaseService,
    private readonly calendarService: GoogleCalendarService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listExperts() {
    const experts = await this.usersService.listExperts();
    const calendarConnections = await this.getCalendarConnectionsByUserIds(
      experts.map((expert) => expert.id),
    );
    const appointments = await this.collection()
      .find({ status: 'scheduled' })
      .toArray();
    const countsByExpert = new Map<string, number>();

    appointments.forEach((appointment) => {
      countsByExpert.set(
        appointment.expertId,
        (countsByExpert.get(appointment.expertId) ?? 0) + 1,
      );
    });

    return experts.map((expert) => ({
      id: expert.id,
      fullName: expert.fullName,
      photo: expert.expertProfile?.photo || expert.avatarUrl || '',
      specialty: expert.expertProfile?.specialty || expert.position,
      industry: expert.expertProfile?.industry || expert.sector || 'General',
      experience:
        expert.expertProfile?.experience ||
        expert.description ||
        'Experiencia no especificada.',
      shortBio:
        expert.description ||
        expert.expertProfile?.biography ||
        'Perfil profesional disponible.',
      service: expert.expertProfile?.service || '',
      skills: expert.expertProfile?.skills || [],
      availabilityDays: expert.expertProfile?.availabilityDays || [],
      weeklyAvailability: this.getWeeklyAvailability(expert),
      googleCalendarConnected: calendarConnections.has(expert.id),
      meetingsCount: countsByExpert.get(expert.id) ?? 0,
    }));
  }

  async getExpertProfile(expertId: string) {
    const expert = await this.usersService.findExpertById(expertId);

    if (!expert) {
      throw new NotFoundException('Experto no encontrado');
    }

    const upcomingMeetings = await this.collection().countDocuments({
      expertId,
      status: 'scheduled',
      startsAt: { $gte: new Date() },
    });
    const calendarConnection = await this.calendarConnectionsCollection().findOne({
      userId: expertId,
    });

    return {
      id: expert.id,
      fullName: expert.fullName,
      email: expert.email,
      photo: expert.expertProfile?.photo || expert.avatarUrl || '',
      specialty: expert.expertProfile?.specialty || expert.position,
      industry: expert.expertProfile?.industry || expert.sector || 'General',
      experience: expert.expertProfile?.experience || '',
      professionalProfile:
        expert.expertProfile?.currentProfessionalProfile || expert.position,
      biography: expert.expertProfile?.biography || expert.description || '',
      description: expert.description || expert.expertProfile?.service || '',
      companies: expert.expertProfile?.companies || '',
      education: expert.expertProfile?.education || '',
      achievements: expert.expertProfile?.achievements || '',
      service: expert.expertProfile?.service || '',
      skills: expert.expertProfile?.skills || [],
      availabilityDays: expert.expertProfile?.availabilityDays || [],
      weeklyAvailability: this.getWeeklyAvailability(expert),
      googleCalendarConnected: Boolean(calendarConnection),
      upcomingMeetings,
    };
  }

  async getExpertAvailability(expertId: string, dateInput?: string) {
    const expert = await this.usersService.findExpertById(expertId);
    if (!expert) {
      throw new NotFoundException('Experto no encontrado');
    }

    const targetDate = this.parseDate(dateInput);
    const weekday = WEEKDAY_LABELS[targetDate.getDay()];
    const weeklyAvailability = this.getWeeklyAvailability(expert);
    const activeDays = weeklyAvailability
      .filter((item) => item.enabled)
      .map((item) => item.day);
    const dayConfig = weeklyAvailability.find((item) => item.day === weekday);
    const isAvailableDay = Boolean(dayConfig?.enabled && dayConfig.slots.length);

    const slots = this.buildDaySlots(targetDate, dayConfig).map((slot) => ({
      ...slot,
      available: isAvailableDay,
    }));

    const existingAppointments = await this.collection()
      .find({
        expertId,
        status: 'scheduled',
        startsAt: {
          $gte: this.startOfDay(targetDate),
          $lt: this.endOfDay(targetDate),
        },
      })
      .toArray();

    const bookingsBySlot = new Map<string, number>();
    existingAppointments.forEach((appointment) => {
      const key = appointment.startsAt.toISOString();
      bookingsBySlot.set(key, (bookingsBySlot.get(key) ?? 0) + 1);
    });
    const reserved = new Set<string>();
    const calendarConnection = await this.calendarConnectionsCollection().findOne({
      userId: expertId,
    });

    if (calendarConnection) {
      try {
        const busyWindows = await this.calendarService.getBusyWindows({
          startDateTime: this.startOfDay(targetDate).toISOString(),
          endDateTime: this.endOfDay(targetDate).toISOString(),
          organizer: this.toCalendarConfig(calendarConnection),
        });

        busyWindows.forEach((window) => {
          const start = new Date(window.start).getTime();
          const end = new Date(window.end).getTime();

          slots.forEach((slot) => {
            const slotStart = new Date(slot.startsAt).getTime();
            const slotEnd = new Date(slot.endsAt).getTime();

            const bookingsCount = bookingsBySlot.get(slot.startsAt) ?? 0;
            if (slotStart < end && slotEnd > start && bookingsCount === 0) {
              reserved.add(slot.startsAt);
            }
          });
        });
      } catch {
        // Keep DB-based availability if Google availability lookup fails.
      }
    }

    return {
      expertId,
      date: this.startOfDay(targetDate).toISOString(),
      weekday,
      availabilityDays: activeDays,
      weeklyAvailability,
      slots: slots.map((slot) => ({
        ...slot,
        maxParticipants: MAX_GROUP_PARTICIPANTS,
        bookedParticipants: bookingsBySlot.get(slot.startsAt) ?? 0,
        remainingSpots: Math.max(
          MAX_GROUP_PARTICIPANTS - (bookingsBySlot.get(slot.startsAt) ?? 0),
          0,
        ),
        available:
          slot.available &&
          !reserved.has(slot.startsAt) &&
          (bookingsBySlot.get(slot.startsAt) ?? 0) < MAX_GROUP_PARTICIPANTS,
      })),
    };
  }

  async createAppointment(input: {
    buyerId: string;
    expertId: string;
    startsAt: string;
    topic: string;
  }) {
    const buyer = await this.usersService.requireActiveUser(input.buyerId);
    if (buyer.role !== UserRole.BUYER) {
      throw new ForbiddenException(
        'Solo usuarios compradores autenticados pueden agendar',
      );
    }

    const expert = await this.usersService.findExpertById(input.expertId);
    if (!expert) {
      throw new NotFoundException('Experto no encontrado');
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Fecha u hora invalida');
    }

    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'La cita debe programarse en una fecha futura',
      );
    }

    const topic = input.topic.trim();
    if (!topic) {
      throw new BadRequestException('La descripcion del tema es obligatoria');
    }

    const weekday = WEEKDAY_LABELS[startsAt.getDay()];
    const weeklyAvailability = this.getWeeklyAvailability(expert);
    const dayConfig = weeklyAvailability.find((item) => item.day === weekday);
    if (!dayConfig?.enabled) {
      throw new BadRequestException(`El experto no atiende los ${weekday}`);
    }

    if (!this.isValidSlot(startsAt, dayConfig)) {
      throw new BadRequestException(
        'Selecciona un horario valido dentro de la disponibilidad configurada por el experto',
      );
    }

    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const duplicateBooking = await this.collection().findOne({
      buyerId: buyer.id,
      expertId: expert.id,
      startsAt,
      status: 'scheduled',
    });

    if (duplicateBooking) {
      throw new ConflictException(
        'Ya tienes una reserva en este mismo horario con este experto.',
      );
    }

    const sameSlotAppointments = await this.collection()
      .find({
        expertId: expert.id,
        startsAt,
        status: 'scheduled',
      })
      .toArray();

    if (sameSlotAppointments.length >= MAX_GROUP_PARTICIPANTS) {
      throw new ConflictException(
        'Este horario ya completo los 3 cupos disponibles. Elige otro horario.',
      );
    }

    const expertCalendarConnection = await this.calendarConnectionsCollection().findOne({
      userId: expert.id,
    });
    if (expertCalendarConnection && sameSlotAppointments.length === 0) {
      const busyWindows = await this.calendarService.getBusyWindows({
        startDateTime: startsAt.toISOString(),
        endDateTime: endsAt.toISOString(),
        organizer: this.toCalendarConfig(expertCalendarConnection),
      });

      if (busyWindows.length > 0) {
        throw new ConflictException(
          'El experto ya tiene un evento en Google Calendar para ese horario.',
        );
      }
    }

    const primaryAppointment = sameSlotAppointments[0];
    const calendarMeeting = primaryAppointment
      ? {
          eventId: primaryAppointment.googleCalendarEventId ?? crypto.randomUUID(),
          htmlLink: primaryAppointment.googleCalendarHtmlLink,
          meetLink: primaryAppointment.googleMeetLink,
          organizerCalendarId: expertCalendarConnection?.calendarId || 'primary',
        }
      : await this.calendarService.createMeeting({
          title: 'Reunion grupal con experto Nexu',
          description: topic,
          startDateTime: startsAt.toISOString(),
          endDateTime: endsAt.toISOString(),
          attendeeEmails: [buyer.email, expert.email],
          organizer: expertCalendarConnection
            ? this.toCalendarConfig(expertCalendarConnection)
            : undefined,
        });

    if (
      primaryAppointment &&
      expertCalendarConnection &&
      primaryAppointment.googleCalendarEventId
    ) {
      try {
        await this.calendarService.appendAttendeesToEvent({
          eventId: primaryAppointment.googleCalendarEventId,
          attendeeEmails: [buyer.email],
          organizer: this.toCalendarConfig(expertCalendarConnection),
        });
      } catch {
        // Keep the platform booking even if attendee sync in the shared event fails.
      }
    }
    const buyerCalendarConnection = await this.calendarConnectionsCollection().findOne({
      userId: buyer.id,
    });

    const now = new Date();
    const appointment: ExpertAppointmentRecord = {
      id: crypto.randomUUID(),
      buyerId: buyer.id,
      expertId: expert.id,
      startsAt,
      endsAt,
      topic,
      status: 'scheduled',
      buyerEmail: buyer.email,
      expertEmail: expert.email,
      buyerName: buyer.fullName,
      expertName: expert.fullName,
      googleCalendarEventId: calendarMeeting.eventId,
      googleCalendarHtmlLink: calendarMeeting.htmlLink,
      googleMeetLink: calendarMeeting.meetLink,
      emailSent: false,
      createdAt: now,
      updatedAt: now,
    };

    if (buyerCalendarConnection) {
      try {
        const buyerCalendarEvent = await this.calendarService.createEventCopy({
      title: `Reunion grupal con ${expert.fullName} - Nexu Experts`,
      description: topic,
          startDateTime: startsAt.toISOString(),
          endDateTime: endsAt.toISOString(),
          attendeeEmails: [expert.email, buyer.email],
          meetLink: calendarMeeting.meetLink,
          organizer: this.toCalendarConfig(buyerCalendarConnection),
        });
        appointment.buyerGoogleCalendarEventId = buyerCalendarEvent.eventId;
        appointment.buyerGoogleCalendarHtmlLink = buyerCalendarEvent.htmlLink;
      } catch {
        // Keep platform + expert calendar persistence even if buyer calendar sync fails.
      }
    }

    await this.collection().insertOne(appointment);

    let emailWarning: string | undefined;
    if (this.emailService.isConfigured()) {
      try {
        await this.emailService.sendExpertAppointmentConfirmation({
          buyerEmail: buyer.email,
          expertEmail: expert.email,
          buyerName: buyer.fullName,
          expertName: expert.fullName,
          startsAt: startsAt.toISOString(),
          topic,
          meetLink: calendarMeeting.meetLink,
        });

        await this.collection().updateOne(
          { id: appointment.id },
          { $set: { emailSent: true, updatedAt: new Date() } },
        );
        appointment.emailSent = true;
      } catch (error) {
        emailWarning =
          error instanceof Error
            ? error.message
            : 'La cita se creo, pero no se pudo enviar el correo de confirmacion.';

        await this.collection().updateOne(
          { id: appointment.id },
          {
            $set: {
              emailSent: false,
              emailError: emailWarning,
              updatedAt: new Date(),
            },
          },
        );
        appointment.emailError = emailWarning;
      }
    }

    await Promise.all([
      this.notificationsService.create({
        userId: expert.id,
        icon: 'MessageCircle',
        role: UserRole.BUYER,
        type: 'SYSTEM',
        title: `${buyer.fullName} agendo una reunion contigo`,
        body: topic,
        entityType: 'content',
        entityId: appointment.id,
        fromUserId: buyer.id,
        url: '/nexu-experts',
        time: 'Ahora',
      }),
      this.notificationsService.create({
        userId: buyer.id,
        icon: 'MessageCircle',
        role: UserRole.BUYER,
        type: 'SYSTEM',
        title: `Tu reunion con ${expert.fullName} fue confirmada`,
        body: topic,
        entityType: 'content',
        entityId: appointment.id,
        fromUserId: expert.id,
        url: '/nexu-experts',
        time: 'Ahora',
      }),
    ]);

    return {
      appointment: this.toPublicAppointment(appointment),
      emailWarning,
    };
  }

  async cancelAppointment(input: { appointmentId: string; userId: string }) {
    const appointment = await this.collection().findOne({ id: input.appointmentId });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (![appointment.buyerId, appointment.expertId].includes(input.userId)) {
      throw new ForbiddenException('No autorizado para cancelar esta cita');
    }

    if (appointment.status === 'cancelled') {
      return { appointment: this.toPublicAppointment(appointment) };
    }

    const expertCalendarConnection = await this.calendarConnectionsCollection().findOne({
      userId: appointment.expertId,
    });
    const buyerCalendarConnection = await this.calendarConnectionsCollection().findOne({
      userId: appointment.buyerId,
    });
    const expertOrganizer = expertCalendarConnection
      ? this.toCalendarConfig(expertCalendarConnection)
      : undefined;
    const buyerOrganizer = buyerCalendarConnection
      ? this.toCalendarConfig(buyerCalendarConnection)
      : undefined;
    const sameGoogleEventCount = appointment.googleCalendarEventId
      ? await this.collection().countDocuments({
          id: { $ne: appointment.id },
          googleCalendarEventId: appointment.googleCalendarEventId,
          status: 'scheduled',
        })
      : 0;

    if (
      appointment.googleCalendarEventId &&
      sameGoogleEventCount === 0
    ) {
      await this.calendarService.deleteEvent({
        eventId: appointment.googleCalendarEventId,
        organizer: expertOrganizer,
      });
    }

    if (appointment.buyerGoogleCalendarEventId && buyerCalendarConnection) {
      await this.calendarService.deleteEvent({
        eventId: appointment.buyerGoogleCalendarEventId,
        organizer: buyerOrganizer,
      });
    }

    const updated: ExpertAppointmentRecord = {
      ...appointment,
      status: 'cancelled',
      updatedAt: new Date(),
    };

    await this.collection().updateOne(
      { id: appointment.id },
      {
        $set: {
          status: updated.status,
          updatedAt: updated.updatedAt,
        },
      },
    );

    return { appointment: this.toPublicAppointment(updated) };
  }

  async rescheduleAppointment(input: {
    appointmentId: string;
    userId: string;
    startsAt: string;
  }) {
    const appointment = await this.collection().findOne({ id: input.appointmentId });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (![appointment.buyerId, appointment.expertId].includes(input.userId)) {
      throw new ForbiddenException('No autorizado para reprogramar esta cita');
    }

    if (appointment.status !== 'scheduled') {
      throw new BadRequestException('Solo se pueden reprogramar citas activas');
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('La nueva fecha debe ser futura y valida');
    }

    const expert = await this.usersService.findExpertById(appointment.expertId);
    if (!expert) {
      throw new NotFoundException('Experto no encontrado');
    }

    const weekday = WEEKDAY_LABELS[startsAt.getDay()];
    const dayConfig = this.getWeeklyAvailability(expert).find((item) => item.day === weekday);
    if (!this.isValidSlot(startsAt, dayConfig)) {
      throw new BadRequestException(
        'Selecciona un horario valido dentro de la disponibilidad configurada por el experto',
      );
    }

    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const sameSlotAppointments = await this.collection()
      .find({
        id: { $ne: appointment.id },
        expertId: appointment.expertId,
        startsAt,
        status: 'scheduled',
      })
      .toArray();

    if (sameSlotAppointments.length >= MAX_GROUP_PARTICIPANTS) {
      throw new ConflictException('Este horario ya completo los 3 cupos disponibles.');
    }

    const expertCalendarConnection = await this.calendarConnectionsCollection().findOne({
      userId: appointment.expertId,
    });
    const buyerCalendarConnection = await this.calendarConnectionsCollection().findOne({
      userId: appointment.buyerId,
    });
    const expertOrganizer = expertCalendarConnection
      ? this.toCalendarConfig(expertCalendarConnection)
      : undefined;
    const buyerOrganizer = buyerCalendarConnection
      ? this.toCalendarConfig(buyerCalendarConnection)
      : undefined;

    if (expertCalendarConnection) {
      const busyWindows = await this.calendarService.getBusyWindows({
        startDateTime: startsAt.toISOString(),
        endDateTime: endsAt.toISOString(),
        organizer: expertOrganizer,
      });

      const isSameEventWindow = appointment.startsAt.getTime() === startsAt.getTime();
      if (busyWindows.length > 0 && !isSameEventWindow) {
        throw new ConflictException(
          'El experto ya tiene un evento en Google Calendar para ese horario.',
        );
      }
    }

    let googleCalendarHtmlLink = appointment.googleCalendarHtmlLink;
    let googleMeetLink = appointment.googleMeetLink;
    if (appointment.googleCalendarEventId) {
      const updatedEvent = await this.calendarService.updateEvent({
        eventId: appointment.googleCalendarEventId,
        title: 'Reunion grupal con experto Nexu',
        description: appointment.topic,
        startDateTime: startsAt.toISOString(),
        endDateTime: endsAt.toISOString(),
        attendeeEmails: [appointment.buyerEmail, appointment.expertEmail],
        organizer: expertOrganizer,
      });
      googleCalendarHtmlLink = updatedEvent.htmlLink ?? googleCalendarHtmlLink;
      googleMeetLink = updatedEvent.meetLink ?? googleMeetLink;
    }

    let buyerGoogleCalendarHtmlLink = appointment.buyerGoogleCalendarHtmlLink;
    if (appointment.buyerGoogleCalendarEventId && buyerCalendarConnection) {
      const updatedBuyerEvent = await this.calendarService.updateEvent({
        eventId: appointment.buyerGoogleCalendarEventId,
        title: `Reunion grupal con ${appointment.expertName} - Nexu Experts`,
        description: appointment.topic,
        startDateTime: startsAt.toISOString(),
        endDateTime: endsAt.toISOString(),
        attendeeEmails: [appointment.expertEmail, appointment.buyerEmail],
        organizer: buyerOrganizer,
      });
      buyerGoogleCalendarHtmlLink =
        updatedBuyerEvent.htmlLink ?? buyerGoogleCalendarHtmlLink;
    }

    const updated: ExpertAppointmentRecord = {
      ...appointment,
      startsAt,
      endsAt,
      googleCalendarHtmlLink,
      googleMeetLink,
      buyerGoogleCalendarHtmlLink,
      updatedAt: new Date(),
    };

    await this.collection().updateOne(
      { id: appointment.id },
      {
        $set: {
          startsAt: updated.startsAt,
          endsAt: updated.endsAt,
          googleCalendarHtmlLink: updated.googleCalendarHtmlLink,
          googleMeetLink: updated.googleMeetLink,
          buyerGoogleCalendarHtmlLink: updated.buyerGoogleCalendarHtmlLink,
          updatedAt: updated.updatedAt,
        },
      },
    );

    return { appointment: this.toPublicAppointment(updated) };
  }

  async getDashboard(userId: string, role: string) {
    const isExpertDashboard = role === 'expert';
    const filters = isExpertDashboard
      ? { expertId: userId }
      : { buyerId: userId };

    const appointments = await this.collection()
      .find(filters)
      .sort({ startsAt: 1 })
      .toArray();

    return {
      role: isExpertDashboard ? 'expert' : 'buyer',
      items: appointments.map((appointment) =>
        this.toPublicAppointment(appointment),
      ),
    };
  }

  async getMyAvailabilitySettings(userId: string) {
    const expert = await this.usersService.requireActiveUser(userId);
    if (expert.role !== UserRole.EXPERT) {
      throw new ForbiddenException(
        'Solo los expertos pueden configurar su disponibilidad',
      );
    }

    const weeklyAvailability = this.getWeeklyAvailability(expert);

    return {
      availabilityDays: weeklyAvailability
        .filter((item) => item.enabled)
        .map((item) => item.day),
      weeklyAvailability,
    };
  }

  async updateMyAvailabilitySettings(
    userId: string,
    input: { weeklyAvailability: WeeklyAvailabilityItem[] },
  ) {
    const expert = await this.usersService.requireActiveUser(userId);
    if (expert.role !== UserRole.EXPERT) {
      throw new ForbiddenException(
        'Solo los expertos pueden configurar su disponibilidad',
      );
    }

    const weeklyAvailability = this.normalizeWeeklyAvailability(
      input.weeklyAvailability,
    );
    const updated = await this.usersService.updateExpertProfile(userId, {
      ...expert.expertProfile,
      availabilityDays: weeklyAvailability
        .filter((item) => item.enabled)
        .map((item) => item.day),
      weeklyAvailability,
    });

    return {
      availabilityDays: updated.expertProfile?.availabilityDays || [],
      weeklyAvailability: updated.expertProfile?.weeklyAvailability || weeklyAvailability,
    };
  }

  async getCalendarOAuthUrl(
    userId: string,
    options?: {
      frontendPath?: string;
    },
  ) {
    const user = await this.usersService.requireActiveUser(userId);
    if (![UserRole.BUYER, UserRole.EXPERT].includes(user.role)) {
      throw new ForbiddenException(
        'Solo compradores y expertos pueden conectar Google Calendar',
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Google OAuth no configurado. Define GOOGLE_CLIENT_ID y GOOGLE_OAUTH_REDIRECT_URI.',
      );
    }

    const frontendPath =
      options?.frontendPath?.trim() ||
      (user.role === UserRole.EXPERT
        ? '/expert/calendar-setup'
        : '/calendar-setup');

    const state = this.signOauthState({
      userId,
      role: user.role,
      frontendPath,
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', GOOGLE_CALENDAR_SCOPES.join(' '));
    url.searchParams.set('state', state);

    return {
      url: url.toString(),
    };
  }

  async completeCalendarOAuth(code: string, state: string) {
    const parsedState = this.verifyOauthState(state);
    const user = await this.usersService.requireActiveUser(parsedState.userId);
    if (user.role !== parsedState.role) {
      throw new ForbiddenException('La sesion de conexion ya no es valida');
    }

    const tokens = await this.calendarService.exchangeAuthorizationCode(code);
    const googleEmail =
      (await this.calendarService.getAuthenticatedUserEmail(tokens.accessToken)) ||
      user.email;
    const connection = await this.connectMyCalendar(user.id, {
      refreshToken: tokens.refreshToken,
      googleEmail,
      calendarId: 'primary',
      timezone:
        process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() ||
        process.env.APP_TIMEZONE?.trim() ||
        'America/Lima',
    });

    return {
      connection,
      frontendPath: parsedState.frontendPath,
      role: user.role,
    };
  }

  async getMyCalendarConnection(userId: string) {
    await this.usersService.requireActiveUser(userId);
    const connection = await this.calendarConnectionsCollection().findOne({
      userId,
    });

    return this.toPublicCalendarConnection(connection);
  }

  async connectMyCalendar(
    userId: string,
    input: {
      refreshToken: string;
      calendarId?: string;
      timezone?: string;
      googleEmail?: string;
    },
  ) {
    const user = await this.usersService.requireActiveUser(userId);

    const refreshToken = input.refreshToken.trim();
    if (!refreshToken) {
      throw new BadRequestException(
        'El refresh token de Google es obligatorio',
      );
    }

    const verified = await this.calendarService.verifyCalendarConnection({
      refreshToken,
      calendarId: input.calendarId?.trim(),
      timezone: input.timezone?.trim(),
      googleEmail: input.googleEmail?.trim(),
    });

    const now = new Date();
    const existing = await this.calendarConnectionsCollection().findOne({
      userId,
    });
    const record: UserCalendarConnectionRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      userId,
      role: user.role,
      googleEmail: input.googleEmail?.trim() || existing?.googleEmail || user.email,
      calendarId: verified.calendarId,
      calendarName: verified.calendarName || existing?.calendarName,
      timezone: input.timezone?.trim() || verified.timezone || existing?.timezone,
      refreshToken,
      connectedAt: existing?.connectedAt ?? now,
      updatedAt: now,
    };

    await this.calendarConnectionsCollection().updateOne(
      { userId },
      { $set: record },
      { upsert: true },
    );
    if (user.role === UserRole.EXPERT) {
      await this.usersCollection().updateOne(
        { id: userId },
        {
          $set: {
            'expertProfile.googleCalendarConnected': true,
            updatedAt: now,
          },
        },
      );
    }

    return this.toPublicCalendarConnection(record);
  }

  async disconnectMyCalendar(userId: string) {
    const user = await this.usersService.requireActiveUser(userId);

    await this.calendarConnectionsCollection().deleteOne({ userId });
    if (user.role === UserRole.EXPERT) {
      await this.usersCollection().updateOne(
        { id: userId },
        {
          $set: {
            'expertProfile.googleCalendarConnected': false,
            updatedAt: new Date(),
          },
        },
      );
    }

    return {
      connected: false,
    };
  }

  private toPublicAppointment(appointment: ExpertAppointmentRecord) {
    return {
      id: appointment.id,
      buyerId: appointment.buyerId,
      expertId: appointment.expertId,
      buyerName: appointment.buyerName,
      expertName: appointment.expertName,
      buyerEmail: appointment.buyerEmail,
      expertEmail: appointment.expertEmail,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      topic: appointment.topic,
      status: appointment.status,
      googleCalendarEventId: appointment.googleCalendarEventId,
      googleCalendarHtmlLink: appointment.googleCalendarHtmlLink,
      buyerGoogleCalendarEventId: appointment.buyerGoogleCalendarEventId,
      buyerGoogleCalendarHtmlLink: appointment.buyerGoogleCalendarHtmlLink,
      googleMeetLink: appointment.googleMeetLink,
      emailSent: appointment.emailSent,
      emailError: appointment.emailError,
      createdAt: appointment.createdAt.toISOString(),
      maxParticipants: MAX_GROUP_PARTICIPANTS,
    };
  }

  private collection() {
    return this.databaseService.collection<ExpertAppointmentRecord>(
      'expertAppointments',
    );
  }

  private usersCollection() {
    return this.databaseService.collection<{
      id: string;
      updatedAt: Date;
      expertProfile?: {
        googleCalendarConnected?: boolean;
      };
    }>('users');
  }

  private calendarConnectionsCollection() {
    return this.databaseService.collection<UserCalendarConnectionRecord>(
      'userCalendarConnections',
    );
  }

  private async getCalendarConnectionsByUserIds(userIds: string[]) {
    if (!userIds.length) {
      return new Map<string, UserCalendarConnectionRecord>();
    }

    const items = await this.calendarConnectionsCollection()
      .find({ userId: { $in: userIds } })
      .toArray();

    return new Map(items.map((item) => [item.userId, item]));
  }

  private toCalendarConfig(connection: UserCalendarConnectionRecord): UserCalendarConfig {
    return {
      refreshToken: connection.refreshToken,
      calendarId: connection.calendarId,
      timezone: connection.timezone,
      googleEmail: connection.googleEmail,
    };
  }

  private toPublicCalendarConnection(
    connection: UserCalendarConnectionRecord | null,
  ) {
    if (!connection) {
      return {
        connected: false,
      };
    }

    return {
      connected: true,
      googleEmail: connection.googleEmail,
      calendarId: connection.calendarId,
      calendarName: connection.calendarName,
      timezone: connection.timezone,
      connectedAt: connection.connectedAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  private parseDate(value?: string) {
    if (!value?.trim()) {
      return new Date();
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('La fecha solicitada es invalida');
    }

    return parsed;
  }

  private startOfDay(date: Date) {
    const cloned = new Date(date);
    cloned.setHours(0, 0, 0, 0);
    return cloned;
  }

  private endOfDay(date: Date) {
    const cloned = new Date(date);
    cloned.setHours(23, 59, 59, 999);
    return cloned;
  }

  private buildDaySlots(date: Date, dayConfig?: WeeklyAvailabilityItem) {
    const slots: Array<{ startsAt: string; endsAt: string; label: string }> =
      [];
    const ranges = dayConfig?.slots || [];

    ranges.forEach((range) => {
      const startHour = Number(range.startTime.split(':')[0] ?? 9);
      const endHour = Number(range.endTime.split(':')[0] ?? 17);

      for (let hour = startHour; hour < endHour; hour += 1) {
        const startsAt = new Date(date);
        startsAt.setHours(hour, 0, 0, 0);
        const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
        slots.push({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          label: `${String(hour).padStart(2, '0')}:00`,
        });
      }
    });

    return slots;
  }

  private isValidSlot(date: Date, dayConfig?: WeeklyAvailabilityItem) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (!dayConfig?.enabled || !dayConfig.slots.length) {
      return false;
    }

    return (
      minutes === 0 &&
      dayConfig.slots.some((slot) => {
        const startHour = Number(slot.startTime.split(':')[0] ?? 9);
        const endHour = Number(slot.endTime.split(':')[0] ?? 17);
        return hours >= startHour && hours < endHour;
      })
    );
  }

  private getWeeklyAvailability(expert: {
    expertProfile?: {
      availabilityDays?: string[];
      weeklyAvailability?: Array<
        WeeklyAvailabilityItem & {
          startTime?: string;
          endTime?: string;
        }
      >;
    };
  }) {
    const configured = expert.expertProfile?.weeklyAvailability;
    if (configured?.length) {
      return this.normalizeWeeklyAvailability(configured);
    }

    const availabilityDays = expert.expertProfile?.availabilityDays || [];
    return DEFAULT_WEEKLY_AVAILABILITY.map((item) => ({
      ...item,
      enabled:
        availabilityDays.length === 0
          ? item.enabled
          : availabilityDays.includes(item.day),
    }));
  }

  private normalizeWeeklyAvailability(items: WeeklyAvailabilityItem[]) {
    const legacyItems = items as Array<
      WeeklyAvailabilityItem & {
        startTime?: string;
        endTime?: string;
      }
    >;
    const receivedMap = new Map(
      (legacyItems || []).map((item) => [
        item.day,
        {
          day: item.day,
          enabled: Boolean(item.enabled),
          slots: (
            item.slots?.length
              ? item.slots
              : item.startTime && item.endTime
                ? [{ id: `${item.day.toLowerCase()}-1`, startTime: item.startTime, endTime: item.endTime }]
                : []
          ).map((slot, index) => ({
            id: slot.id?.trim() || `${item.day.toLowerCase()}-${index + 1}`,
            startTime: this.normalizeTime(slot.startTime),
            endTime: this.normalizeTime(slot.endTime),
          })),
        },
      ]),
    );

    return DEFAULT_WEEKLY_AVAILABILITY.map((fallback) => {
      const current = receivedMap.get(fallback.day);
      const next = current
        ? {
            ...current,
            slots: current.slots.map((slot, index) => ({
              id: slot.id?.trim() || `${current.day.toLowerCase()}-${index + 1}`,
              startTime: this.normalizeTime(slot.startTime),
              endTime: this.normalizeTime(slot.endTime),
            })),
          }
        : {
            ...fallback,
            slots: fallback.slots.map((slot) => ({ ...slot })),
          };

      next.slots.forEach((slot) => {
        if (this.toMinutes(slot.endTime) <= this.toMinutes(slot.startTime)) {
          throw new BadRequestException(
            `El horario configurado para ${next.day} es invalido`,
          );
        }
      });

      return next;
    });
  }

  private normalizeTime(value?: string) {
    const [hourText = '09', minuteText = '00'] = (value || '09:00').split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute !== 0
    ) {
      throw new BadRequestException(
        'Los horarios deben usar formato HH:00',
      );
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private toMinutes(value: string) {
    const [hourText = '0', minuteText = '0'] = value.split(':');
    return Number(hourText) * 60 + Number(minuteText);
  }

  private signOauthState(payload: {
    userId: string;
    role: string;
    frontendPath: string;
  }) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const secret = process.env.JWT_SECRET ?? 'dev-supplynexu-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  }

  private verifyOauthState(state: string) {
    const [encodedPayload, signature] = state.split('.');
    if (!encodedPayload || !signature) {
      throw new BadRequestException('El estado de Google OAuth es invalido');
    }

    const secret = process.env.JWT_SECRET ?? 'dev-supplynexu-secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new BadRequestException('No se pudo validar el estado de Google OAuth');
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as {
      userId?: string;
      role?: string;
      frontendPath?: string;
    };

    if (!payload.userId || !payload.role || !payload.frontendPath) {
      throw new BadRequestException('El estado de Google OAuth esta incompleto');
    }

    return {
      userId: payload.userId,
      role: payload.role as UserRole,
      frontendPath: payload.frontendPath,
    };
  }
}
