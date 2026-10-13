# Changelog

## v-0.1 · 2026-10-10

First local UPM release. The project retains the Git history and MIT license of tiss-registration-bot; original source is preserved in `upstream-tiss/`.

- Local management service, manual login in dedicated Edge, and start, background-start, stop, and restart entry points.
- Course-code or prefix search; all lecture groups with complete schedules; selection of course category, Lab, and polling interval; persistence of one target.
- Separate controls for monitoring and automatic registration. Saving a new target clears automatic mode.
- Serial polling, failure backoff, duplicate-registration protection, and persistent suspension when a submission outcome is unclear.
- Fixes for Search clicks intercepted by a fading popup overlay, premature reading of search results, and CSP blocking the page script.
- Handoff documents and the real management-page acceptance screenshot archived in `docs/`.

Validation: 21 logic/API/adapter-helper tests passed. The real UPM management page completed search LPD, load five LPD2107 groups, save Group 1 EL, monitor availability of zero, and stop. LPD2108 groups were also queried. No course was added or submitted. After validation, monitoring was stopped and automatic mode was disabled, with LPD2107 Group 1 EL retained as the target.

Limitations: one target at a time; targets with a Lab only monitor Lecture availability and do not support automatic registration; registration after a real opening appears remains unvalidated. The simulated browser test still failed when Edge exited in the restricted environment. Last reported full-code line coverage was approximately 69%. A desktop launcher application, tray behavior, and multiple-target scheduling have not been implemented.

The version excludes `node_modules`, `runtime`, cookies, sessions, runtime logs, and the old school-page screenshot containing personal information. Dependencies are pinned by `package-lock.json`. Restoring source does not restore authentication or start the service.

## English documentation branch · 2026-10-13

English counterparts of the six previously listed document artifacts are stored on the local `docs/english-v0.1` branch: README, changelog, handoff Markdown and HTML, discussion/improvement record, and GitHub selection report. An index maps them to their Chinese sources. Chinese originals and application code remain unchanged. The `v-0.1` tag continues to identify the original release.
