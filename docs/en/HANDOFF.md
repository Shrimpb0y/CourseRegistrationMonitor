# UPM Local Course Monitor — Handoff

Version 1.3 · Source date: 2026-10-10 · Time zone: Asia/Singapore · English edition: 2026-10-13

This document hands over the observed UPM e-SMP workflow and requirements for local monitoring. A tiss-derived project has been deployed with a new UPM adapter and a local course/group selector. The revised adapter and real management page passed the complete read-only sequence: search, load groups, save a target, start monitoring, read availability, and stop. Adding a course, final registration, and successful-registration verification have not passed real submission validation. No course was submitted in this acceptance run, and monitoring was stopped afterward.

## 1. Default target and recorded status

| Item | Confirmed observation |
| --- | --- |
| Official website | https://smp.upm.edu.my |
| Course code | LPD2107 |
| Course name | GENERAL GERMAN LANGUAGE I |
| Lecture Group | 1 |
| Complete schedule | Monday 10:00–12:00 and Wednesday at 09:00; the query did not provide Wednesday's end time |
| School time code | I10-12,R09 |
| Venue | BK03 KAA |
| Lab | Query returned NO RECORD |
| Requested category | Free Elective, corresponding to ELECTIVE COURSE (EL) in e-SMP |
| Capacity at query time | QUOTA = 29 |
| Registered at query time | NO. OF STUDENT REGISTERED = 29 |
| Availability at query time | NO. OF QUOTA AVAILABLE = 0; AVAILABLE = 0 |
| Delivery scope | Local course/group selection and monitor-only workflow validated against the real site; automatic registration still requires validation |

These availability values are snapshots from 2026-10-10, not a continuously updated status. LPD2107 Group 1 is the default. The revised management page can search courses, load the complete schedule for each group, and save a target. It monitors one target at a time; multiple-target scheduling is future work. A real `LPD` query returned LPD2107 and LPD2108, with five and one lecture groups respectively. Matching requires the course, group, and complete schedule together.

### Course-category setting

The user clarified that FE means Free Elective and has the same intended meaning as the system's EL. Select ELECTIVE COURSE, whose option value is `EL`. Other observed options in the registration dialog were COMPULSORY COURSE (`YW`), AUDIT COURSE (`AU`), and COMPULSORY AUDIT COURSE (`AW`).

The target category is confirmed as `EL`; it is no longer an unresolved condition. The automatic flow must explicitly select it and verify the category in the registered list after success. The terminology clarification does not change the validation status: adding, submitting, and checking a real successful registration remain untested.

## 2. Verified page workflow

### Enter course registration

After the user manually signed in in the Codex in-app browser, the student page was read successfully. Its main route is `/smp/action/main/indexSmpStdSetup`. The `topFrame` and `contentFrame` frames contain top navigation and business content respectively.

Menu → MyRegister opens `/smp/action/portal/student/myregistra/courseRegistraSetup`. That page exposes pending registrations, registered courses, and LECTURE/LAB SCHEDULE.

### Query a course and its selectable times

1. In COURSE REGISTRATION, click SELECT OTHER COURSE.
2. In List of Courses, select ALL FACULTIES and ALL DEPARTMENT. Changing the faculty asynchronously rebuilds the department control; wait for options and the course list to load.
3. Search by COURSE CODE for LPD2107 and confirm GENERAL GERMAN LANGUAGE I.
4. Selecting the course row expands the category and Lecture Time controls. The observed target text was `ISNIN(10.00-12.00TGH),RABU(9.00PG)`, with value `I10-12,R09`.
5. During this inspection, the row was deselected and the dialog closed. Neither OK to add the course nor REGISTER COURSE(S) was clicked. The pending list remained NO RECORD.

The search control is `popupFilter-box`, and results update asynchronously. Use actual keyboard input or a validated filter interaction and wait for the target row to stabilize. Do not read the previous list immediately after input. Enter must not be assumed to submit a search: it closed the popup during the inspection.

### Query lecture-group availability

1. From MyRegister, open LECTURE/LAB SCHEDULE.
2. The Course Code field `txtCC1` is read-only; use the adjacent course-selection icon.
3. Search for LPD2107 in the course popup and click the row's selection icon to set the query condition.
4. Click Search and read the Lecture schedule table.
5. Identify LPD2107, Lecture Group 1, and both time slots I10-12 and R09.
6. Read QUOTA, NO. OF STUDENT REGISTERED, NO. OF QUOTA AVAILABLE, and AVAILABLE. The observed values were 29, 29, 0, and 0.

The schedule page directly provides group and availability data, making it suitable for monitoring. Repeated attempts to add a course are not a substitute for querying. Appearance in the course directory does not establish that a seat is available.

### Registration instructions observed on the page

The page explains that selected courses may be temporarily reserved while quota remains. REGISTER COURSE(S) must be used within ten minutes; otherwise the pending courses are removed and their quota reopens. This instruction was read, but the temporary-reservation and final-submission behavior was not exercised.

## 3. Local execution design

The initial implementation has a local Node.js background process and management page, with current Puppeteer Core driving the installed Edge. The user manually signs in to a separate local browser session, and the program queries availability. When automatic registration is enabled, the code attempts adding, submitting, and verification under the confirmed target conditions. It does not read or copy login data from the user's existing Edge or Codex in-app browser.

The management service binds to loopback, such as `127.0.0.1`. Course configuration, browser profile, state, and logs remain local. Desktop notifications are implemented through the management page; local sound was described as a desired behavior and is not claimed as a validated feature here. Login, query, and registration requests still go to the official UPM website. The design excludes cloud databases, remote logging, analytics telemetry, and third-party messaging.

The original plan recommended validating browser automation first, then considering direct requests only after confirming interfaces, sessions, and parameters. The later implementation verified a same-origin read-only course-directory request. This does not establish a verified direct seat-availability or registration API; observed routes alone are not proof of either interface.

### Suggested polling policy

Start with a configurable 30-second interval. This is an engineering recommendation, not a polling frequency published by the school. Requests run serially; a new round must not start until the previous round finishes. Network errors, access restrictions, and server failures should increase the interval rather than produce rapid retries.

Expired authentication should produce a login-required state and a local reminder. Revalidate the target course and group after login is restored. Startup at boot is a proposed enhancement, not a delivered automatic-start feature, and must not assume that a session remains valid. The computer must remain powered, connected, and awake. A locked desktop can permit background execution, but this differs from sleep and needs environment-specific validation.

### Monitoring states and actions

| State | Interpretation and next action |
| --- | --- |
| Waiting for login | Login page or unusable business query; request manual login |
| Configuration check | Confirm course, group, complete time, and EL category match the target |
| Monitoring | Match the target group exactly and read this round's availability |
| Seat detected | Positive availability; re-check the query and registration conditions |
| Adding | Prevent duplicate work and confirm category, full schedule, and group |
| Registering | Complete final registration within the temporary-reservation window without duplicate submission |
| Outcome unclear | A submission times out or feedback is ambiguous; inspect the registered list first |
| Success | Registered list confirms the target course and group; stop the target and notify locally |
| Manual intervention | Conflict, unclear category, unmet quota condition, or an unrecoverable exception |

The availability page contains two distinct fields whose semantic difference has not been fully confirmed. Do not replace them with capacity minus registrations. The initial implementation requires both fields to be positive before automatic registration. If they disagree, it does not submit and the eligibility condition needs review.

## 4. Automatic-registration steps still requiring validation

These are implementation requirements, not completed live submission results.

1. Check that the configured category is `EL`, corresponding to ELECTIVE COURSE.
2. When a seat is eligible, open LPD2107 and select EL and the full I10-12,R09 combination.
3. Confirm the resulting Lecture Group is 1 and check the full schedule and eligibility restrictions.
4. Confirm the pending list contains only the intended course and correct group; identify the remaining reservation time.
5. Click REGISTER COURSE(S) and record the result. If unclear, verify first instead of submitting again.
6. Confirm LPD2107, Group 1, schedule, and category in LIST OF COURSES REGISTERED; inspect the registration slip if needed.
7. Stop the task after success. On failure, record the reason and reassess. Do not choose another group or drop existing courses automatically.

Other courses were already registered when the page was inspected. Automation must handle only the explicitly selected target. Existing pending items must block a potentially unintended batch submission. The final registration button may submit the entire pending list, so its scope must be checked first.

## 5. Configuration and data requirements

| Setting or design requirement | Recommended value/behavior |
| --- | --- |
| target.courseCode | LPD2107; another course code may be selected |
| target.lectureGroup | 1; another loaded group may be selected |
| target.lectureTime | I10-12,R09; must match the selected group's complete schedule |
| target.category | EL: Free Elective / ELECTIVE COURSE |
| target.labGroup | Empty for the initial target; automatic Lab registration is not adapted |
| pollIntervalSeconds | 30 initially |
| run_mode | Validate monitoring first; enable automatic registration only as a separate operation |
| notification | Local desktop notifications; sound is a proposal |
| on_session_expired | Notify the user to log in manually; the implementation retries with backoff |
| on_success | Stop the target and retain a local result |

The final four entries describe behavior requirements rather than literal additional keys in `config.json`. The target is stored locally in `config.json`. Prefer searching courses, loading groups, selecting category and schedule, and saving through the management page. Stop monitoring and wait for the current query before changing the target. A new saved target clears automatic mode. If Lab groups exist, one must be selected; the current version monitors only Lecture availability for such targets and does not register them automatically. Profiles and cookies remain local and are not included in reports or ordinary logs. See the English README for start, restart, and stop instructions.

## 6. Software acceptance criteria

| Criterion | Passing condition |
| --- | --- |
| Availability reading | Program matches manual inspection of the target group; zero availability does not add a course |
| Exact matching | For the default target, only LPD2107 Group 1 and I10-12,R09 are accepted, not another group with a similar Monday slot |
| Course category | Explicit EL selection and matching registered category after submission |
| Session recovery | Detect expired login, notify locally, and recover after manual login |
| Asynchronous loading | Wait for new results rather than reading old data or unloaded controls |
| Final registration | When a real opening appears and the user still wants the course, complete one registration and verify it in the registered list |
| Duplicate protection | Stop after success; verify an unclear submission before retrying; do not duplicate after restart |
| Local execution | All runtime storage local; no third-party messaging or remote log integration |
| Failure handling | Back off on network/site errors; never report an unconfirmed result as success |
| Task scope | No automatic dropping, alternative-group selection, or submission of unrelated pending courses |

The software includes dependencies, the UPM adapter, management page, configuration, start/restart/stop scripts, README, and tests. Twenty-one logic/API/adapter-helper tests passed. Last reported full-code line coverage was approximately 69%, below the 80% target. The simulated browser test still failed when Edge exited in the restricted environment.

At 17:52 on 2026-10-10 (Asia/Singapore), the real management-page sequence passed: search LPD, load five groups, save LPD2107 Group 1 EL, read zero availability in monitor-only mode, and stop. The final query was at 17:52:44 with no error and automatic mode disabled. See [the acceptance screenshot](../UPM课程选择验收.jpg). Live automatic registration remains unvalidated. Service availability and active monitoring are separate states and must be read separately in the management page.

## 7. Page evidence and project references

The main evidence is the user-authorized authenticated e-SMP page: MyRegister, the course popup, and LECTURE/LAB SCHEDULE results. Observations were collected on 2026-10-10. This report contains no password, cookie, student ID, or personal name.

[tiss-registration-bot](https://github.com/estallio/tiss-registration-bot) is the upstream project, downloaded at `6dbd4dcba8a6f9603ba14b55a67f2719a463b7f5`. Its original source is in `upstream-tiss`, retaining the MIT license. The UPM page adapter is new code. The upstream TU Vienna login and JavaScript-blocking logic are not used for UPM.

[CourseGrab](https://github.com/LingRuo-BIT/CourseGrab) was previously researched as a reference for task queues, notifications, and success verification. It serves Beijing Institute of Technology; the source report notes its author's limited review/testing statement and does not claim UPM compatibility.

Official entry: [UPM e-SMP](https://smp.upm.edu.my). Routes, controls, and availability rules can change, so the adapter must validate the current structure during operation.
