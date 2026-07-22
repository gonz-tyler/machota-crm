# Changelog

## [0.1.0] - 2026-07-22

This release includes the completion of the terms and conditions view in the client portal, along with added security deposit functionality and client action buttons. Additionally, new fields have been introduced to manage tentative dates and versioning within the presupuesto model, enhancing overall user experience and CRM functionalities.

### Added

- **frontend:** add terms and conditions view layer and logic to client portal (330452e)
- **frontend:** add security deposit functionality to PresupuestosPage (fbd69de)
- **crm:** add security deposit fields to presupuesto model and serializers (ab416db)
- **frontend:** add client action buttons and simulated email popup (07f6b9b)
- **crm:** add is_date_tentative field to Event and Presupuesto models (6202dfc)
- **frontend:** add client modal component and integrate with presupuesto creation (0809831)
- **crm:** add portal functionality for presupuesto version (c1daa2e)

### Maintenance

- **roadmap:** mark feat/client-portal-tnc complete (51c75d4)
- **frontend:** improve error handling and UI styling in PresupuestoPortal (eb3daed)
- **crm:** disable confirmation email until implemented (3185e93)
- **roadmap:** mark feat/budget-client-creation complete (3ce21b5)

All notable changes to this project will be documented in this file.

## [0.0.1] - 2026-07-22

The latest release includes a new roadmap document for CRM development and updated `.gitignore` settings to exclude all `.env` files except for the example file.

### Maintenance

- add roadmap for CRM development (e76b8cf)
- update .gitignore to ignore all .env files except .env.example (d0dc8cb)
