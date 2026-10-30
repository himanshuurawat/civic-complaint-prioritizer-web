# Civic Complaint Prioritizer

A static HTML, CSS, and JavaScript website that lets civilians view local civic issues and submit reports for authority review.

The site is branded **YourLocality** (formerly CivicPulse).

## Current MVP

- Community issue board with department filters
- Report form with department chips and up to 3 photos (resized in the browser, kept in this browser only in this demo)
- Complaint-report form with input checks
- Email and password accounts through Supabase Auth, plus demo sign-in with a display name only
- Browser-based storage using localStorage
- Responsive landing page; the sign-in window closes with Escape and keeps keyboard focus inside

## Run it

Open `index.html` in a browser. No Python, server, or package installation is required.

## Limits of this demo

- Reports and photos are saved only in your own browser. Other people never see them and no authority receives them.
- Email and password accounts are real and handled by Supabase Auth (the website never stores passwords). They only prove who you are. Reports are not stored in the database yet.
- The demo name and guest modes are not accounts. Anyone can edit browser storage, so they protect nothing.
- There is no authority login, status tracking, or prioritization in this repository.

## Planned later

- A shared database and photo storage with access rules (Row Level Security)
- Authority login and response dashboard
- Maps, images, status tracking, and notifications

