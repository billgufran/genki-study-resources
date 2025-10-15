# Genki Study Resources Developer README

This document provides a technical overview of the Genki Study Resources application for new developers.

## High-Level Overview

Genki Study Resources is a static web application designed to help students practice Japanese with the Genki textbook series. The application is built with HTML, CSS, and JavaScript, and does not have a backend. All of the exercises and content are stored in HTML files, and the application logic is handled by JavaScript.

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
