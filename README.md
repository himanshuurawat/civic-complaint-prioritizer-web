# Civic Complaint Prioritizer

A static HTML, CSS, and JavaScript website that lets civilians view local civic issues and submit reports for authority review.

## Current MVP

- Community issue board with department filters
- Report form with department chips and up to 3 photos (resized in the browser, kept in this browser only in this demo)
- Complaint-report form with input checks
- Demo sign-in with a display name only (no email or password)
- Browser-based storage using localStorage
- Responsive landing page; the sign-in window closes with Escape and keeps keyboard focus inside

## Run it

Open `index.html` in a browser. No Python, server, or package installation is required.

## Limits of this demo

- Reports and accounts are saved only in your own browser. Other people never see them and no authority receives them.
- The sign-in is a demo identity. No email or password is collected, and anyone can edit browser storage, so it does not protect anything.
- There is no authority login, status tracking, or prioritization in this repository.

## Planned later

- Real sign-in (email OTP or a trusted provider) and a shared database with access rules
- Authority login and response dashboard
- Maps, images, status tracking, and notifications
