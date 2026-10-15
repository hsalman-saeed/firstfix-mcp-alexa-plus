import { Router, Request, Response } from 'express';
import { appState, AppointmentRecord } from './state.js';

export const localBookingRouter = Router();

// Middleware: Echo Request-Id and cache headers
localBookingRouter.use((req: Request, res: Response, next) => {
  const reqId = (req.headers['request-id'] as string) || `req_spi_${Date.now()}`;
  res.setHeader('Request-Id', reqId);
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/**
 * GET /v1/localbooking/businesses/:businessId
 * GetBusiness endpoint
 */
localBookingRouter.get('/v1/localbooking/businesses/:businessId', (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;
  const van = appState.vans.find((v) => v.contractorId === businessId);

  if (!van) {
    res.status(404).json({
      code: 'business_not_found',
      message: `Business '${businessId}' not found in local provider registry.`,
    });
    return;
  }

  res.status(200).json({
    businessId: van.contractorId,
    name: van.companyName,
    rating: van.rating,
    phone: '+1-206-555-0199',
    address: {
      street: '1420 5th Ave',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'US',
    },
    serviceAreas: van.zipCodesCovered,
    complianceStatus: 'VERIFIED_ACTIVE',
  });
});

/**
 * POST /v1/localbooking/businesses/:businessId/services
 * GetServices endpoint
 */
localBookingRouter.post('/v1/localbooking/businesses/:businessId/services', (req: Request, res: Response) => {
  const businessId = req.params.businessId as string;
  const correlationToken =
    req.body.correlationToken || `ff_spi_corr_${Date.now()}`;

  const van = appState.vans.find((v) => v.contractorId === businessId);
  if (!van) {
    res.status(404).json({
      code: 'business_not_found',
      message: `Business '${businessId}' not found.`,
    });
    return;
  }

  res.status(200).json({
    businessId,
    correlationToken,
    services: [
      {
        serviceId: 'srv_oem_firstfix_repair',
        name: 'FirstFix OEM Serial-Matched Repair Dispatch',
        description:
          'Single-visit repair with truck-stocked OEM part. Diagnostic fee credited 100% toward repair labor.',
        diagnosticFeeUsd: van.pricing.diagnosticFeeUsd,
        bindingEstimateMinUsd: van.pricing.bindingEstimateMinUsd,
        bindingEstimateMaxUsd: van.pricing.bindingEstimateMaxUsd,
        durationMinutes: 90,
      },
    ],
  });
});

/**
 * GET /v1/localbooking/businesses/:businessId/services/:serviceId/availability
 * GetAvailability endpoint with RFC 3339 timestamps and correlationToken
 */
localBookingRouter.get(
  '/v1/localbooking/businesses/:businessId/services/:serviceId/availability',
  (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const serviceId = req.params.serviceId as string;
    const correlationToken =
      (req.query.correlationToken as string) || `ff_spi_avail_${Date.now()}`;

    const van = appState.vans.find((v) => v.contractorId === businessId);
    if (!van) {
      res.status(404).json({
        code: 'business_not_found',
        message: `Business '${businessId}' not found.`,
      });
      return;
    }

    const availableSlots = van.availableSlots.map((slot) => {
      const date = slot.dateIso;
      const startRfc3339 = `${date}T${slot.startTime}:00Z`;
      const endRfc3339 = `${date}T${slot.endTime}:00Z`;

      return {
        slotId: slot.slotId,
        vanId: van.vanId,
        technicianName: van.technicianName,
        rating: van.rating,
        startTime: startRfc3339,
        endTime: endRfc3339,
        serviceId,
      };
    });

    res.status(200).json({
      businessId,
      serviceId,
      correlationToken,
      availableSlots,
    });
  }
);

/**
 * POST /v1/localbooking/businesses/:businessId/appointments
 * CreateAppointment endpoint
 */
localBookingRouter.post(
  '/v1/localbooking/businesses/:businessId/appointments',
  (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const {
      serviceId = 'srv_oem_firstfix_repair',
      slot,
      customer,
      correlationToken = `ff_appt_corr_${Date.now()}`,
      oemPartSku = 'BOSCH-00631200',
    } = req.body;

    const van = appState.vans.find((v) => v.contractorId === businessId);
    if (!van) {
      res.status(404).json({
        code: 'business_not_found',
        message: `Business '${businessId}' not found.`,
      });
      return;
    }

    const appointmentId = `appt_spi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const startTimeIso: string = slot?.startTime || '2026-10-15T14:00:00Z';
    const endTimeIso: string = slot?.endTime || '2026-10-15T15:30:00Z';

    const appt: AppointmentRecord = {
      appointmentId,
      businessId,
      serviceId,
      vanId: van.vanId,
      technicianName: van.technicianName,
      slotId: slot?.slotId,
      startTimeIso,
      endTimeIso,
      oemPartSku,
      customerName: customer?.name || 'Jane Doe',
      customerPhone: customer?.phone || '+1-206-555-0144',
      customerAddress: customer?.address || {
        street: '742 Evergreen Terrace',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
      },
      correlationToken,
      status: 'CONFIRMED',
      diagnosticFeeUsd: van.pricing.diagnosticFeeUsd,
      bindingEstimateMinUsd: van.pricing.bindingEstimateMinUsd,
      bindingEstimateMaxUsd: van.pricing.bindingEstimateMaxUsd,
      partHeld: true,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };

    appState.holdPartOnVan(van.vanId, oemPartSku);
    appState.appointments.set(appointmentId, appt);

    res.status(201).json({
      appointmentId,
      status: 'CONFIRMED',
      correlationToken,
      appointment: {
        appointmentId,
        businessId,
        serviceId,
        startTime: startTimeIso,
        endTime: endTimeIso,
        technician: {
          name: van.technicianName,
          vanId: van.vanId,
          rating: van.rating,
        },
        pricing: {
          diagnosticFeeUsd: van.pricing.diagnosticFeeUsd,
          creditedToRepair: true,
          bindingEstimateMinUsd: van.pricing.bindingEstimateMinUsd,
          bindingEstimateMaxUsd: van.pricing.bindingEstimateMaxUsd,
        },
      },
    });
  }
);

/**
 * GET /v1/localbooking/businesses/:businessId/appointments/:appointmentId
 * GetAppointment endpoint
 */
localBookingRouter.get(
  '/v1/localbooking/businesses/:businessId/appointments/:appointmentId',
  (req: Request, res: Response) => {
    const appointmentId = req.params.appointmentId as string;
    const appt = appState.appointments.get(appointmentId);

    if (!appt) {
      res.status(404).json({
        code: 'appointment_not_found',
        message: `Appointment '${appointmentId}' not found.`,
      });
      return;
    }

    res.status(200).json({
      appointmentId: appt.appointmentId,
      businessId: appt.businessId,
      serviceId: appt.serviceId,
      status: appt.status,
      startTime: appt.startTimeIso,
      endTime: appt.endTimeIso,
      technicianName: appt.technicianName,
      correlationToken: appt.correlationToken,
    });
  }
);

/**
 * DELETE /v1/localbooking/businesses/:businessId/appointments/:appointmentId
 * CancelAppointment endpoint (idempotent)
 */
localBookingRouter.delete(
  '/v1/localbooking/businesses/:businessId/appointments/:appointmentId',
  (req: Request, res: Response) => {
    const appointmentId = req.params.appointmentId as string;
    const appt = appState.appointments.get(appointmentId);

    if (!appt) {
      res.status(404).json({
        code: 'appointment_not_found',
        message: `Appointment '${appointmentId}' not found.`,
      });
      return;
    }

    if (appt.status === 'CANCELLED') {
      res.status(200).json({
        appointmentId,
        status: 'CANCELLED',
        message: 'Appointment was already cancelled.',
      });
      return;
    }

    appt.status = 'CANCELLED';
    appt.updatedAtIso = new Date().toISOString();

    if (appt.partHeld) {
      appState.releasePartOnVan(appt.vanId, appt.oemPartSku);
      appt.partHeld = false;
    }

    res.status(200).json({
      appointmentId,
      status: 'CANCELLED',
      message: 'Appointment successfully cancelled and OEM truck stock released.',
    });
  }
);
