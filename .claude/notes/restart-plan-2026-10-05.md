# Restart plan — written 2026-10-05

**Where things stand.** The app works for weekly use today (202 tests pass, data validation clean,
production at https://shnayim-mikra.vercel.app serves the latest commit from 2026-09-17). A
nine-agent review on 2026-10-04 found three input bugs in the one-phrase-at-a-time view, a set of
visual differences between that view and the list view, slow transitions, and no handling of a
new yearly cycle. This plan fixes those, then adds Google sign-in with readings saved to
Firestore. Nothing has been built yet and nothing in Firebase has been changed.

**Status on 2026-10-05, later the same day.** Steps 1–4 are built and released as version
1.1.0 (see `CHANGELOG.md`). 310 tests, data/style checks and the
production build pass. Checked by hand in a browser at desktop and phone width: marking with
Space and tap, three fast presses marking only one piece in both views, the new look in both
views, the compact phone header, start-over / undo / restore, shared credit between Matot and
Matot-Masei, picker marks, English and Hebrew interface. Not checked by anyone: how the
transitions feel in motion, reduced-motion mode, a real phone, the installed app, and the
automatic new-cycle archive on a device with real older marks (covered by unit tests only).
Differences from the text below: the interface language stays a setting (English default) and
every label follows it, instead of everything becoming Hebrew; the archive keeps two years per
parsha, and Settings has a permanent "restore archived marks" button, because the Undo notice
disappears on reload; when the day changes while the app is open, the new-cycle archive waits
until the tab is hidden. Still open from Step 3: in English mode some Settings labels show
their colon on the wrong side (right-to-left layout). Steps 5–6 (Firebase) have not been started.

**Firebase round, status on 2026-10-05 (evening).** The owner changed the project choice to
**Torah-io** (`shining-fire-3750`): free plan is enough, readers get their own sign-in list, and
a deploy credential there cannot touch other apps. Where Step 5 and Step 6 below say
mega-project or "the `shnayim` database", read Torah-io and its default database.
- Done in Torah-io: Firestore and Hosting enabled; web app "Shnayim Mikra" registered; the empty
  2018 database (older Datastore mode, US) deleted with the owner's approval and a new default
  database created in native mode in the Europe multi-region (`eur3`, free tier); Hosting site
  `shnayim` created (https://shnayim.web.app — `shnayim-mikra.web.app` belongs to someone
  else's Shnayim Mikra app); sign-in allowed domains include `shnayim.web.app` and
  `shnayim-mikra.vercel.app`; security rules deployed (`firestore.rules`, 13 emulator tests).
- Built on the local branch `firebase-sync`, not committed: on-device sync logic
  (`src/lib/syncMerge.js`, `src/lib/syncStore.js`), the Firebase client
  (`src/lib/firebaseClient.js`, the only file importing Firebase, loaded only when Settings
  opens or the device has signed in before), `src/composables/useSync.js`, an Account section
  in Settings, an "app has moved" notice shown only on the Vercel address, `firebase.json`,
  `.firebaserc`. 382 unit tests pass. Checked in a browser: a signed-out reader loads no
  Firebase code; the Account section appears. Sign-in itself has not been tried by anyone.
- Differences from Step 6 below: each account's archive is also set aside on an account
  switch; "start over" uploads un-marks as ordinary changes instead of overwriting the cloud
  document; the copy of what was last synced carries a counter so a stale download cannot undo
  an upload that finished meanwhile.
- Not done: Google sign-in is not switched on (owner, Firebase console); the address
  `https://shnayim.web.app/__/auth/handler` is not registered on the Google sign-in client
  (owner, Google Cloud console); nothing is deployed to shnayim.web.app; no automatic deploy
  from GitHub to Firebase Hosting; no test on two real devices or an installed iPhone app.
- Order from here: owner's two console steps → deploy this branch to shnayim.web.app → owner
  signs in there and on a second device → merge to `master` as version 1.2.0 (the Vercel
  address then shows the "moved" notice) → later switch Vercel off.
- Found on the way: Torah-io has an old Realtime Database whose rules allow anyone to read and
  write. It is deactivated; do not reactivate it with those rules.

**What you need to do.** Approve each step marked **OWNER APPROVAL** when its turn comes (they
change a live environment), and test Google sign-in on a real iPhone with the app installed —
nobody could verify that from here.

Words used below: the **list view** shows whole pesukim (`ParshaDisplay.vue` + `VerseView.vue`);
its one-pasuk mode shows one pasuk with its three pieces stacked. The **focus view** shows a
single piece (first Hebrew reading, second Hebrew reading, or the translation) and advances on
Space or tap (`FocusMode.vue`). A **piece** is one of those three. A **cycle** is one year of
Torah reading, Bereshit to Vezot Haberachah, named by its Hebrew year (the one starting this week
is 5787).

## Decisions made on 2026-10-04 (by the owner unless noted)

| Decision | Reason | Rejected alternative |
|---|---|---|
| Firebase project: **mega-project** (`mega-project-5786`), new named Firestore database `shnayim` | Owner's choice; matches the existing one-database-per-app layout there. Google sign-in is already enabled in that project. | Torah-io (`shining-fire-3750`): free default database and separate user list, but empty and a second project to run. |
| Hosting: **move to Firebase Hosting**, a new site in mega-project | Sign-in pages are then served from the app's own address automatically, which the installed phone app needs. Cheapest now while few people use the Vercel address. | Stay on Vercel and pass the sign-in pages through with a Vercel rewrite: unverified and only testable on production. |
| New cycle: **automatic archive and clean start, with undo** | A parsha must not open already green a year later. | Prompting first; or a manual reset button only (cloud could not tell years apart). |
| Extras in this round: **first-run Israel/Diaspora question** (with completion marks in the parsha picker) and **shared credit between combined and single parshiyot** | Owner's choice. | Backup export/import and reminders: not this round. |
| Sign-in is opt-in; signed-out and offline use stay exactly as today (my call) | Requirement: people who never log in must lose nothing. | Anonymous accounts for everyone: an account lifecycle with no benefit. |
| Settings (font size, display mode) do not sync at first (my call) | They legitimately differ per device. | Syncing all settings. Open question below for two of them. |

**Safety check done for the mega-project choice.** Anyone who signs in to this app gets a login
token valid across mega-project. I read the deployed rules of its four databases on 2026-10-04:
the three named ones (`beithamikdash`, `exodus`, `genesys`) only trust an `admin` custom claim,
and the default one only lets a user reach `users/{their own id}`. A stranger's token opens
nothing. Not checked: Realtime Database and Cloud Storage rules in that project (no Storage rules
are deployed; Cloud Functions could not be listed and the rules files say there are none).

## Order of work

The app stays usable after every step. Steps 1–4 need no Firebase and can ship to the current
Vercel address.

### Step 1 — Input bugs in the focus view and one-pasuk mode

What the reader sees today, and the fix:

1. **A fast second press marks a piece that was never shown.** The guard against double presses
   ends when the green hold ends, before the old card has slid away. Keep the guard until the new
   card has finished entering, ignore key-repeat (holding Space), and make a leaving card
   unclickable. `advanceStep` and `handleKeydown` in `src/components/FocusMode.vue`.
2. **Pressing an arrow, 1/2/3 or undo right after Space gets overridden** by the pending move.
   Any navigation cancels the pending timer. Same file: `nextVerse`, `previousVerse`,
   `jumpToStep`, `undoLastAction`.
3. **Arrows disagree.** Focus view: left button = previous, left arrow key = next. List view: left
   button = next. Fix: one right-to-left rule everywhere — next on the left, previous on the
   right — for buttons, keys and the help overlay.
4. **One-pasuk mode: double-tapping the translation un-marks it** (the second tap lands on the
   fading card). Leaving cards become unclickable. `handlePhaseClick` in `ParshaDisplay.vue`.
5. **One-pasuk mode: arrow keys keep the old step selected**, so Space can mark the translation
   of the new pasuk first. Route the arrow keys through the same function the on-screen arrows
   use (`stepVerse` in `ParshaDisplay.vue`).
6. **The card jumps to another pasuk when a setting changes or another tab saves.** Re-seed the
   selection only when the current pasuk no longer exists in the new view.
7. **Space/Enter on a focused button marks a reading** instead of pressing the button. The
   list-view key handler skips events whose target is a button.
8. **The new card can open scrolled down** after a long pasuk. Scroll after the new card is
   mounted, not before.
9. **"Show the aliyah" before the aliyah data has loaded shows the whole parsha.** Disable the
   button until loaded.

The decision "may the reader advance / where to" moves out of the `.vue` files into pure
functions next to `src/lib/focusStep.js` and `src/lib/listStep.js`, with tests, because none of
the September logic is tested and bugs 1–2 would have been caught.

### Step 2 — One motion vocabulary for both views

Today each press in the focus view costs about 1.1 s before the next piece is readable (about
5.5 minutes of animation per 100 pesukim), and every move plays the same slide.

- Green appears within 100 ms (colour only), then holds about 180 ms.
- Next piece in the same pasuk: the card stays; label and text crossfade in 150 ms.
- New pasuk: old card leaves 48 px toward the right in 120 ms, new one enters from the left in
  200 ms (Hebrew reading order). Going back is the mirror image. In aliyah-by-aliyah order, the
  jump back to the top of the aliyah uses the backward motion so it does not look like a step
  forward.
- New aliyah: same motion plus a brief colour emphasis on the aliyah label.
- Header, footer, Rashi/English blocks and scroll position change when the new card enters, not
  before.
- One-pasuk mode in the list view uses the same hold and the same pasuk motion; the corner check
  that marks a whole pasuk gets the same hold so the green is visible.
- `prefers-reduced-motion`: no movement, no pulsing pointer, crossfade of 100 ms at most.
- Target: about half a second per piece.

Reason for direction-aware motion over the current single slide: backward, same-pasuk and
new-pasuk moves are different events and currently look identical.

### Step 3 — One visual language

There are no shared style variables today; every colour and size is written out in each
component. Add one set in `src/style.css` and use it in both views:

- Sizes: Hebrew 1.5em, translation 1.15em (one ratio in both views; pasuk stays larger than
  translation as required), shared line heights.
- Colours: text, secondary text (translation becomes the darker grey in both — the current list
  grey is borderline for contrast), borders, page background, read (green), pointer (gold),
  in-scope aliyah (blue), keyboard selection (purple).
- Card: the focus card gets the same 2px grey border and radius as a piece box in the list view;
  read state stays 3px green in both.
- Labels: aliyah / perek / pasuk in the Hebrew font at the same sizes in both headers; focus-view
  header buttons take the light bordered look of the list view.
- The focus view gains the two cues it lacks: the gold "you are here" marker and the blue "in the
  selected aliyah" marker.
- Rashi/English reference blocks get one treatment in both views.
- Bug: when Rashi or English is the counted translation, a read box in the list view shows a thin
  grey top edge instead of green (`.rashi` / `.english` rules in `VerseView.vue` override the
  box border).
- Interface labels become one language (Hebrew, matching the majority of existing labels).
- Phone: the list-view header takes nearly half the screen; collapse the title/progress block so
  all three pieces of a short pasuk fit without scrolling.

Deliberately kept different so the focus view reads as its own mode: full-screen layout, one
centered card with generous padding, step dots, side buttons.

This step changes looks, which the project rule "do not restyle components unasked" normally
forbids; the owner asked for it on 2026-10-04. The style checker rules (no `!important`, no
strike-through, no opacity on text) still apply. Dark mode is not in scope; the shared variables
make it possible later.

### Step 4 — New cycle, combined-parsha credit, first-run location

**New cycle.** Stored progress has no year, so a parsha read last year opens green.
- New stored keys next to the guarded `shnayim-progress` (whose shape does not change; approved
  2026-10-04): `shnayim-cycles` = `{ route: hebrewYear }` and `shnayim-progress-archive` (the
  previous cycle's marks, kept for undo).
- A pure function `cycleOf(route, date, israel)` in a new `src/lib/cycle.js`: the cycle begins the
  day after Simchat Torah for every parsha, except that Vezot Haberachah keeps belonging to the
  ending cycle through the catch-up days the app already allows (Sunday–Tuesday).
- At app start and when the day changes, every parsha whose stored year is older than
  `cycleOf` is moved to the archive and cleared — all parshiyot, not only the open one, because
  the weekly default and the daily guide read parshiyot that were never opened.
- The move must survive a tab closing halfway, since it touches three keys: archive entries are
  keyed by parsha and year; the order is archive → clear → update the year label; an empty parsha
  is never archived, so a restart cannot overwrite a real archive entry with an empty one.
- A visible "start this parsha over" button (the function `clearParshaProgress` already exists in
  `useProgress.js` with no caller) and an undo that restores from the archive.
- Upgrade rule, fixed in the release rather than computed from the device's clock (two devices
  upgrading on different dates must label the same old marks the same way): marks that exist
  before this ships are labelled 5787 only for parshiyot whose 5787 week has begun by the release
  date (Bereshit, if this ships this week); all others are labelled 5786, which moves them to the
  archive on first run. Nothing is deleted and undo restores them. Bereshit marks left from
  October 2025 cannot be told apart from this week's; the "start over" button covers that.
  Rejected: labelling everything as the current cycle — September 2026 marks would then show
  green in September 2027. Also rejected: a year level inside `shnayim-progress` (breaks the
  guarded contract and every reader of it).

**Combined and single parshiyot share credit.** Verse keys are absolute chapter:verse, so Matot's
verses have the same keys under `matot` and `matot-masei`. Every mark or un-mark is written to
all routes that contain that verse, with a one-time fill-in of existing marks. "Start this parsha
over" clears the same verses in the overlapping routes too, otherwise the fill-in would bring
them straight back. Rejected: combining
at read time — un-marking cannot work when the other route still says "read", and every reader of
progress would change.

**First run.** Ask Israel or Diaspora once instead of silently defaulting to Israel; show
finished / partly-read marks next to each parsha in the picker.

### Step 5 — Firebase setup and hosting move — **OWNER APPROVAL for each item**

1. Register a web app "Shnayim Mikra" in mega-project (produces the public config).
2. Create the Firestore database `shnayim` in location `nam5` (same as the other three named
   databases; permanent). Named databases have no free tier; expected cost is cents per month.
3. Create a Hosting site in mega-project (for example `shnayim-mikra`, giving
   `shnayim-mikra.web.app` if the name is free). The project's default site is left alone.
4. Add the new address to the sign-in authorized domains, and its `/__/auth/handler` path to the
   Google sign-in client's redirect addresses. Check that the Google consent screen is published
   (not "Testing") and shows an acceptable app name.
5. Add `firebase.json` + `firestore.rules` to the repo, scoped to the `shnayim` database and the
   new site only, so no deploy from this repo can touch the other apps. Deploy the rules.
6. Deploy the site; change the GitHub workflow to deploy to Firebase Hosting after the existing
   checks pass on master. This needs a deploy credential stored as a GitHub secret. Limit it to
   the Hosting role and have the workflow deploy only this one site. Firestore rules are deployed
   by hand, never by the workflow. Remaining risk of the shared project: that credential could
   still publish to mega-project's other Hosting site; a Hosting role cannot be narrowed to one
   site.
7. Old address: add `shnayim-mikra.vercel.app` to the authorized domains for a transition
   period. Anyone with marks there signs in once on the old address (popup sign-in works there),
   then signs in on the new one, and their marks follow — no transfer code needed. During the
   transition both addresses serve the same build, and the build shows a "the app has moved"
   notice with that instruction when it runs on the old address. A plain redirect is not enough:
   an installed copy of the old address is served from its offline cache and never sees a
   redirect, and an installed app cannot be moved to a new address — it has to be installed
   again from the new one. Vercel is switched off only after that notice has been live a while.

In the service-worker config (`pwaOptions` in `vite.config.js`), paths under `/__/` must be
excluded from the offline fallback, or the sign-in page is answered with the app's own page.

### Step 6 — Sign-in and sync

**Sign-in.** A row in Settings: "Sign in with Google" / signed-in name / sync status / sign out.
Popup in browsers; redirect when running as an installed app, with popup as fallback and the
reverse. The Firebase code is a separate download fetched when Settings opens or when the device
has signed in before, so it never runs for signed-out readers — and the popup opens directly
from the click with nothing awaited first (otherwise Safari blocks it). The file stays in the
normal offline cache (a few hundred kB next to 2.9 MB of Torah text already cached), so a
signed-in reader keeps working offline. Rejected: excluding it from the offline cache — three
extra config pieces, and a signed-in reader who goes offline right after an app update could no
longer sync.

**Where data lives.**
- On the device: `localStorage['shnayim-progress']` stays the store that the whole app reads.
  Firestore's own offline cache is not used. Rejected: Firestore's persistent cache as the local
  store — a second local copy competing with the one that already works and is guarded by tests.
- In the cloud: `users/{uid}/years/{hebrewYear}/parshiyot/{route}` =
  `{ verses: { "perek:pasuk": { hebrew1, hebrew2, targum } }, updatedAt }`. The year in the path
  means a device that has not rolled over yet can never write last year's marks into this year,
  and old years stay as a natural archive. The year for each parsha comes from `cycleOf`, so
  during the Vezot Haberachah catch-up days two year folders are read.
- Only the 54 single parshiyot have cloud documents. Combined parshiyot (Matot-Masei and the
  like) exist only on the device, filled from the two singles. Reason: with a document for both,
  the two could disagree about the same pasuk and download order would pick the winner. The
  largest single parsha (Naso, 176 pesukim) is under 10 kB.

**Merge rule.** The device keeps a copy of what it last synced (`shnayim-sync-base`). For every
piece: if the local value differs from that copy, the local value wins and is uploaded; otherwise
the cloud value is taken. An upload writes only the changed pieces into the document, never the
whole document, so two devices uploading different pesukim at the same moment cannot erase each
other; the synced copy moves forward only after the server confirms. Consequences: un-marking travels to other devices; two devices that
changed different pieces offline both keep their changes; if both changed the same piece offline
the later upload wins. Rejected: (a) OR-ing booleans — an un-mark comes back on the next
download; (b) a recorded list of pending changes — the review found three ways it loses marks
(un-mark during an upload, tab closed between two writes, marks made before sign-in state is
known); (c) per-piece timestamps — bigger documents and dependence on device clocks.

**Details that came out of the adversarial review.**
- Local marks carry an owner: none (made while never signed in) or an account id.
  - Signing in with unowned marks: OR them with that account's cloud marks so nobody loses
    reading, upload, and the marks now belong to that account.
  - Signing in as a different account than the owner: the owner's local marks are set aside
    under their id and the device shows the new account's cloud marks. They are never mixed and
    never uploaded to the other account. The first owner gets them back, merged normally, on
    their next sign-in.
  - Signing back in as the same account: the normal merge rule, so un-marks made while signed
    out survive.
- Known and accepted: if one device marks a piece and another device, offline, marks and then
  un-marks the same piece, the piece ends up read. The second device made no net change, so the
  first device's reading stands.
- Uploads: one write per parsha touched, at most every 30 s while reading, plus when the page is
  hidden and when the connection returns. Progress is flushed to local storage first and the
  upload is built from memory, so it can never send stale values.
- Downloads: all of the current year's documents on sign-in; afterwards only documents changed
  since the last download minus one minute (re-applying is harmless), using server time only.
- "Start this parsha over" is the one case that overwrites a whole cloud document (with empty
  marks); documents are never deleted, because other devices cannot see a deletion.
- Sign-out keeps local marks (clearing would lose reading on a shared device) and warns if some
  are not uploaded yet.

**Rules** (`firestore.rules`, deployed to the `shnayim` database only):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/years/{year}/parshiyot/{route} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['verses', 'updatedAt'])
        && request.resource.data.verses is map
        && request.resource.data.verses.size() <= 300
        && request.resource.data.updatedAt == request.time;
      allow delete: if false;
    }
  }
}
```

**New files.** `src/lib/syncMerge.js` (pure merge, tested in node), `src/lib/firebaseClient.js`
(the only file importing Firebase; uses the lightweight Firestore client since the app does its
own offline handling), `src/composables/useSync.js` (status and wiring), an account row in
`SettingsModal.vue`, and a small hook in `useProgress.js` to apply a downloaded map through the
same path that already applies another tab's changes.

**Tests.** Existing `tests/progress-compat.test.js` passes unchanged. New: merge scenarios (first
sign-in, two devices offline, two devices uploading at once, un-mark travels, un-mark during an
upload, cleared parsha stays cleared in overlapping routes, account switch and switch back,
device still on last year, cycle move interrupted halfway), cycle sweep over 5786–5795 for Israel and
Diaspora, service-worker config assertions. Rules tests with the Firebase emulator run by hand
before each rules deploy (they need Java, so not in CI).

**Privacy.** The cloud stores the reader's Google account (name, email) and which pesukim they
marked. One line in Settings says so.

## How this plan was checked

Nine agents on 2026-10-04 (requirements against the October 2025 conversations, visual
comparison, transitions, review of the five September commits, competitor survey, Firebase
research, a sync design, and two adversarial critiques of that design), then a GPT-5.6 review of
this document on 2026-10-05, which had the plan text only, not the code. Its findings are folded
in above: changed-pieces-only uploads, ownership of local marks, the fixed upgrade rule, the
interruption-safe cycle move, clearing across overlapping parshiyot, cloud documents for single
parshiyot only, the installed-app transition, and the deploy credential limits. One finding was
not adopted (the mark-then-un-mark case listed as accepted in Step 6).

## Open questions

| Question | What is blocked on it |
|---|---|
| Does Google sign-in return correctly into the installed app on an iPhone? | Nothing until Step 6; decides whether installed-app sign-in uses redirect or popup. Needs your phone. |
| Sync the two settings that affect what counts — which translation counts, and Israel/Diaspora? | Nothing; default is no. |
| Is a shared family device with several Google accounts a real case? | Nothing; the plan handles it either way, this only sets how much testing it gets. |
| Site name and whether you own a domain to use instead of `*.web.app` | Step 5 item 3. Changing the address later strands local marks of signed-out readers again. |

## Left out of this round

Backup export/import, reminders, a "week complete" screen, print layout, extra commentators from
`data-v2/`, dark mode, the Settings option "By Parsha" that currently does nothing (remove or
build — not decided), silent failure of settings saves, and the trope-audio idea from the
competitor survey.

## What others do (survey 2026-10-04, from store pages and search results only)

Two iOS-only trackers: "Shnayim Mikra" by Aaron Turkel (free, Apple Watch, per-aliyah or
per-verse tracking, reminders) and "Shnayim: Mikra & Targum" by Natanel Niazoff (free; $2.99 a
month for reminders and iCloud sync). Shnayim Yomi is a daily video program with no tracking. No
Android app, no web app, and no one-piece-at-a-time mode was found — "none found", since
Sefaria, AlHaTorah and the Play Store were not opened directly. This app already has what both
trackers center on (a remembered place, per-aliyah progress, Israel/Diaspora schedules, offline);
free cross-device sync and the focus view are where it goes further.

## Commands

```
npm run dev        # local dev server
npm test           # unit tests (202 passing on 2026-10-04)
npm run validate   # data alignment + style rules
npm run build      # regenerates aliyah boundaries, validates, builds
firebase firestore:databases:list --project mega-project-5786   # read-only: list databases
```
