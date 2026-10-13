# UPM Course Monitor: Discussion and Improvement Record

Source record: 2026-10-10 · Time zone: Asia/Singapore · English edition: 2026-10-13

This is a continuing, chronological discussion record. Suggestions are not automatically approved implementation requirements. Earlier statements about missing features describe their status at that stage; later implementation and acceptance entries supersede them. Historical runtime snapshots do not establish current status.

## Confirmed requirements

- Deploy on the user's local Windows computer and monitor continuously without cloud databases or uploads of accounts, sessions, or runtime records.
- Use estallio/tiss-registration-bot as the original reference, with a new UPM e-SMP adapter and the installed Edge.
- Website: https://smp.upm.edu.my. The user signs in manually in a dedicated Edge profile.
- Initial target: LPD2107, Lecture Group 1, time code I10-12,R09: Monday 10:00–12:00 and Wednesday at 09:00.
- FE means Free Elective and corresponds to ELECTIVE COURSE (`EL`) in the system.
- Support changing courses and groups. At the initial discussion stage, `config.json` held one target; a visual selector and multiple-target scheduling were not yet implemented. The selector was subsequently implemented, as recorded below; multiple-target scheduling remains future work.
- Control monitor-only and automatic-registration modes separately. Adding and submitting require an exact target match; an unclear result pauses the task for verification.

## Problems diagnosed and fixed during the initial round

1. Opening a `.cmd` file in chat showed a source preview instead of executing it. A complete PowerShell command for Windows Run was provided as an executable entry point.
2. Startup originally relied on an old process record to decide whether the service was running. It now checks `/health`, defaults to an open foreground console, and offers a separate background launcher.
3. Monitoring reported `Waiting failed: 15000ms exceeded`. Reproduction showed that the course popup hid its input before the Facebox overlay finished fading. The Search click hit the overlay, so no schedule query was sent.
4. The click logic was changed to scroll the button into view and wait until its center hit the button or one of its descendants. A real read-only query then succeeded; 17 core/API/overlay regression tests passed at that stage.
5. No course was added or submitted during that verification. Successful read-only querying is not proof of successful automatic registration when an opening appears.

## Runtime snapshot recorded at that stage

The recorded `runtime/state.json` showed a successful query at 2026-10-10 17:14:17 (UTC source timestamp `09:14:17.876Z`): LPD2107 Group 1, capacity 29, registered 29, availability 0. Monitoring stopped at 17:14:18; the saved status was stopped and `error` was null.

The saved `autoEnroll=true` value was only a mode flag. With `running=false`, it did not mean that automatic registration was active. These historical values were superseded by later runs.

## Proposed improvements awaiting discussion

| Suggested order | Improvement | Problem to address | Status at proposal time |
| --- | --- | --- | --- |
| 1 | Status and diagnostics | Separately show service availability, browser connection, valid authentication, current query step, latest attempt/success, and next retry; identify the failing step | Suggested, awaiting confirmation |
| 2 | Startup/restart experience | Unified entry point, verified shutdown of the previous service, restart when stopped, explicit startup errors | Suggested, awaiting confirmation |
| 3 | Query stability | Handle navigation, popup closure, asynchronous results, and expired login separately; report timeout steps instead of only a generic 15-second timeout | Suggested, awaiting confirmation |
| 4 | Course/group selection in the page | Read courses, groups, and full times from the school and save them through the local UI instead of hand-editing JSON | Direction confirmed; interaction/scope to discuss |
| 5 | Local reminders | Decide whether reminders must work after the management page closes; keep channels local | Suggested, awaiting confirmation |
| 6 | Multiple targets and priorities | Clarify any-group versus specific-group selection, priorities, timetable conflicts, and which tasks stop after success | Suggested, awaiting confirmation |
| 7 | Automatic-registration acceptance | Check pending-item protection, EL, exact target matching, and success verification, then validate the full flow; do not substitute simulation for live evidence | Awaiting acceptance |

## Next discussion round

### Explicit new user requirements

1. **Reuse and target selection:** the program must not serve only a preset course. Add course, group, and corresponding time selection to the UI. These must be linked and saved as a reusable target. At this point, editable configuration alone did not meet the requested experience.
2. **Launcher and integrated automation UI:** provide convenient local startup and one management interface to reduce command execution, JSON editing, and fragmented operations. Installation format, tray behavior, and background lifecycle were still to be selected.
3. **Work order for that round:** first record requirements, then search GitHub, compare candidates and adaptation options, and report findings. That research round was not authorized to replace the framework or implement the new features immediately.
4. **Continuing constraints:** local operation; no account/session/log uploads; manual UPM login. A general UI or desktop framework does not supply UPM integration, so custom development scope must be explicit.

### GitHub research conclusions

- Public documentation was checked; the comparison is in [GITHUB-SELECTION-REPORT.md](GITHUB-SELECTION-REPORT.md).
- Proposed combination, not yet selected by the user at that research stage: retain the UPM adapter, use electron-react-boilerplate as the desktop base, optionally add shadcn/ui, and implement the UPM directory/group/full-time selector ourselves.
- UCAS-Desktop was the closest reference for integrated launcher/tray/course-management experience; fetch_lecture was a reference for list selection and task logs; Tauri was an alternative desktop shell.
- No ready-made UPM-compatible product was found in that search. Candidate programs were not downloaded or run. Framework fit and development effort were engineering judgments, not completed implementation/testing.
- That round delivered research and reporting only; the two new features were not implemented during it.

### Subsequent implementation authorization and progress

- The user confirmed the desired end experience and authorized course search, group loading, selection, saving, and monitoring first. A desktop launcher application was deferred to a later phase.
- The local page gained code/prefix search, course results, group/full-time/availability display, Lab selection, category and polling interval, target saving, and separate monitoring or confirmed automatic mode.
- APIs restrict targets to courses/groups loaded from the school. Selection is blocked during monitoring; saving clears previous query state and automatic mode. Lab automatic registration remains unsupported, with explicit UI and API restrictions.
- Twenty-one logic/API tests passed. The simulated browser test still failed when Edge exited in the tool environment. At that stage, the new live flow awaited login in dedicated Edge; later acceptance is recorded below.
- The user reported a console disappearing after Windows Run. An explicit `exit` in the launcher could terminate PowerShell; it was replaced with `return`, startup transcripts were added at `runtime/launcher.log`, and a two-step PowerShell diagnostic procedure was supplied. Logs did not establish every cause of that particular disappearance.

### Live acceptance after dedicated Edge login

- Real `LPD` search returned LPD2107 and LPD2108. The revised adapter loaded all five and one Lecture Groups respectively. LPD2107 Group 1 had I10-12,R09, both availability fields zero, and no Lab.
- LPD2108 Group 1 had AVAILABLE = 1 but NO. OF QUOTA AVAILABLE = 0, so it was not eligible for automatic registration. No course was added or submitted in these queries.
- Premature search reads were diagnosed: the school checks the input every two seconds, after the old network-idle wait could finish. The adapter now waits for a same-origin read-only directory response; real querying succeeded.
- Management-page CSP was fixed to allow external `app.js`; all 21 logic/API/helper tests passed again. A unified restart entry point uses the local shutdown API, waits for port release, and starts new code without forcibly terminating unrelated processes.
- The user restarted the service and logged in again. At 17:52 on 2026-10-10 (Asia/Singapore), the real page completed search LPD, load five LPD2107 groups, choose Group 1, save EL, start monitor-only mode, query successfully, and stop. The final query was at 17:52:44: capacity 29, registered 29, both availability fields zero, no error.
- At the end of acceptance, the service remained running but monitoring was stopped and automatic mode was disabled. The saved target was LPD2107 Group 1 EL, I10-12,R09. The screenshot is [UPM课程选择验收.jpg](../UPM课程选择验收.jpg). Live automatic registration still needs acceptance after an eligible opening appears.

Course/group selection was authorized and delivered. The desktop launcher application, tray behavior, and multiple-target scheduling remain later phases. These records are historical evidence and do not state that the program is running now.
