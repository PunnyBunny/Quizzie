# Quizzie

This project uses Vite + React + TypeScript with Tailwind CSS and React Router.

## Firebase Authentication Setup

Firebase is initialized with a placeholder configuration in `src/lib/firebase.ts`.
Replace the placeholder values with your actual Firebase project settings from the Firebase console (Project settings → General → Your apps):

```
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'your-project-id.firebaseapp.com',
  projectId: 'your-project-id',
  appId: 'YOUR_APP_ID',
}
```

We export:
- `app` — the Firebase app instance
- `auth` — the Firebase Authentication instance

A small UI component `AuthStatus` is included in the header to demonstrate sign-in/out using Anonymous Authentication. You can replace it with your preferred provider flows (Google, email/password, etc.).

### Enabling Anonymous Auth (optional demo)
If you intend to use the demo sign-in, enable Anonymous sign-in in the Firebase console:
- Build → Authentication → Get started → Sign-in method → Anonymous → Enable.

### Environment Variables (optional)
For production, consider moving keys into environment variables and referencing them in `firebase.ts`, e.g. `import.meta.env.VITE_FIREBASE_API_KEY`.

## Scripts
- `npm run dev` — start dev server
- `npm run build` — type-check and build
- `npm run preview` — preview the production build
