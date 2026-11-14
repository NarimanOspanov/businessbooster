# Бриф: интерактивная лаборатория «Луча» для одной темы

You build ONE interactive lesson page ("лаборатория") for the Russian-language school learning site «Луч» in the repo `C:\Users\nariman_ospanov\Downloads\bbooster` (static files served from repo root by `server.js`; a directory resolves to `index.html`). Your topic (subject, title, grade, branch, subtopics, prerequisites) is given in your task message.

## Where
Create exactly one file: `C:\Users\nariman_ospanov\Downloads\bbooster\labs\<subject>-<topicId>\index.html` (single file, inline CSS/JS). Do NOT edit any other file. Do NOT commit or push.

## Templates — read before writing
- `chemistry\index.html` — the best example of a 2D SVG lab stage in the house style (read fully).
- `mechanics\index.html` — the original lab shell with three.js (skim for structure).
Reuse the same shell exactly: dark theme tokens, fonts (Unbounded, Golos Text, IBM Plex Mono via Google Fonts), header with brand + nav, lesson strip, tabs Обзор / Детали / Схема / Расчёты (Обзор is default), task box + readout box on the stage, toasts, saved progress in localStorage (key `luch-<subject>-<topicId>`), progress pill.

## Lessons
- One lesson per subtopic, in the given order (3–6 lessons). Lesson titles may be phrased more vividly but must match the subtopic.
- Each lesson is an interactive experiment/manipulation on the stage (drag, sliders, buttons, toggles) that makes the idea visible — not a text page. Pick a concrete, correct model (simulation, construction, sorting game, virtual instrument, data plot…).
- Each lesson object has: `id`, `title`, `text` (array of 2–3 short paragraphs), `why` («Зачем это в жизни»: which professions use this, how it helps earn money or in everyday life — concrete, honest, Kazakhstan context welcome), `task` (a concrete goal), `hint`, `check` (function → true when the task is done; marks lesson done and saves progress), plus initial state params.
- Declare lessons at top level as `const LESSONS = [` … with the closing `];` alone at the start of a line (column 0). Our DB sync reads this array; anything the objects call at declaration time must be simple.
- Расчёты tab: step-by-step working for the current values (formulas with numbers, or the reasoning steps for non-numeric topics). Детали: parts of the model, clicking highlights them. Схема: sliders/controls and readouts.
- Content must be scientifically correct and match the school program for that grade (Kazakhstan, updated content). Natural, lively Russian for the grade's age; short sentences; no fluff. For topics needing safety notes (chemistry, electricity, first aid) add a short safety box.

## AI tutor hooks
- `window.LUCH_CONTEXT = () => '…'` — Russian text describing exactly what is on screen: subject, topic, lesson, current values, computed results, task status (don't reveal hidden answers in quiz-like tasks; tell the tutor to guide with questions).
- `window.LUCH_SUGGEST = () => [3 questions]`.
- `<script src="/luch/tutor.js" defer></script>` at the end of body.

## Nav
Header nav: «Карта» → `/physics/#<subject>` (for physics just `/physics/`), then the subject name pointing to the map with the hash, then this topic's short name marked `aria-current="page"`. Brand subtitle: `Опыты · <Предмет> · <тема>`.

## Quality bar
- Works at phone width (375px): no horizontal scroll, 16px gutters, touch dragging works (pointer events, `touch-action` set on draggable areas). Respects `prefers-reduced-motion`.
- No external libraries except Google Fonts and, if 3D genuinely helps, three.js r128 from cdnjs. No reels/video.
- No console errors. Add `<link rel="icon" href="data:,">` in head (the server has no favicon).
- On load never scroll the page: if you center the active lesson card, scroll only the strip horizontally (`strip.scrollLeft = …`), not `scrollIntoView` (it scrolls the whole page down on phones).

## Verify, then report
1. Extract the inline script and run `node --check` on it.
2. Load the page headlessly and complete every task programmatically: use `C:\Users\NARIMA~1\AppData\Local\Temp\claude\a12e02db13641e42\23e6f2de-a1c1-4c70-ae49-28841b87c300\scratchpad\tools\node_modules\playwright-core` with Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, against the dev server `http://localhost:8080/labs/ (or :8081)<subject>-<topicId>/` (if it doesn't answer, serve the repo yourself with a tiny Node static server on another port). Check for page errors, check 375px width has no horizontal scroll, take one desktop screenshot and look at it. Put any scripts/screenshots in that scratchpad folder, not in the repo, and prefix every scratch file name with `<subject>-<topicId>-` (other agents work there in parallel — never overwrite files you didn't create). Remove your localStorage key afterwards.
3. Final report: at most 6 lines — file path, lesson titles, number of lessons, anything uncertain.
