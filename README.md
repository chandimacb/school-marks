# School Marks

Term test mark entry, automatic totals, averages and class ranks, for grades 6 to 11.
Runs free on Firebase (Spark plan): Firestore database, Firebase Authentication and Firebase Hosting.

## What Phase 1 includes

- First-run setup: the first person to sign up creates the school and becomes the School Admin.
- School setup (Admin): academic year, three terms (open or locked for entry), one class per grade, Class Teachers,
  pass mark, and the school's subjects (grades 6 to 9: 12 subjects plus one of Dancing, Music or Art;
  grades 10 to 11: 6 core subjects plus one from each of 3 baskets).
- Staff (Admin): add teachers, Section Heads and the Principal. Each new person gets an email to set their own password.
  Logins can be disabled without losing their marks or log entries.
- Students (Admin): paste a list from Excel (admission no, name, gender, grade, index no).
- My class (Class Teacher): assign a teacher to each subject, set each student's aesthetic or basket subjects.
- Mark entry (subject teacher, web or phone): one box per student, Enter moves down, `AB` absent, `MED` medical,
  `EX` exempt. Each mark saves on its own; live subject average, highest, lowest and pass rate.
- Class mark sheet: every subject, total, average and rank (ties share a rank: 1, 2, 2, 4), subject statistics,
  print-friendly A4 landscape layout.
- Security rules: a teacher can only change their own subject in their assigned class while the term is open, for
  students who take that subject. Every change must be saved together with a change-log entry (old value, new value,
  who, when), and the log can never be edited or deleted.

## One-time Firebase setup (about 15 minutes)

1. Go to <https://console.firebase.google.com>, sign in with the school's Google account, **Add project** named
   `school-marks` (Google Analytics not needed).
2. **Build > Authentication > Get started**, then enable **Email/Password**.
3. **Build > Firestore Database > Create database**, choose location **asia-south1 (Mumbai)**, start in
   **production mode**.
4. **Project settings > General > Your apps > Web app (</>)**, nickname `school-marks`, tick nothing else. Copy the
   `apiKey`, `authDomain`, `projectId` and `appId` values into a file named `.env.local` in this folder:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

   These values are public by design; the security rules protect the data.
5. Deploy (needs Node.js 20 or newer):

   ```
   npm install
   npx firebase login
   npx firebase use --add          # pick the school-marks project
   npm run build
   npx firebase deploy --only firestore:rules,hosting
   ```

6. Open the address it prints (for example `https://school-marks.web.app`), choose **First-time school setup**, and
   create the Admin login. Do this straight away: the first person to complete setup becomes Admin.

## Developing and testing

```
npm test             # calculation tests (totals, averages, tied ranks, subject choices)
npm run test:rules   # security rule tests on the Firestore emulator (needs Java)
npm run dev          # with no .env.local, the app talks to local emulators:
                     # npx firebase emulators:start --only auth,firestore
```

## Free plan limits

Firestore Spark: 1 GiB stored, 50,000 reads, 20,000 writes and 20,000 deletes per day. Saving one mark costs 2 writes
(the mark and its log entry). A whole school's term of marks fits easily.
