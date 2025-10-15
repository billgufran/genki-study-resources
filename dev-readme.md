# Genki Study Resources Developer README

This document provides a technical overview of the Genki Study Resources application for new developers.

## High-Level Overview

Genki Study Resources is a static web application designed to help students practice Japanese with the Genki textbook series. The application is built with HTML, CSS, and JavaScript, and does not have a backend. All of the exercises and content are stored in HTML files, and the application logic is handled by JavaScript.

## Modern Tooling & Sync Layer

The fork adds installable PWA support, passwordless authentication, and Supabase-backed sync while keeping the legacy JavaScript untouched.

### Toolchain

*   Install dependencies with `pnpm install` (the repo tracks a `pnpm-lock.yaml`).
*   New TypeScript source lives in `src/` and compiles to `resources/javascript/modules/*.js`.
*   Build assets with `pnpm run build` (or `pnpm run build:ts` / `pnpm run build:sw`). The build emits the service worker to `resources/javascript/sw.js` and updates precache manifests via Workbox CLI.
*   Generated files (`resources/javascript/modules/*.js`, `resources/javascript/sw.js`, and source maps) should be rebuilt whenever TypeScript changes are made.

### Runtime Configuration

1. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` with your project values (anon key is safe for the browser when RLS is enabled).
2. Run `pnpm run generate:config` (or `pnpm run build`, which calls it automatically). The script reads `.env` plus any shell environment variables and emits `resources/javascript/config.js`—ignored by git—using the wrapped configuration format expected by the bootstrapper.

In CI/CD, expose the same variables as environment settings, run `pnpm run generate:config`, then execute the rest of your build/deploy pipeline. This keeps the site host-agnostic; no platform-specific features are required.

### Supabase Schema

1. Create a Supabase project, enable email magic links, and invite your own email. Magic links redirect back to `/` by default.
2. Run the SQL below in the Supabase SQL Editor:

```sql
create table if not exists profile_settings (
  user_id uuid primary key references auth.users on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists progress_snapshots (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, key)
);

alter table profile_settings enable row level security;
alter table progress_snapshots enable row level security;

create policy "owner-can-read" on profile_settings
  for select using (auth.uid() = user_id);

create policy "owner-can-upsert" on profile_settings
  for insert with check (auth.uid() = user_id)
  using (auth.uid() = user_id);

create policy "owner-can-read" on progress_snapshots
  for select using (auth.uid() = user_id);

create policy "owner-can-upsert" on progress_snapshots
  for insert with check (auth.uid() = user_id)
  using (auth.uid() = user_id);
```

3. Under **Authentication → Providers → Email**, disable password signups, enable magic links, and (optionally) restrict to your domain/email.

### Auth & Sync Flow

* A loader injected by `head.min.js` fetches `config.js`, loads the Supabase JS SDK, and bootstraps `resources/javascript/modules/bootstrap.js` on every page.
* `bootstrap.js` gates the UI until a Supabase session exists. Unauthenticated visitors are redirected to `/login.html`, which exposes a magic-link form powered by `resources/javascript/modules/login.js`.
* Once authenticated, `syncController` mirrors selected `localStorage` keys up to Supabase (`profile_settings` for preferences, `progress_snapshots` for results/custom content). A 10‑second poll plus `online` events trigger uploads; Workbox Background Sync retries failed Supabase writes while offline.
* Remote snapshots use `updated_at` timestamps for last-writer-wins merges. Local data remains available immediately and is updated after a remote pull if the server version is newer than the last local sync.

### PWA & Offline

* `manifest.webmanifest` and new icons (in `resources/images/icons/`) enable install prompts.
* The service worker (`src/sw.ts` → `resources/javascript/sw.js`) precaches the shell, caches lessons/assets, and queues Supabase mutations with Workbox Background Sync.
* `bootstrap.js` registers the service worker once the user is authenticated (HTTPS or `localhost` only).

### Deployment Checklist

1. Ensure `resources/javascript/config.js` will be generated with real Supabase credentials in your deploy pipeline.
2. Run `pnpm run build` before pushing or deploying so the compiled JS and service worker stay in sync with the TypeScript sources.
3. When rotating Supabase keys, rebuild the project and invalidate old deployments (service workers precache the bundle).
4. After deploying, test:
    * magic-link login
    * offline usage + background sync (toggle devtools → offline, make progress, go back online)
    * multi-device merge (two browsers signed in with the same account)

## Folder Structure

The project is organized into the following main directories:

*   **`/` (root)**: Contains the main `index.html` file, which is the entry point of the application. It also contains other top-level pages like `404.html`, `LICENSE`, and `README.md`.
*   **`/.github`**: Contains GitHub-specific files, such as `FUNDING.yml`.
*   **`/donate`**: Contains the donation page.
*   **`/download`**: Contains the download page.
*   **`/help`**: Contains help pages for various topics.
*   **`/lessons`**: Contains the exercises for the 2nd edition of the Genki textbook. The exercises are organized by lesson and then by exercise type.
*   **`/lessons-3rd`**: Contains the exercises for the 3rd edition of the Genki textbook.
*   **`/privacy`**: Contains the privacy policy.
*   **`/report`**: Contains a page for reporting bugs.
*   **`/resources`**: Contains all of the assets for the application, including:
    *   **`/audio`**: Audio files for the exercises.
    *   **`/css`**: CSS files for styling the application.
    *   **`/fonts`**: Font files.
    *   **`/images`**: Image files.
    *   **`/javascript`**: JavaScript files for the application logic.
    *   **`/notes`**: Notes for the developer.
    *   **`/tools`**: Tools for the developer.

## Application Flow

The application is a single-page application (SPA) in the sense that all of the content is loaded into the main `index.html` file. However, it is not a true SPA, as each exercise is its own HTML file.

The main application flow is as follows:

1.  The user opens the `index.html` file in their browser.
2.  The `index.html` file loads the main CSS and JavaScript files.
3.  The user navigates to a lesson and exercise by clicking on the links on the main page.
4.  The selected exercise's HTML file is loaded into the page.
5.  The JavaScript in `resources/javascript/genki.js` and `resources/javascript/study-tools.js` handles the exercise logic, such as generating questions, checking answers, and providing feedback.

## Core Concepts

The core of the application is the `Genki` object, which is defined in `resources/javascript/genki.js`. This object contains all of the logic for the exercises, including:

*   **`Genki.stats`**: An object that stores the user's statistics, such as the number of problems solved, mistakes made, and score.
*   **`Genki.generateQuiz()`**: A function that generates a quiz based on the data in the exercise's HTML file.
*   **`Genki.check`**: An object that contains functions for checking the user's answers.
*   **`Genki.toggle`**: An object that contains functions for toggling the display of elements, such as furigana and the exercise list.

The application supports several different quiz types, which are defined in the `Genki.QuizType` object. These include:

*   **`drag`**: Drag and drop exercises.
*   **`kana`**: Kana-specific drag and drop exercises.
*   **`writing`**: Writing practice exercises.
*   **`multi`**: Multiple choice exercises.
*   **`fill`**: Fill in the blank exercises.
*   **`stroke`**: Stroke order exercises.
*   **`drawing`**: Drawing practice exercises.

## Styling

The application's styling is handled by the CSS files in the `/resources/css` directory. The main stylesheet is `stylesheet.css`, and there is also a dark theme stylesheet called `stylesheet-dark.css`. The application also uses the Font Awesome library for icons.

## Local Storage

The application uses `localStorage` to store user preferences and progress. The following keys are used:

*   **`feedbackMode`**: The user's preferred feedback mode for multiple choice quizzes (`instant` or `classic`).
*   **`dataBackupReminderCount`**: A counter for displaying the data backup reminder.
*   **`genki_pref_`**: A prefix for storing the user's preferred exercise type for each lesson.
*   **`genkiSkipExType`**: A boolean that determines whether to skip the exercise type selection screen.
*   **`furiganaVisible`**: A boolean that determines whether to show or hide furigana.
*   **`vocabHorizontal`**: A boolean that determines whether to display vocabulary in a horizontal or vertical layout.
*   **`Results`**: An object that stores the user's quiz results.
*   **`timerAutoPause`**: A boolean that determines whether to automatically pause the timer when the user switches to another tab.
*   **`spoilerMode`**: A boolean that determines whether to enable the vocab spoiler for multiple choice quizzes.
*   **`customVocab`**: A string that stores the user's custom vocabulary exercises.
*   **`customSpelling`**: A string that stores the user's custom spelling exercises.
*   **`customQuiz`**: A string that stores the user's custom quizzes.
*   **`customWrittenQuiz`**: A string that stores the user's custom written quizzes.

## Custom Exercises

The application allows users to create their own custom exercises using the "Study Tools" section of the site. The logic for the custom exercises is handled by the `resources/javascript/study-tools.js` file. Custom exercises are stored in `localStorage` using the keys listed above.

## Dependencies

The application has the following external dependencies:

*   **Font Awesome**: For icons.
*   **jQuery**: For some of the JavaScript functionality.
*   **dragula**: For drag and drop functionality.
*   **easytimer.js**: For the timer in the exercises.
