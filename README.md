# Predivic Schools

A web-based school management system being developed for Predivic Schools.

The system is designed to centralize student records, school fee management, payments, receipts, reporting, and student/staff attendance in one application.

---

## Project Status

**Status:** Active Development

The core student management, fee management, payment, and student attendance workflows are functional.

The current development focus is weekly attendance analytics followed by teacher attendance.

---

## Features

### Dashboard

- School management overview
- Key statistics
- Recent payment information
- Navigation to system modules

### Student Management

- Student registration
- First Name
- Last Name
- Automatic Student Number from Airtable
- Automatic Student ID
- Parent phone number
- Student status
- Class assignment
- Student list
- Airtable-backed student records

### School Classes

The system supports:

- Creche
- Nursery 1
- Nursery 2
- Primary 1
- Primary 2
- Primary 3
- Primary 4
- Primary 5
- JSS 1
- JSS 2
- JSS 3
- SS 1
- SS 2
- SS 3

### Fee Accounts

- Student-linked fee accounts
- Academic session
- Term
- Total fee
- Airtable-backed records

### Payments

- Payment records
- Student-linked payments
- Payment tracking

### Receipts

- Receipt management
- Payment-based receipt information

### Reports

- Financial reporting
- Attendance reporting
- Additional reporting functionality is under development

### Student Attendance

- Attendance organized by class
- Students loaded from the student register
- Present status
- Absent status
- Late status
- Excused status
- Attendance date
- Student-linked attendance records
- Airtable attendance storage
- Duplicate attendance protection
- Attendance recorded by school staff

---

# System Architecture

```text
React Frontend
      |
      | HTTP Requests
      v
Node.js / Express Backend
      |
      | Airtable API
      v
Airtable
      |
      +----------------------+
      |                      |
      v                      v
   Students             Fee Accounts
      |
      +----------------------+
      |
      v
   Attendance
      |
      v
    Reports
