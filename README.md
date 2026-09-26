# MEKA School

A web-based school management system by MEKA for student records, school fees, payments, receipts, reporting, and staff/student attendance.

## Project Status

**Status:** Active Development

The Supabase migration is complete for the current application workflows. The legacy Node.js/Express backend has been removed from the repository.

**Paystack has not yet been integrated.** Payment-gateway integration is planned as a separate next step.

## Core Features

- Dashboard and school overview
- Student registration and student records
- Returning-student registration
- Class and enrollment management
- Fee structures and student fee accounts
- Payment records and receipts
- Financial and attendance reports
- Student attendance
- Teacher attendance
- Staff account management
- Admin, Secretary, and Teacher role restrictions
- Multi-tenant school scoping
- Admin-only student contact lookup and editing
- Responsive mobile interface

## System Architecture

```text
React + Vite
    |
    +--> Vercel
    |
    +--> Supabase Auth
    |
    +--> Supabase Database
    |
    +--> Supabase Edge Functions
             |
             +--> Protected staff-account operations
             +--> Protected student-contact operations
             +--> Other privileged server-side operations

Paystack
    |
    +--> Planned payment-gateway integration
```

## Data

The application uses Supabase for the current production data layer. The migration was designed to preserve existing student records; no student-data transformation or cleanup is performed as part of the frontend migration.

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Deployment

- Frontend: Vercel
- Authentication: Supabase Auth
- Database: Supabase
- Privileged backend operations: Supabase Edge Functions
- Payment gateway: Paystack (planned)
